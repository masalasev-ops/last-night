import { CONFIG } from './config.js';

/** Persisted-save contract (P3.5). Bump SCHEMA_VERSION on any shape change → older saves read as "no save". */
const SAVE_KEY = 'lastnight.save.v1';
const SCHEMA_VERSION = 1;

/**
 * RunState (P3.3, persisted in P3.5) — the single owner of RUN-SCOPED state: salvage currency, unlocked
 * weapons, owned upgrades, the runtime weapons table, and (P3.5) the level cursor. It's a MODULE
 * SINGLETON, so it outlives any one scene: `scene.start/stop/restart` never touch it, which is why
 * salvage / unlocks / upgrades survive the Game → Shop → Game transition.
 *
 * The core seam: `CONFIG.WEAPONS` is the IMMUTABLE TEMPLATE; `runState.weapons` is a deep clone that
 * upgrades modify. `Player.get weapon()` reads `runState.weapons[id]` live, and (from P3.2) the bullet
 * is stamped with damage/range at fire time — so an upgrade reaches the projectile with zero engine
 * change. Upgrades apply ONLY via `recompute()` (rebuild from the template, re-apply everything owned),
 * never in-place mutation → deterministic, stack-safe, and load-ready: a load is just "set fields + recompute()".
 *
 * P3.5 persistence — the ONLY checkpoint is a level boundary. Two concerns kept in sync:
 *   • `_checkpoint` (in-memory snapshot) — the DEATH-REVERT target; always available even if storage is
 *     blocked. Taken at every level-start boundary (newGame / advanceLevel / load) + on save.
 *   • localStorage[SAVE_KEY] (on-disk) — the CROSS-SESSION Continue source. Written on the same
 *     boundaries + each shop purchase. A failed setItem is swallowed → in-session death-revert still works.
 * Death reverts to `_checkpoint` (the attempt's salvage is discarded); NO save is written on death. The
 * derived `weapons` table is never serialized — it's rebuilt by recompute() on load.
 */
