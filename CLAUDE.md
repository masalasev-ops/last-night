# CLAUDE.md — Last Night (Phaser 4 project)

Persistent project context for Claude Code. Keep this file current. Read it at the start of every session.

## What we're building
**Last Night** — a dark, atmospheric 2D side-scrolling action shooter for the browser.
Right now we are building a **proof-of-concept (POC)** that proves the core loop is fun, using **code-generated placeholder shapes only — no art assets**. The full design and the POC build steps live in `docs/BUILD.md`. Follow that document's milestones in order.

## Tech stack
- **Phaser 4** (current line; API-compatible with Phaser 3 docs/examples).
- **Vite** bundler (hot-reload dev server, production build).
- **JavaScript**, ES modules.
- **Arcade Physics** (not Matter) for all movement and collisions.

## How to run / verify
- Dev server: `npm run dev`, then open the URL it prints (typically http://localhost:8080).
- Production build: `npm run build` (outputs to `dist/`).
- After any change, the dev server hot-reloads. A change is only "done" when the game runs in the browser with a clean console.

## Golden rules (do not violate)
1. **Always leave the game runnable.** Never commit or leave code that breaks `npm run dev` or the core loop.
2. **Build milestones in order** (see `docs/BUILD.md`). Do not start the next milestone until the current one passes its Definition of Done. State the DoD result before moving on.
3. **No magic numbers.** All tunable values live in `src/config.js` (the `CONFIG` object). Gameplay code reads from `CONFIG`.
4. **No external assets.** Generate placeholder visuals as textures at runtime (Graphics → `generateTexture`). No downloaded images, audio, or fonts. All art references go through one place so real art can replace placeholders later without touching game logic.
5. **Pool reused objects** (bullets, enemies) with Phaser Groups. No creating/destroying in the hot path.
6. **Respect scope.** Build only what `docs/BUILD.md` lists under IN. If tempted to add anything under OUT (progression, menus, save, bosses, art), don't.
7. **Comment the non-obvious** (state machines, pooling, any formula). Skip narrating trivial code.

## Project structure (keep to this)
```
src/
  main.js            # Phaser game config + scene list
  config.js          # CONFIG: all tuning values
  scenes/
    BootScene.js     # generate placeholder textures, then start GameScene + UIScene
    GameScene.js     # level, player, enemies, bullets, camera
    UIScene.js       # HUD overlay (health, ammo) — runs above GameScene
  entities/
    Player.js
    Enemy.js
    Bullet.js
docs/
  BUILD.md           # the build spec — source of truth for what to build
public/assets/       # empty during POC (no assets)
```

## Phaser knowledge
When unsure about Phaser 4 APIs, prefer the official skills and docs over guessing:
- If a local Phaser `skills/` folder exists in `node_modules/phaser/` or the repo, read the relevant skill file for the subsystem (scenes, arcade physics, cameras, groups, animations, filters/lighting).
- Otherwise consult https://docs.phaser.io and the Phaser examples.
- Phaser 4 notes: cameras have built-in `startFollow`, deadzone, `setBounds`, and `shake`; use a `Group` for bullet/enemy pooling; HUD text uses `setScrollFactor(0)` or a separate UI Scene; atmosphere can use the Filter system (Vignette, Bloom, Glow) and `sprite.setLighting(true)`.

## Working style
- Use **Plan Mode** for each milestone: propose the plan, let me review, then implement.
- Show changes as diffs; wait for approval on anything destructive.
- After a milestone passes its DoD, remind me to commit — each passing milestone is a git checkpoint.
- Update this file if a decision or convention changes.
