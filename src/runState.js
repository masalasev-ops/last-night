import { CONFIG } from './config.js';

/**
 * RunState (P3.3) — the single owner of RUN-SCOPED state: salvage currency, unlocked weapons, owned
 * upgrades, and the runtime weapons table. It's a MODULE SINGLETON, so it outlives any one scene:
 * `scene.start/stop/restart` never touch it, which is exactly why salvage / unlocks / upgrades survive
 * the Game → Shop → Game transition (the milestone's persistence, with no localStorage — that's P3.5).
 *
 * The core seam: `CONFIG.WEAPONS` is the IMMUTABLE TEMPLATE; `runState.weapons` is a deep clone that
 * upgrades modify. `Player.get weapon()` reads `runState.weapons[id]` live, and (from P3.2) the bullet
 * is stamped with damage/range at fire time — so an upgrade reaches the projectile with zero engine
 * change. Upgrades apply ONLY via `recompute()` (rebuild from the template, re-apply everything owned),
 * never in-place mutation → deterministic, stack-safe, and P3.5-load-ready (restore = set fields + recompute).
 */
export const runState = {
  salvage: 0,
  unlockedWeapons: [],   // weapon ids the player owns (seeded ['rifle']); gates switching
  ownedUpgrades: new Set(), // upgrade ids purchased (one-shot)
  weapons: {},           // runtime weapons table — deep clone of CONFIG.WEAPONS, modified by upgrades

  /** Boot entry — seed defaults so `weapons` exists before the first Player is built. */
  init() {
    this.reset();
  },

  /** Seed run-start defaults from CONFIG, then build the runtime weapons table. This is the New-Game
   * entry P3.5 will call to wipe a run (nothing calls it to wipe yet — persistence is in-memory only). */
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
};
