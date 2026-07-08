# Progress — Last Night

Milestone log. Plan/DoD detail lives in the phase docs (`docs/BUILD_PHASE2_SLICE.md` for the
slice; `docs/PHASE3_PLAN.md` + per-milestone specs for Phase 3); this file tracks status.

## Phase 2 — one-level forest vertical slice ✅

| Milestone | What it delivered | Status |
|-----------|-------------------|--------|
| **L0 — Resolution + asset pipeline** | 960×540 game; load all real spritesheets/tileset/backgrounds; register animations; placeholder fallback intact. | ✅ Done |
| **L1 — Animated gunman** | Soldier_1 player with a full animation controller; **movement-driven** facing; bullets fly toward the cursor. *(At delivery they spawned from the gun tip; **P3.4** moved the spawn to the player centre at gun height so point-blank shots connect — the muzzle flash still fires from the tip.)* | ✅ Done |
| **L2 — Forest level** | Multi-layer parallax + real 32px tileset ground; **one-way** floating platforms; follow camera + bounds; traversable start→end. | ✅ Done |
| **L3 — Zombies** | 4 zombie types via a 5-state FSM (patrol/chase/attack/hurt/dead) with correct per-type facing, corpse linger, no attack stutter. | ✅ Done |
| **L4 — Atmosphere + HUD** | Vignette + darkness/flashlight overlay + fog; upgraded HUD (health bar + ammo + weapon). | ✅ Done |
| **L5 — Assembly & polish** | Health chest pickup (level-data), intro title card, level-complete/restart, light atmosphere, docs, debug-off playtest. | ✅ Done |

## Notes / decisions carried forward
- **Weapon** — the Soldier_1 art holds a two-handed rifle. *(Superseded in **P3.2**: the flat `weapon`
  block became the `WEAPONS` table with Rifle/Shotgun/SMG; the soldier still visually holds the rifle for
  all three — weapon identity is HUD + projectile, not character art.)*
- **Atmosphere** ships **on but light** (`config.atmosphere.enabled: true`, `darkAlpha ≈ 0.30`): a
  moody night tint that still keeps the forest, soldier, and zombies clearly visible. The earlier
  full-dark version hid them and was dialed back. One flag toggles the whole stack.
- **Zombie platform behavior**: zombies can't jump, so a player perched on a platform is unreachable.
  The FSM's **RETREAT** state walks the zombie a bounded distance (`enemy.retreatDistance`) back the
  way it came, then patrols locally — staying on-screen — and re-engages if the player drops down.
- **Pickup**: one **health chest** (`chest.png`) at `LEVEL.pickups`. Heals `pickup.heal` HP; at full
  health it's left in place (overlap isn't a one-shot) so it's available when the player returns hurt.

## Open / deferred
- **L1 `maxVelocityY` fall-cap** (`Player.js`) is an un-doubled leftover from the 2× rescale — left as
  a feel flag to playtest before changing.
- Per the slice scope: no save/load, checkpoints, menus, weapon progression, audio, or other
  levels/biomes — those are later phases.

## Phase 3 — game systems (in progress)
Source of truth: `docs/PHASE3_PLAN.md` + per-milestone specs (e.g. `docs/P3.1_RANGED_ENEMY.md`).

