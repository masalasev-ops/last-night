# Last Night — Phaser 4 POC Build Spec (docs/BUILD.md)

> **Purpose.** Build a **playable browser proof-of-concept** of *Last Night*, a dark 2D side-scrolling action shooter, in **Phaser 4 + Vite (JavaScript)**. The POC exists to answer one question — **is the core loop fun and technically sound?** — using **code-generated placeholder shapes only, no art assets.** Build the milestones in order; keep the game runnable at every step. Do not build anything under OUT (§3).

---

## 0. Success definition
A person runs `npm run dev`, opens the browser, and within seconds is: running and jumping through a short dark level, shooting a pistol at a few shambling enemies that fight back, taking damage, dying and restarting, and reaching the end. It should already feel tense and responsive. If that loop is fun with rectangles, the full game is worth building. That is the whole goal.

---

## 1. Stack & environment
- **Phaser 4**, **Vite**, **JavaScript**, ES modules. Arcade Physics only.
- Run with `npm run dev`; verify in the browser with a clean console. `npm run build` must also succeed.
- **Internal design resolution 480×270**, scaled to the window with `Phaser.Scale.FIT` and pixelArt/nearest-neighbour enabled (crisp pixels). Author all positions/tuning in the 480×270 space.
- Target 60 FPS; use Arcade Physics for frame-rate-independent movement.

---

## 2. How to work (agent protocol)
1. Build the steps in §4 **in order**; keep the game runnable after each.
2. **Test after each step** (run dev server, play, check console). State the result before continuing.
3. **No magic numbers** — all tuning in `src/config.js` (`CONFIG`).
4. **No external assets** — generate placeholder textures at runtime (see §6). Route all visuals through the boot texture-generation + a single place that maps an entity type → texture key, so real art can replace placeholders later without touching logic.
5. **Pool** bullets and enemies with Phaser Groups.
6. Use **Plan Mode** per milestone; show diffs; commit after each passing milestone.
7. State assumptions in code comments; don't stall on ambiguity.

---

## 3. Scope — IN vs OUT (read carefully)

**IN (build exactly this):**
- Player: move, sprint, jump (coyote-time + jump-buffer), gravity, platform collision, mouse-aim, shoot, reload, take damage, die, respawn.
- One weapon: pistol with pooled bullets, ammo, reload.
- One short hand-authored level with platforms and a clear end marker.
- One enemy type with a simple state machine (Patrol → Chase → Attack → Hurt → Dead); place 2–3 plus one small spawn cluster.
- Follow-camera with look-ahead and level bounds; screen shake on shoot/hit.
- Minimal HUD (health, ammo) in a separate UI Scene.
- Win state (reach end) and lose state (health 0 → restart).
- Atmosphere/juice: dark palette; muzzle/impact/blood particles; optional Phaser Vignette filter and player light.
- A debug toggle.

**OUT (do NOT build — these belong to the full game):**
- Weapon progression, upgrades, skill trees, XP, inventory, weapon wheel.
- Save/load, checkpoints, multiple levels, data-file level loading.
- Bosses (one tougher enemy variant is the most you may add, only in the last step).
- Menus beyond a start prompt and a restart prompt; no settings screen.
- Story, notes, cutscenes, dialogue.
- Real sprites/tilesets/backgrounds/sound design.
- Difficulty modes, controller support, mobile input.

If it isn't in the IN list, don't build it.

---

## 4. Build steps (each with a Definition of Done)

**Step 0 — Scaffold & scenes.**
Confirm the Vite template runs. Create `BootScene` (generates placeholder textures, §6), `GameScene`, and `UIScene`, wired in `src/main.js` with the Arcade Physics config and `CONFIG` from `src/config.js`. `UIScene` runs above `GameScene`.
*DoD:* `npm run dev` shows a blank GameScene at 480×270 scaled to the window, UIScene overlaid, no console errors.

**Step 1 — Player movement.**
Player sprite with an Arcade body. Move (A/D + arrows), sprint (Shift), gravity, jump (Space) with coyote-time and jump-buffer, collide with a flat floor.
*DoD:* player moves and jumps smoothly, no landing jitter, frame-rate independent, 60 FPS.

**Step 2 — Level & camera.**
A level several screens wide: floor + a handful of platforms (a static physics group) and a visible end marker. `cameras.main.startFollow` with lerp, a small deadzone, look-ahead, and `setBounds` to the level.
*DoD:* you can traverse the whole level by running/jumping; camera follows smoothly and stops at edges.

