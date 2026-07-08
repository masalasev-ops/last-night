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
- **Weapon** is a **RIFLE** (the Soldier_1 art holds a two-handed rifle); the config block is `weapon`
  with a `name` field that drives the HUD label.
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

### P3.1 notes / follow-ups
- **AI-art pipeline** established (see CLAUDE.md → Assets): raw PixelLab frames git-ignored under
  `public/assets/ai-generated/`; assembled strips (baseline-aligned) committed under `public/assets/Spitter/`.
- **Deferred polish** (not blockers): spit reads green-charge → orange-burst; the spitter holds a
  static frame while kiting between spits (shared FSM behavior); the enemy hurt "flash" uses
  `setTint(0xffffff)`, a no-op game-wide (fix with `setTintFill` later).
