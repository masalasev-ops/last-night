# Last Night — Phase 2 Slice: COMPLETE Build Plan (wired to your real assets)

> Hand this to Claude Code and run it **one milestone at a time**, in order, on a branch (`git checkout -b phase2-slice`). Keep the game runnable after every milestone; use Plan Mode; commit each pass. This plan is wired to the exact files in your `public/assets/` folder.

---

## 0. READ FIRST — global decisions

### Resolution & scale
- **Internal resolution: 960×540** (exactly 2× the POC's 480×270). Set in `src/main.js` scale config + `CONFIG`.
- **Rescale the POC tuning ×2.** Because the world is 2× bigger, multiply every *distance/speed/gravity* value from the POC by 2 as a starting point (gravity, moveSpeed, jumpVelocity, bulletSpeed, bulletRange, enemy speeds, detectionRadius, knockback, etc.), then fine-tune feel. This preserves the exact platforming feel you tuned, just at 2× scale.
- **Native art sizes:** characters are **128×128**, tiles are **32×32** → a character is **4 tiles tall**, which is the correct proportion. Draw character sprites at scale ~1.0; set the **physics body** separately (see below) — art never drives the hitbox.

### Asset serving (Vite)
Files in `public/` are served at the site root, so **load paths omit `public/`** and start with `assets/…`.

### Your asset inventory (real paths + frame data, all 128×128 frames)

**Player — use `Soldier_1`** at `assets/soldier-sprite-sheets-pixel-art/Soldier_1/`:
| Sheet | File | Frames |
|---|---|---|
| idle | `Idle.png` | 7 |
| walk | `Walk.png` | 7 |
| run | `Run.png` | 8 |
| shoot | `Shot_1.png` | 4 |
| shoot alt | `Shot_2.png` | 4 |
| reload | `Recharge.png` | 13 |
| grenade | `Grenade.png` | 9 |
| melee | `Attack.png` | 3 |
| hurt | `Hurt.png` | 3 |
| death | `Dead.png` | 4 |
| grenade blast | `Explosion.png` | 9 |

**Enemies — 4 zombies** at `assets/urban-zombie-sprite-sheet-pixel-art-pack/Zombie_{1..4}/` (files: `Idle.png Walk.png Attack.png Hurt.png Dead.png`):
| Zombie | idle | walk | attack | hurt | dead |
|---|---|---|---|---|---|
| Zombie_1 | 6 | 10 | 5 | 4 | 5 |
| Zombie_2 | 6 | 10 | 5 | 4 | 5 |
| Zombie_3 | 6 | 10 | 4 | 4 | 5 |
| Zombie_4 | 7 | 12 | 10 | 4 | 5 |

**Terrain** at `assets/platformer-game-tileset-pixel-art/PNG/`:
- Tiles: `Tileset.png` (544×384 → **32×32** tiles, 17×12 grid)
- Parallax background layers (all 960×544): `Background/x32/Skyx32.png`, `Background/x32/Clouds_x32.png`, `Background/x32/Flora1x32.png`, `Background/x32/Flora2x32.png`
- Extras: `Objects.png`, `Details.png`, `Spikes.png`, `Predator_plant.png`, `stalactites.png`, `chest.png`, `key.png`, `shinies.png`, `cave_entrance.png`
- Optional Tiled map: `TILED_files/Map.tmx` (**clean name** — use this one)

### Gotchas (avoid these)
- **Do NOT load** the Unicode-garbled folder `PNG/Background/1920x1080/#U251c#U25562/…` or the garbage-named `TILED_files/Map …tmx`. Use `PNG/Background/x32/` and `TILED_files/Map.tmx`.
- The **post-apocalypse backgrounds** pack has folders with **spaces** (`background 1/`). Not used in this slice (we use the tileset's own bg). If you use them later, URL-encode (`background%201`) or rename.
- Never load `COUPON.*`, `*.psd`, `*.url`, `Licens.txt` — those aren't game assets.

---

## 1. Config additions (target: `src/config.js`)

Add an assets/animation block. Frame counts above are authoritative.

```js
// 960x540 world; all character sheets are 128x128 frames
export const ASSETS = {
  player: {
    dir: 'assets/soldier-sprite-sheets-pixel-art/Soldier_1',
    frame: 128,
    anims: { // file, frames, fps, loop
      idle:   ['Idle.png',     7,  8, true],
      walk:   ['Walk.png',     7, 12, true],
      run:    ['Run.png',      8, 14, true],
      shoot:  ['Shot_1.png',   4, 18, false],
      reload: ['Recharge.png',13, 14, false],
      grenade:['Grenade.png',  9, 14, false],
      melee:  ['Attack.png',   3, 16, false],
      hurt:   ['Hurt.png',     3, 14, false],
      death:  ['Dead.png',     4, 10, false],
    },
  },
  zombies: {
    dir: 'assets/urban-zombie-sprite-sheet-pixel-art-pack',
    frame: 128,
    types: {
      Zombie_1: { idle:6, walk:10, attack:5,  hurt:4, dead:5 },
      Zombie_2: { idle:6, walk:10, attack:5,  hurt:4, dead:5 },
      Zombie_3: { idle:6, walk:10, attack:4,  hurt:4, dead:5 },
      Zombie_4: { idle:7, walk:12, attack:10, hurt:4, dead:5 },
    },
    fps: { idle:6, walk:10, attack:12, hurt:12, dead:8 },
  },
  tileset: 'assets/platformer-game-tileset-pixel-art/PNG/Tileset.png',
  bgLayers: [ // far → near, with parallax scroll factors
    ['assets/platformer-game-tileset-pixel-art/PNG/Background/x32/Skyx32.png',    0.10],
    ['assets/platformer-game-tileset-pixel-art/PNG/Background/x32/Clouds_x32.png',0.25],
    ['assets/platformer-game-tileset-pixel-art/PNG/Background/x32/Flora2x32.png', 0.45],
    ['assets/platformer-game-tileset-pixel-art/PNG/Background/x32/Flora1x32.png', 0.70],
  ],
};

// Player physics body is set explicitly — NOT the 128px sprite size.
// Start: body ~40 wide x ~104 tall, origin at feet; tune to the art.
export const PLAYER_BODY = { width: 40, height: 104, originX: 0.5, originY: 1.0 };
```

Also: **multiply the existing POC tuning values by 2** (gravity, moveSpeed, sprintMultiplier stays, jumpVelocity, coyote/buffer stay as times, bulletSpeed, bulletRange, knockback, enemy moveSpeed/chaseSpeed/detectionRadius/attackRange). Keep the sub-keyed shake config from Step 7.

---

## 2. Milestones

### L0 — Resolution, preload, animation pipeline
- Set internal resolution to **960×540** in `main.js` + `CONFIG`; keep pixelArt/nearest scaling.
- Multiply POC distance/speed/gravity tuning ×2 (per §0).
- Add a `PreloadScene` (or extend `BootScene`) that loads every sheet in `ASSETS` with `this.load.spritesheet(key, path, { frameWidth:128, frameHeight:128 })`, the tileset image, and the bg layers.
- Build an **animation registry** helper that creates Phaser anims from `ASSETS.player.anims` and each zombie type, using the exact frame counts/fps above.
- Keep the placeholder-texture fallback so any not-yet-wired entity still renders.

**DoD:** game runs at 960×540; all sheets + tileset + bg load with a clean console; animations are registered (verify by listing them); placeholder fallback intact.

### L1 — The gunman (Soldier_1), real & animated
- Point the player at the Soldier_1 sheets; set the physics body to `PLAYER_BODY` (decoupled from the 128px sprite; origin at feet).
- Add an **animation controller** that maps existing player state → animation: in-air→`jump`/`fall` (use `idle` if no jump frames — this pack has none, so use `idle` airborne or hold last `run` frame), grounded moving→`run`, firing→`shoot`, reloading→`reload`, grenade→`grenade`, melee→`melee`, hit→`hurt`, dead→`death`, else `idle`. **Do not change movement/shoot/jump logic** — only read state.
- **Muzzle offset:** spawn bullets from the gun tip — offset ~ (facing * 46, -30) from the body center — not the body origin.
- **Facing follows the mouse** (aim direction), so the gun points at the cursor; flipX accordingly.

**DoD:** player is the animated soldier; every state plays the right animation; bullets emit from the gun toward the cursor; jump/shoot/reload feel identical to the POC (at 2× scale); hitbox is the explicit body, not the sprite.

### L2 — Forest level: parallax background + ground collision
- **Background:** add the 4 `bgLayers` as `tileSprite`s pinned to the camera, each with its parallax `scrollFactor`. Align to the bottom of the 960×540 view.
- **Terrain/collision:** build the level from `Tileset.png` (32×32). Two acceptable approaches — pick whichever gets a solid, playable forest fastest:
  1. **Preferred:** a Phaser tilemap. If you use the provided `TILED_files/Map.tmx`, first export it to **JSON** in Tiled (Phaser loads Tiled JSON, not raw `.tmx`) and fix the tileset image path to `Tileset.png`; build the collision layer from it.
  2. **Fallback (keep momentum):** author a simple level layout in code (a 2D array or the POC's data-driven platform rectangles) and render `Tileset.png` tiles on it. A playable, correctly-colliding forest beats a perfect Tiled pipeline.
- Make it several screens wide with a clear end marker; keep spawn/enemy/item positions as data.

**DoD:** a forest level with a scrolling multi-layer parallax background; the player stands and jumps on real tileset ground; traversable start→end; camera follow + bounds work; 60 FPS.

### L3 — Zombies (4 types) via the existing FSM
- Point enemy sprites at the zombie sheets; drive them through the **existing FSM**: PATROL/CHASE→`walk`, ATTACK→`attack`, HURT→`hurt`, DEAD→`dead`, idle→`idle`. Set each enemy's body explicitly (similar to the player, tuned to the zombie art).
- Spawn a mix of the 4 zombie types from level data (each a data entry choosing a `Zombie_N` sheet). Retune blood/impact particle color/size to the new scale.

**DoD:** 4 zombie types patrol, chase, attack (damage player), take bullet damage, hurt-flash, and die with correct animations; combat reads clearly; 60 FPS with a realistic group.

### L4 — Atmosphere + HUD
- **Re-enable the vignette + player light** currently commented out in `GameScene.js` (consult the Phaser 4 filter/light docs for exact APIs; if the internal-filter path is unavailable, use a camera-following dark radial overlay). Add a flashlight cone and a light fog particle layer suited to a forest.
- Upgrade the HUD (health + ammo + current-weapon text is fine for the slice; a bar is a bonus).

**DoD:** the forest reads as dark and moody at night; vignette/light/fog render cleanly; HUD shows live health + ammo; 60 FPS.

### L5 — Assembly & polish
- Add one pickup (medkit or ammo) from level data using a tileset collectible (`shinies.png`/`chest.png`), a short intro beat, and a level-complete state (reuse POC win/restart).
- Playtest with debug **off**; fix soft-locks; confirm 60 FPS; update `README.md` + `PROGRESS.md`.

**DoD:** a fresh player completes the forest level start→finish — animated gunman, 4 zombie types, a pickup, atmosphere, HUD, clean win — 60 FPS, clean console. **This is "one terrain working."**

---

## 3. What's missing / optional (not blocking the slice)
- **Pixel font** — you don't have a game font yet (`Font.txt` only names one). The slice can use the default text; for the pixel look, drop a free font (Press Start 2P / m5x7) into `public/assets/fonts/` later.
- **UI/HUD art pack** — optional; text HUD works. Add a CraftPix free GUI pack when you want a real health bar.
- **Weapon / item icons** — optional; use tileset collectibles for pickups now.
- **Audio** — deferred (SFX/music come in full Phase 2).
- **Tiled JSON** — only needed if you take L2 approach #1; export `Map.tmx`→JSON in Tiled.
- **Boss & other biomes** — Phase 3.

Everything required to build and play the forest slice is present in your `public/assets/`.

---

## 4. How to run it
1. `git checkout -b phase2-slice`
2. Open Claude Code. First prompt:
   > "Read `CLAUDE.md` and this build plan. Using Plan Mode, plan **L0** only. Don't code yet — show the plan."
3. Review, approve, let it build; keep `npm run dev` running and playtest against L0's DoD.
4. Commit (`git add -A && git commit -m "L0: resolution + asset pipeline"`), then "Now L1," and so on through L5.
5. Send me each plan if you want it checked before it builds.

### Reminder to the agent
Keep gun mechanics intact. Art enters only through the animation registry and explicit physics bodies — never by changing gameplay values. Ship a playable forest, one milestone at a time.
