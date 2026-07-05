# CLAUDE.md — Last Night (Phaser 4 project)

Persistent project context for Claude Code. Keep this file current. Read it at the start of every session.

## What we're building
**Last Night** — a dark, atmospheric 2D side-scrolling action shooter for the browser.
The core-loop **POC is complete** (its spec is `docs/BUILD.md`, kept as history). We are now building **Phase 2 — a one-level vertical slice**: integrating **real pixel art** and a **gun-wielding protagonist** into the proven loop to produce one complete, playable **forest level**. The current source of truth is **`docs/BUILD_PHASE2_SLICE.md`** — follow its milestones (L0–L5) in order.

## Tech stack
- **Phaser 4** (current line; API-compatible with Phaser 3 docs/examples).
- **Vite** bundler (hot-reload dev server, production build).
- **JavaScript**, ES modules.
- **Arcade Physics** (not Matter) for all movement and collisions.
- **Internal resolution: 960×540** (2× the POC's 480×270). Character sheets are 128×128 frames; tiles are 32×32.

## How to run / verify
- Dev server: `npm run dev`, then open the URL it prints (**use the fixed port set for this project** to avoid clashing with the other project on 8080).
- Production build: `npm run build` (outputs to `dist/`).
- A change is only "done" when the game runs in the browser with a clean console.

## Golden rules (do not violate)
1. **Always leave the game runnable.** Never commit or leave code that breaks `npm run dev` or the core loop.
2. **Build milestones in order** (see `docs/BUILD_PHASE2_SLICE.md`). Do not start the next milestone until the current one passes its Definition of Done. State the DoD result before moving on. Only do the milestone the user names.
3. **No magic numbers.** All tunable values live in `src/config.js`. Gameplay code reads from config.
4. **Real art enters through the swap-point only.** Load art from `public/assets/` via the animation registry / `TEXTURE_MAP`. **Art must never drive gameplay:** hitboxes/collision come from explicit config values (physics bodies), never from a sprite's pixel size — fit art with origin/offset/scale only. Keep the runtime placeholder-texture generator as a **fallback** for any entity whose real art isn't wired yet, so the game never breaks on a missing asset.
5. **Pool reused objects** (bullets, enemies) with Phaser Groups. No creating/destroying in the hot path.
6. **Respect scope.** Build only what the current build plan lists. During this slice, do NOT add save/load, checkpoints, bosses, menus, weapon progression, audio, or other levels — those are later phases.
7. **Comment the non-obvious** (state machines, pooling, animation controllers, any formula). Skip narrating trivial code.

## Assets (in `public/assets/`, served by Vite at `assets/…`)
- **Player:** `soldier-sprite-sheets-pixel-art/Soldier_1/` (use Soldier_1 — clean filenames + Explosion sheet). 128×128 frames.
- **Enemies:** `urban-zombie-sprite-sheet-pixel-art-pack/Zombie_1..4/`. 128×128 frames.
- **Terrain:** `platformer-game-tileset-pixel-art/PNG/Tileset.png` (32×32 tiles) + parallax layers in `PNG/Background/x32/`.
- **Alt backgrounds:** `free-post-apocalypse-pixel-art-backgrounds-for-game-projects/` (folders contain spaces — URL-encode if used).
- **Do NOT load:** any `COUPON.*`, `*.psd`, `*.url`, `Licens.txt`; the Unicode-garbled `PNG/Background/1920x1080/#U251c…÷2` folder; or the garbage-named `Map …tmx`. Use the clean `x32` layers and `TILED_files/Map.tmx`.
- Exact per-sheet frame counts are tabulated in `docs/BUILD_PHASE2_SLICE.md`.

## Project structure
```
src/
  main.js            # Phaser game config (960×540) + scene list
  config.js          # all tuning + ASSETS paths + animation registry
  scenes/
    BootScene.js     # (or PreloadScene) load real spritesheets, tileset, bg; register animations
    GameScene.js     # level, player, enemies, bullets, camera, atmosphere
    UIScene.js       # HUD overlay (health, ammo)
  entities/
    Player.js        # + animation controller (reads state → plays anim)
    Enemy.js         # + animation controller
    Bullet.js
docs/
  BUILD_PHASE2_SLICE.md   # CURRENT source of truth
  BUILD.md                # completed POC spec (history)
public/assets/       # the four CraftPix packs (see Assets above)
```

## Phaser knowledge
When unsure about a Phaser 4 API, **check the docs/skills before writing it** — do not guess:
- If a local Phaser `skills/` folder exists in `node_modules/phaser/`, read the relevant skill (scenes, arcade physics, cameras, groups, animations, filters/lighting).
- Otherwise consult https://docs.phaser.io and the examples.
- **Especially the Filter (Vignette) and lighting APIs** — these were left commented out in the POC because the exact signatures weren't verified. This time, verify them against the docs and get them working (or use a camera-following dark radial overlay as a supported fallback).
- Notes: cameras have `startFollow`, deadzone, `setBounds`, `shake`; use a `Group` for pooling; HUD uses `setScrollFactor(0)` or a separate UI Scene; spritesheets load via `this.load.spritesheet(key, path, { frameWidth:128, frameHeight:128 })`.

## Working style
- Use **Plan Mode** for each milestone: propose the plan, let the user review, then implement.
- Show changes as diffs; wait for approval on anything destructive.
- After a milestone passes its DoD, remind the user to commit — each passing milestone is a git checkpoint.
- Update this file if a decision or convention changes.