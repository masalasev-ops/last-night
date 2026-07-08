# Last Night

A dark, atmospheric 2D side-scrolling action shooter for the browser. Built with **Phaser 4** +
**Vite** (JavaScript, ES modules, Arcade Physics).

Phase 2 is a **one-level vertical slice**: a complete, playable **forest level** — a gun-wielding
soldier fights four zombie types across a parallax forest, grabs a health pickup, and reaches the
far side. Internal resolution **960×540**; real CraftPix pixel art throughout.

## Play

```bash
npm install
npm run dev      # dev server with hot-reload → http://localhost:8081
npm run build    # production build → dist/
```

Open the URL the dev server prints (fixed port **8081**).

### Controls

| Input | Action |
|-------|--------|
| `A` / `D` (or `←` / `→`) | Move left / right |
| `Shift` | Sprint |
| `W` / `↑` / `Space` | Jump (through one-way platforms; land on top) |
| Mouse | Aim |
| Left mouse | Fire the equipped weapon (hold to fire auto weapons; click per shell for the shotgun) |
| `1` / `2` / `3` | Switch weapon — Rifle / Shotgun / SMG (each keeps its own ammo) |
| `R` | Reload the active weapon — and restart after a win/death |
| `` ` `` (backtick) | Toggle debug overlay (FPS, physics bodies, god mode; right-click spawns a zombie) |

Reach the marker on the far right to win. Zombies chase and attack on the ground; jump onto a
platform they can't reach and they back off toward where they came from.

## Project structure

```
src/
  main.js            # Phaser game config (960×540) + scene list
  config.js          # ALL tuning + ASSETS paths + TEXTURE_MAP swap-point
  animations.js      # builds every animation from the ASSETS registry
  scenes/
    BootScene.js     # load real art + generate placeholder/light textures, register anims
    GameScene.js     # level, player, enemies, bullets, pickups, camera, atmosphere
    UIScene.js       # HUD overlay (health bar, ammo, weapon) + intro/win/death cards
  entities/
    Player.js        # animated soldier + animation controller
    Enemy.js         # 5-state zombie FSM (patrol/chase/attack/hurt/retreat + dead)
    Bullet.js        # pooled projectile
    Pickup.js        # health chest
docs/
  BUILD_PHASE2_SLICE.md   # milestone plan (L0–L5) — source of truth
  BUILD.md                # completed POC spec (history)
public/assets/       # CraftPix art packs (soldier, zombies, tileset, backgrounds)
```

## Conventions

- **No magic numbers** — all tuning lives in `src/config.js`; gameplay code reads from it.
- **Art never drives gameplay** — hitboxes are explicit physics bodies (`PLAYER_BODY`, `ZOMBIE_BODY`,
  `pickup.body`); art is fitted with origin/offset/scale only. Real art enters through the
  `TEXTURE_MAP` swap-point, with generated placeholder textures as a fallback.
- **Pooling** — bullets and enemies are pooled via Phaser Groups.
- **Atmosphere** — a light night tint + vignette + player glow/flashlight, tunable via
  `config.atmosphere` (master `enabled` flag). Kept bright enough that the forest and enemies stay
  clearly visible.

See `PROGRESS.md` for the milestone log.

---

*Bootstrapped from the [Phaser + Vite template](https://github.com/phaserjs/template-vite). The
`npm run *-nolog` variants skip the template's anonymous build ping.*