**Step 3 — Shooting.**
Mouse aims; left-click fires a pistol. Bullets are a **pooled Group** with Arcade bodies, travel toward the aim direction, expire by range/lifetime. Ammo counter; R reloads with a delay; fire-rate limited.
*DoD:* firing respects fire-rate, ammo, and reload; bullets are pooled (reused, not endlessly created); no allocation spikes.

**Step 4 — Enemy & AI.**
An enemy sprite with a state machine in its update: Patrol (walk a range) → Chase (player within detection radius) → Attack (contact/short-range damage on cooldown) → Hurt (tint flash) → Dead (removed). Bullet–enemy overlap deals damage. Place 2–3 + a small spawn cluster.
*DoD:* enemies patrol, notice and chase, damage the player on contact, take bullet damage, and die.

**Step 5 — Health, death, restart.**
Player HP; damage on enemy contact with brief invulnerability + knockback; death at 0 HP; restart (key) that resets the scene cleanly.
*DoD:* taking hits, dying, and restarting all work repeatedly with no leftover state and no reload needed.

**Step 6 — HUD & win condition.**
UIScene shows health and ammo (fixed to screen). Reaching the end marker shows a simple "You made it — press R to replay" state.
*DoD:* HUD reflects live state; win and lose both resolve to a clean restart.

**Step 7 — Atmosphere & juice.**
Dark palette; screen shake on shooting and on taking hits (`camera.shake`); pooled particle bursts for muzzle flash, bullet impact, and blood; enemy hit-flash. Optionally add a Phaser **Vignette** filter and a soft **player light** (`setLighting`) to sell the horror mood. Add the debug toggle (§7).
*DoD:* the game reads as dark and tense even as rectangles; effects hold 60 FPS; debug toggle works.

---

## 5. Tuning config (`src/config.js` — starting values, tune to feel)
All in the 480×270 space, pixels and seconds.
```
export const CONFIG = {
  width: 480, height: 270,
  gravity: 1400,             // px/s^2
  moveSpeed: 130,            // px/s
  sprintMultiplier: 1.6,
  jumpVelocity: 430,         // px/s
  coyoteTime: 0.10, jumpBuffer: 0.10,   // s
  playerMaxHealth: 100, invulnOnHit: 0.6, knockback: 160,

  pistol: { bulletSpeed: 620, fireRate: 6, magSize: 12,
            reloadTime: 1.1, bulletRange: 400, damage: 12 },

  enemy: { maxHealth: 30, moveSpeed: 70, chaseSpeed: 110,
           detectionRadius: 140, attackRange: 16, touchDamage: 10,
           attackCooldown: 0.8 },

  camera: { lookAhead: 40, lerp: 0.12 },
  shake: { onShoot: 0.002, onHit: 0.01 }   // Phaser shake intensity
};
```

## 6. Placeholder visuals (generated, no files)
In `BootScene`, build textures with `this.make.graphics(...)` → `generateTexture(key, w, h)`, then reference by key everywhere.
- **Palette:** background `#0a0a0f`; platforms `#1c2230`; player `#7fb0c8`; enemy `#6f8f4a`; bullet `#e8e8c0`; blood `#8b0000`; muzzle `#ffd27f`; HUD text `#c8ccd4`.
- **Sizes:** player 12×20; enemy 12×16; bullet 3×2; platforms are rectangles. Add a small facing nub on the player so aim is readable.
- Keep one map of `type → textureKey`; this is the future art swap-point.

## 7. Controls & debug
**Controls:** A/D or arrows move · Space jump · Shift sprint · Mouse aim · Left-click shoot · R reload / restart.
**Debug (backtick `~`):** toggle FPS + entity count, god mode, physics-body debug draw, and spawn-enemy-at-pointer. Off by default.

## 8. Deliverable & handback
The project runs via `npm run dev` through all seven steps and builds via `npm run build`. After each milestone: state what runs, the DoD result, assumptions, and known issues, and commit. At the end, give a one-paragraph read on whether the loop feels fun and the first thing you'd tune.

## 9. How this maps to the full game
This POC is **Milestones 0–2** of the larger *Last Night* build spec, in Phaser. The `CONFIG` values, the scene/entity/state-machine structure, the Group-based pooling, and the single texture-swap map are intentionally compatible with the full game's data-driven, art-swappable design — so the feel you tune and the architecture you validate carry forward directly.

---

### Reminder
Prove the loop, nothing more. A tight, fun, runnable core beats a broad, half-working one.