| Milestone | What it delivered | Status |
|-----------|-------------------|--------|
| **P3.1 — Ranged enemy (Acid Spitter)** | Ranged `aiProfile` on the shared FSM (kite band + arcing acid that reaches a perched player, via `AcidProjectile`); real PixelLab sprite (idle/walk/attack/hurt/dead) dropped in through the swap-point with an explicit `ACID_SPITTER_BODY`, decoupled spit muzzle, and `artScale` sizing to the zombie roster; green-blob placeholder kept as fallback. | ✅ Done |
| **P3.2 — Data-driven weapon system + switching** | Flat `weapon` → a **`WEAPONS` data table** (Rifle/Shotgun/SMG) read live via `player.weapon`; **per-weapon mags** switchable with **1/2/3**; per-weapon **fire mode** (`auto` hold-to-fire vs `single` click-per-shell), **pellets/spread**, **projectileTint**, and **muzzleScale**. Headline refactor: **bullets carry their own damage/range/tint** (stamped at `bullet.fire()`), so a mid-air weapon switch never mutates a round in flight. Weapon identity = HUD label + projectile, **no character-art change**. A 4th weapon is now a pure data row. | ✅ Done |
| **P3.3 — Salvage, end-of-level shop & upgrades** | The combat loop **kill → salvage → shop → stronger**. New **`RunState`** module (in-memory singleton, survives scene transitions) owns run-scoped `salvage`/`unlockedWeapons`/`ownedUpgrades` + a **runtime weapons table** (a `structuredClone` of the `CONFIG.WEAPONS` template that upgrades modify). `Player.get weapon()` reads `runState.weapons[id]`, so via the P3.2 seam an upgrade reaches the bullet with **zero engine change**. Enemies drop salvage on the kill (auto-collected, floating `+N`, HUD counter); a new **`ShopScene`** spends it on **weapon unlocks** (start rifle-only; shotgun/SMG earned) and **data-driven `UPGRADES`** (add/mult on damage/reload/mag/fireRate, tiered via `prereq`), applied by **`recompute()`** (adds-before-mults, rebuilt from template). Win → shop → next level; `RunState` persists across the transition. | ✅ Done |
| **P3.4 — Enemy roster (Runner / Tank / Flyer)** | Generalized `Enemy.preUpdate` stat resolution to `this.def.<stat> ?? CONFIG.enemy.<stat>` for **every** shared stat (was ranged-only) + a `sheet`→`animKey` override in `spawn()`. That makes **Runner** (fast/fragile) and **Tank** (slow/tanky/big) **pure `ENEMIES` data rows on the melee FSM — zero new code** (they borrow a zombie sheet, tinted + rescaled). **Flyer** is the one new `aiProfile:'flyer'` branch: gravity-off, homes in 2D, reaches a perched player, damages on contact (placeholder blob). Melee zombies unchanged (inherit defaults). Placeholder reskins only — no PixelLab. | ✅ Done |

### P3.1 notes / follow-ups
- **AI-art pipeline** established (see CLAUDE.md → Assets): raw PixelLab frames git-ignored under
  `public/assets/ai-generated/`; assembled strips (baseline-aligned) committed under `public/assets/Spitter/`.
- **Deferred polish** (not blockers): spit reads green-charge → orange-burst; the spitter holds a
  static frame while kiting between spits (shared FSM behavior); the enemy hurt "flash" uses
  `setTint(0xffffff)`, a no-op game-wide (fix with `setTintFill` later).

### P3.2 notes / follow-ups
- **The seam P3.3 plugs into**: damage is resolved from the live weapon at fire time and carried by the
  bullet, so P3.3's stat upgrades (which mutate a `WEAPONS` row) flow through with no engine change.
- **Reserved-but-inert data fields** carried in each `WEAPONS` row for later milestones: `ammoType`
  (reserve ammo → P3.5), `hudIcon` (real ~32px icon is a later art drop; a text label ships now),
  `sfxFire`/`sfxReload` (per-weapon audio → P3.9). `fireMode: 'burst'` is a valid schema value with
  **no consumer** yet (rifle/smg=`auto`, shotgun=`single`).
- **Not built** (kept out of scope): scroll-wheel switching (number keys are the spec), reserve-ammo
  pool + save. The **1/2/3 → weapon** mapping is coupled to `WEAPONS` declaration order (`Object.keys`)
  — data-driven, but reordering the table silently reorders the keys.
- Verified with the puppeteer-core harness (A–I, 9/9): rifle regression byte-for-byte (at delivery);
  shotgun 1 ammo = 7 pellets in ±9°; SMG auto spray; in-flight round keeps rifle damage/range across a
  switch; shared fire cooldown carries across switches; pool bounded at 48, no leak, 60 FPS.
- **Playtest balance tune** (after verification): the two `auto` weapons read too alike (near-identical
  bullet speed + tiny SMG spread). Data-only fix in `CONFIG.WEAPONS` — rifle `fireRate 6→4` +
  `bulletSpeed 1240→1500` (deliberate crack, fast flat tracer); SMG `spreadDeg 3→7` (visible cone).
  Measured cadence gap widened 2.2×→3.3×. So rifle no longer matches the pre-P3.2 numbers by design.

