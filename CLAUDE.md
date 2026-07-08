# CLAUDE.md — Last Night (Phaser 4 project)

Persistent project context for Claude Code. Keep this file current. Read it at the start of every session.

## What we're building
**Last Night** — a dark, atmospheric 2D side-scrolling action shooter for the browser.
The **POC** (`docs/BUILD.md`) and the **Phase 2 one-level slice** (`docs/BUILD_PHASE2_SLICE.md`, tagged `slice-complete`) are both **done**. We are now in **Phase 3 — building the game systems** (ranged/varied enemies, weapons + switching, scrap + an end-of-level shop + upgrades, checkpoints + save, a boss, menus, audio) and proving them across a **second biome + a boss**, toward a shippable **Chapter 1 demo**.
- **Phase overview / source of truth:** `docs/PHASE3_PLAN.md`.
- **Active milestone:** each milestone has its own spec doc (e.g. `docs/P3.1_RANGED_ENEMY.md`). Build only the milestone the user names.

## Tech stack
- **Phaser 4**, **Vite**, **JavaScript** (ES modules), **Arcade Physics** (not Matter).
- **Internal resolution 960×540.** Character sheets are 128×128 frames; tiles 32×32; art at **scale 1.0** (~2-tile hero).
- Dev server: `npm run dev` on the project's fixed port (8081); a change is "done" only when it runs in-browser with a clean console. `npm run build` must succeed.

## Golden rules (do not violate)
1. **Always leave the game runnable.** Never break `npm run dev` or the core loop.
2. **Build one milestone at a time, in order.** Do only the milestone the user names; state its DoD result before moving on. Don't pull forward other milestones' systems.
3. **No magic numbers.** All tunable values live in `src/config.js`; gameplay code reads from config.
4. **Art never drives gameplay.** Real art enters only through the swap-point (`TEXTURE_MAP` / `ASSETS` registry); hitboxes come from **explicit physics bodies** in config, never a sprite's pixel size — fit art with origin/offset/scale. Keep the runtime placeholder generator as a fallback so missing art never breaks the game. **Build behavior-first with placeholders; drop real (incl. AI-generated) art in afterward.**
5. **Pool reused objects** (bullets, enemies, projectiles) with Phaser Groups; nothing created/destroyed in the hot path.
6. **Data-driven expansion.** New weapons/enemies/levels/upgrades should be **data rows**, not new engine code. If adding content requires touching a system, that's a design smell — flag it.
7. **Comment the non-obvious** (state machines, pooling, animation controllers, formulas). Skip trivial narration.

## Established conventions (hard-won — preserve these)
- Physics bodies are explicit per entity (`PLAYER_BODY`, `ZOMBIE_BODY`), origin at feet, decoupled from the 128px sprite.
- Animation controllers **read** state and play the matching anim; they never change movement/AI logic. Priority is explicit (death > hurt > … ), never gated solely on `anims.isPlaying`.
- Enemies use a shared FSM (PATROL→CHASE→ATTACK→RETREAT→HURT→DEAD) in `Enemy.preUpdate`; the four zombies are one behavior differing only by art. New behaviors are added via an `aiProfile` branch, not a new class.
- `corpseLinger`, directional facing, and per-frame tuning are all in config.

## Assets (`public/assets/`, served at `assets/…`)
- Player: `soldier-sprite-sheets-pixel-art/Soldier_1/`. Enemies: `urban-zombie-sprite-sheet-pixel-art-pack/Zombie_1..4/`. Terrain: `platformer-game-tileset-pixel-art/PNG/`. All 128×128 character frames / 32×32 tiles.
- **New Phase 3 enemies/bosses are AI-generated** to match the CraftPix style (see the AI Prompt Kit), built **placeholder-first** and dropped in via the swap-point.
- Do NOT load `COUPON.*`, `*.psd`, `*.url`, `Licens.txt`, the garbled `#U251c…÷2` folder, or the garbage-named `Map …tmx`.

### AI-art pipeline (PixelLab → game) — worked example: the Spitter (`ENEMIES.Spitter`, `ACID_SPITTER_BODY`)
Generate via the PixelLab MCP, then assemble + drop in through the swap-point. Hard-won gotchas:
- **Raw vs shipped.** Per-frame PixelLab PNGs land in `public/assets/ai-generated/<name>/` (git-**ignored**, regenerable). Assemble them into one horizontal `128×128` strip per state in `public/assets/<Name>/` (git-**tracked** — that's the real art). Registry rows mirror `ASSETS.player`; enemy states are `idle/walk/attack/hurt/dead` (`dead`, not `death` — `Enemy.js` plays `${type}-dead`).
- **Baseline-align on assembly.** PixelLab template anims do **not** share a ground line (e.g. `falling_backward`'s prone frames sit ~29px high) → a floating/shrunken corpse. When building the strip, shift every frame so its lowest opaque pixel lands on one baseline (the idle feet line) so all poses stay grounded.
- **Scale to ~2 tiles.** AI art often draws ~3 tiles (95px) vs the ~2-tile (67px) roster. Set a per-enemy `artScale` (Spitter: 0.78); `Enemy.spawn` calls `setScale`, and Arcade scales the **body size + offset** by it around the feet origin on the next step (so hitbox stays fitted + grounded). Spit muzzle (`GameScene.spawnAcid`) scales by `enemy.scaleY`. Body still comes from an explicit `*_BODY` const (golden rule 4), measured from the idle frame's opaque bbox.
- **Fallback stays intact.** Gate real-vs-placeholder on **texture** existence (`textures.exists`), not anim (anims register unconditionally). The blob fallback sets `this.animated = false` so the controller won't swap its texture via a registered anim.

## Project structure
```
src/
  main.js            # game config (960×540) + scene list
  config.js          # all tuning + ASSETS + animation registry + WEAPONS/ENEMIES/etc.
  animations.js      # registerAnimations()
  scenes/            # BootScene (load+register), GameScene, UIScene (HUD)
  entities/          # Player, Enemy, Bullet, Pickup (+ Phase 3: AcidProjectile, Boss, …)
docs/
  PHASE3_PLAN.md          # CURRENT phase overview
  P3.x_*.md               # per-milestone specs (active source of truth while building)
  BUILD_PHASE2_SLICE.md   # slice history · BUILD.md POC history
```

## Phaser knowledge
When unsure about a Phaser 4 API, **check docs/skills before writing it** — don't guess:
- Read the relevant Phaser `skills/` file if present in `node_modules/phaser/`; else https://docs.phaser.io + examples.
- The Filter (Vignette) and lighting APIs are already wired in `GameScene` — reuse those verified patterns.
- Pooling: `physics.add.group({ classType, maxSize, runChildUpdate:true })`; projectiles subclass `Physics.Arcade.Sprite` with a `fire()` + `preUpdate` expiry, like `Bullet`.

## Working style
- Use **Plan Mode** for each milestone: propose the plan, let the user review, then implement. Show diffs; wait for approval on destructive changes.
- After a milestone passes its DoD, remind the user to commit — each passing milestone is a git checkpoint.
- Update this file if a decision or convention changes.