export const runState = {
  salvage: 0,
  unlockedWeapons: [],   // weapon ids the player owns (seeded ['rifle']); gates switching
  ownedUpgrades: new Set(), // upgrade ids purchased (one-shot)
  weapons: {},           // runtime weapons table — deep clone of CONFIG.WEAPONS, modified by upgrades
  levelIndex: 1,         // which level the run is on (P3.5 cursor; consumed by P3.6's level-data lookup)
  phase: 'level',        // 'level' | 'shop' — where a Continue resumes (mid-shop close loses nothing)
  _checkpoint: null,     // in-memory level-start snapshot (serialize() shape); death-revert target

  /** Boot entry — seed defaults so `weapons` exists before the first Player is built. Does NOT start a
   * run: the Title decides New Game vs Continue (P3.5). */
  init() {
    this.reset();
  },

  /** Seed run-start defaults from CONFIG, then build the runtime weapons table. The New-Game wipe
   * (`newGame()`) calls this; it does NOT touch `levelIndex`/`phase`/disk — the caller owns those. */
  reset() {
    this.salvage = CONFIG.salvageStart;
    this.unlockedWeapons = [CONFIG.startingWeapon];
    this.ownedUpgrades = new Set();
    this.recompute();
  },

  /**
   * Rebuild `weapons` from the immutable template and re-apply every owned upgrade. Adds are applied
   * before mults across ALL upgrades, so purchase order never changes the result (e.g. two +damage
   * tiers then a ×fireRate always land the same). The only place `weapons` is ever written.
   */
  recompute() {
    this.weapons = structuredClone(CONFIG.WEAPONS);
    const owned = [...this.ownedUpgrades]
      .map((id) => CONFIG.UPGRADES[id])
      .filter((u) => u && u.target !== 'player' && this.weapons[u.target]); // 'player' target reserved (P3.5)
    for (const u of owned) if (u.mode === 'add') this.weapons[u.target][u.stat] += u.amount;
    for (const u of owned) if (u.mode === 'mult') this.weapons[u.target][u.stat] *= u.amount;
  },

  // --- Salvage / affordability ---
  addSalvage(n) {
    this.salvage += n;
  },
  canAfford(cost) {
    return this.salvage >= cost;
  },

  // --- Weapon unlocks (gate switching) ---
  isUnlocked(id) {
    return this.unlockedWeapons.includes(id);
  },
  /** Shop buyable-state for a weapon: not yet owned and affordable. */
  weaponAvailable(id) {
    return !this.isUnlocked(id) && this.canAfford(CONFIG.WEAPONS[id]?.unlockCost ?? 0);
  },
  /** Buy a weapon unlock. Returns false (no-op) if already unlocked or unaffordable. */
  unlockWeapon(id) {
    if (this.isUnlocked(id)) return false;
    const cost = CONFIG.WEAPONS[id]?.unlockCost ?? 0;
    if (!this.canAfford(cost)) return false;
    this.salvage -= cost;
    this.unlockedWeapons.push(id);
    return true;
  },

  // --- Upgrades ---
  /** Shop buyable-state for an upgrade: not owned, prereq (if any) owned, and affordable. */
  upgradeAvailable(id) {
    const u = CONFIG.UPGRADES[id];
    return !!u && !this.ownedUpgrades.has(id) && (!u.prereq || this.ownedUpgrades.has(u.prereq)) && this.canAfford(u.cost);
  },
  /** Buy an upgrade: guards not-owned + prereq-met + affordable, deducts, records, then recompute()s. */
  buyUpgrade(id) {
    if (!this.upgradeAvailable(id)) return false;
    this.salvage -= CONFIG.UPGRADES[id].cost;
    this.ownedUpgrades.add(id);
    this.recompute();
    return true;
  },

  /** Debug (behind the god-mode toggle): unlock every weapon for testing. */
  unlockAll() {
    this.unlockedWeapons = Object.keys(CONFIG.WEAPONS);
  },

  // --- Persistence (P3.5) -----------------------------------------------------------------------

  /** Flatten run-scoped state to a plain, JSON-safe snapshot. The `weapons` table is DELIBERATELY
   * excluded — it's derived, rebuilt by recompute() on load. `Set` → array for serialization. */
  serialize() {
    return {
      version: SCHEMA_VERSION,
      levelIndex: this.levelIndex,
      phase: this.phase,
      salvage: this.salvage,
      unlockedWeapons: [...this.unlockedWeapons],
      ownedUpgrades: [...this.ownedUpgrades],
    };
  },

  /** Shape + version guard shared by load/has/peek. A snapshot that fails this is treated as "no save". */
  _isValid(o) {
    return (
      !!o &&
      o.version === SCHEMA_VERSION &&
      typeof o.levelIndex === 'number' &&
      (o.phase === 'level' || o.phase === 'shop') &&
      typeof o.salvage === 'number' &&
      Array.isArray(o.unlockedWeapons) &&
      Array.isArray(o.ownedUpgrades)
    );
  },

  /** Load a snapshot into live state: set fields, rehydrate `ownedUpgrades` as a Set, recompute() the
   * weapons table, and adopt this snapshot as the in-memory checkpoint. The whole P3.5 payoff — no
   * weapon-table deserialization, just "set fields + recompute()". */
  applySnapshot(snap) {
    this.salvage = snap.salvage;
    this.levelIndex = snap.levelIndex;
    this.phase = snap.phase;
    this.unlockedWeapons = [...snap.unlockedWeapons];
    this.ownedUpgrades = new Set(snap.ownedUpgrades);
    this.recompute();
    this._checkpoint = this.serialize();
  },

  /** Snapshot + persist. Sets the in-memory checkpoint FIRST (death-revert target, always available),
   * then writes localStorage — a blocked/failed setItem (private mode / quota) is swallowed so
   * in-session play never breaks; only cross-session persistence is lost. */
  save() {
    this._checkpoint = this.serialize();
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this._checkpoint));
    } catch {
      /* storage unavailable — in-memory checkpoint still valid for this session */
    }
  },

  /** Read the on-disk save into live state (cross-session Continue). Returns true on success; any
   * failure (no save / bad JSON / wrong version / blocked storage) returns false — never throws. */
  loadFromStorage() {
    try {
      const parsed = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (!this._isValid(parsed)) return false;
      this.applySnapshot(parsed);
      return true;
    } catch {
      return false;
    }
  },

  /** True only if a valid, current-version save exists on disk (gates the Title's Continue button). */
  hasSave() {
    try {
      return this._isValid(JSON.parse(localStorage.getItem(SAVE_KEY)));
    } catch {
      return false;
    }
  },

  /** Lightweight read of `{ levelIndex, phase }` for the Continue label — parses + version-checks
   * WITHOUT mutating live state. Null on any failure. */
  peekSave() {
    try {
      const o = JSON.parse(localStorage.getItem(SAVE_KEY));
      return this._isValid(o) ? { levelIndex: o.levelIndex, phase: o.phase } : null;
    } catch {
      return null;
    }
  },

  /** Remove the on-disk save (New Game wipe). Swallows storage errors. */
  clearSave() {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      /* nothing to clear if storage is unavailable */
    }
  },

  /** Erase ALL persisted saves — every `lastnight.*` key (the current one + any stale/older-version keys,
   * so nothing lingers across a schema bump) — and reset the in-memory run to a clean slate. Backs the
   * Title's "Erase Save". Swallows storage errors (private mode / blocked). */
  clearAllSaves() {
    try {
      const doomed = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('lastnight.')) doomed.push(k);
      }
      doomed.forEach((k) => localStorage.removeItem(k));
    } catch {
      /* storage unavailable — nothing to clear */
    }
    this.levelIndex = 1;
    this.phase = 'level';
    this._checkpoint = null;
    this.reset(); // re-seed salvage/unlocks/upgrades + rebuild the weapons table
  },

  /** Take a level-start checkpoint: snapshot the current state to `_checkpoint` AND persist it. Called
   * by the transitions INTO a level (newGame / advanceLevel / load), never mid-level. */
  checkpoint() {
    this.save();
  },

  /** Revert to the level-start checkpoint (DEATH). Reads the in-memory `_checkpoint` only — no disk
   * write — so the attempt's salvage is discarded while unlocks/upgrades (banked pre-level) stay. */
  restoreCheckpoint() {
    if (this._checkpoint) this.applySnapshot(this._checkpoint);
  },

  /** New Game: wipe to defaults, reset the cursor to Level 1, clear the old save, then checkpoint
   * (writes a fresh default save + sets `_checkpoint` for L1's first death-revert). */
  newGame() {
    this.reset();
    this.levelIndex = 1;
    this.phase = 'level';
    this.clearSave();
    this.checkpoint();
  },

  /** Advance to the next level (shop Continue): bump the cursor, back to 'level' phase, checkpoint
   * (this becomes the new level-start death-revert target). */
  advanceLevel() {
    this.levelIndex += 1;
    this.phase = 'level';
    this.checkpoint();
  },

  /** Enter the shop on level-clear: flip phase to 'shop' and save — banks the cleared level's salvage
   * so closing before/during shopping loses nothing (purchases save individually thereafter). */
  enterShop() {
    this.phase = 'shop';
    this.save();
  },
};