### P3.3 notes / follow-ups
- **The seam paid off**: redirecting `Player.get weapon()` from `CONFIG.WEAPONS` to `runState.weapons`
  was the whole job — a bought upgrade is stamped onto the very next bullet with no combat-code change
  (verified directly, test D). `recompute()` (clone template → all adds → all mults) is the **only**
  writer of the runtime table, so purchase order never matters and P3.5 can restore a save by setting
  `ownedUpgrades` + calling it.
- **Scene ownership moved**: `GameScene.create()` now launches `UIScene` (was `BootScene`), and UI is
  stopped before every outbound transition (win → shop, death → restart) — so the HUD comes back
  correctly after the shop.
- **Parked for later** (reserved, no consumer yet): `RunState.reset()` exists but nothing calls it to
  wipe a run — **`localStorage` save/continue + New-Game-wipe is P3.5** (which reuses `reset()`/`recompute()`).
  `target:'player'` upgrades are a reserved value (player stats still come from `CONFIG`; a small
  `runState.player` seam later). Salvage is **auto-collected on kill** (no collectible pickup entity yet).
  The shop is a **functional text UI** (real layout/weapon icons are an art pass). **Continue restarts
  L1 as a stub** until P3.6 adds Level 2 — so the intro card replays each Continue (expected, not a bug);
  persistence is proven by `RunState` surviving the Game→Shop→Game round-trip, not a distinct 2nd level.
- Verified with the puppeteer-core harness (A–I, 9/9): salvage counted within each type's `min..max` +
  `+N`/HUD; shop opens on win (Game/UI stopped); **upgrade reaches the fired bullet** (D); tier gate +
  additive stack (E); unlock gates switching (F); **RunState persists across Game→Shop→Game and can't
  overspend** (G); round-trip clean, no `+N` leak, ~55–57 FPS (H).
- **Post-P3.3 fix**: the salvage `+N` rendered at depth 900, *under* the night-atmosphere darkness overlay
  (depth 1000) → dimmed to near-invisibility. Raised it to depth 1001 (HUD-popup, above the overlay).

### P3.4 notes / follow-ups
- **The clean split held**: after generalizing stat resolution (`this.def.<stat> ?? CONFIG.enemy.<stat>`)
  + the `sheet`→`animKey` override, **Runner and Tank required ZERO new code** — every `Runner`/`Tank`
  mention in `Enemy.js` is a comment; the only `aiProfile` branches are `ranged` (P3.1) and the one new
  `flyer`. Proven by test F: a throwaway 4th melee variant (`Brute`) spawned + behaved with no engine edit.
- **`animKey` vs `type`**: variants borrow a sheet's frames via `animKey` (Runner→Zombie_2, Tank→Zombie_3)
  while `this.type` stays the roster id (salvage/lookups). **Pooling-safety**: `deactivate()` restores
  `body.setAllowGravity(true)` so a dead Flyer reused as a grounded zombie doesn't float (only the flyer
  `spawn()` turns gravity off).
- **Parked (placeholders → real art later, no logic change)**: Runner/Tank are **tinted, rescaled zombie
  reskins**; Flyer is a **purple blob**. Real per-type CraftPix-matched art drops in via the swap-point
  (`sheet`/`TEXTURE_MAP`) — the P3.1 Spitter flow. Flyer has **no pathfinding** (straight-line homing;
  fine for the open forest — revisit if the P3.6 biome geometry needs it). Per-type SFX → P3.9.
- Verified with the puppeteer-core harness (A–H, 8/8): melee regression intact (Zombie_1..4 hp30, no
  overrides, scale 1 — **test B**); Runner hp15/×0.85/Zombie_2 sheet; Tank hp90/×1.28 with a scaled body
  that hugs (35.8px) + stays grounded; Flyer gravity-off, homes on both axes (reaches *up* to a perched
  player), damages, dies, pool-safe; mixed cluster reads clearly at ≥55 FPS with per-type salvage drops.
- **Playtest fix — point-blank misses**: bullets spawned at the gun tip (`muzzleOffset.x` = 26px ahead of
  the player), so a point-blank enemy could sit *behind* the spawn — firing at anything on its far side
  sent the round away → "can't hit when too close". Now bullets spawn from the **player centre** at gun
  height (forward blind spot gone; still aims true up close); the muzzle flash/flashlight stay at the tip.
  Verified: aiming beyond a D=4..24px enemy now hits; P3.2 weapon harness still 9/9 (no regression).
