# Progress — Last Night

Milestone log. Plan/DoD detail lives in the phase docs (`docs/BUILD_PHASE2_SLICE.md` for the
slice; `docs/PHASE3_PLAN.md` + per-milestone specs for Phase 3); this file tracks status.

## Phase 2 — one-level forest vertical slice ✅

| Milestone | What it delivered | Status |
|-----------|-------------------|--------|
| **L0 — Resolution + asset pipeline** | 960×540 game; load all real spritesheets/tileset/backgrounds; register animations; placeholder fallback intact. | ✅ Done |
| **L1 — Animated gunman** | Soldier_1 player with a full animation controller; **movement-driven** facing; bullets emit from the gun tip toward the cursor. | ✅ Done |
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
