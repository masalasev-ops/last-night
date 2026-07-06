import { Scene } from 'phaser';
import { CONFIG, ASSETS } from '../config.js';
import { registerAnimations } from '../animations.js';

/** Convert a CSS hex string like '#7fb0c8' to a Phaser integer 0x7fb0c8. */
const hexToInt = (hex) => parseInt(hex.replace('#', ''), 16);

/** Capitalize a state name into its sheet filename stem (idle → Idle). */
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * BootScene — runs once at startup.
 * preload() loads the real Phase-2 spritesheets/tileset/backgrounds; create()
 * generates the placeholder textures (the fallback for any entity whose real art
 * isn't wired yet), registers all animations, then launches GameScene + UIScene.
 *
 * Per §6 of the build spec, this is the single place where placeholder visuals are
 * created and real art is loaded. Gameplay logic swaps between them via TEXTURE_MAP.
 */
export class BootScene extends Scene {
  constructor() {
    super('Boot');
  }

  /**
   * Load every real spritesheet named in the ASSETS registry, plus the tileset and
   * parallax backgrounds. Each character sheet is a 128×128-frame spritesheet; the
   * texture key matches the animation key it will feed (e.g. 'player-idle').
   */
  preload() {
    // Player — 9 state sheets (128×128 frames)
    const P = ASSETS.player;
    for (const [state, [file]] of Object.entries(P.anims)) {
      this.load.spritesheet(`player-${state}`, `${P.dir}/${file}`, {
        frameWidth: P.frame,
        frameHeight: P.frame,
      });
    }

    // Zombies — 4 types × 5 states; filename is the capitalized state (idle → Idle.png)
    const Z = ASSETS.zombies;
    for (const [type, counts] of Object.entries(Z.types)) {
      for (const state of Object.keys(counts)) {
        this.load.spritesheet(`${type}-${state}`, `${Z.dir}/${type}/${cap(state)}.png`, {
          frameWidth: Z.frame,
          frameHeight: Z.frame,
        });
      }
    }

    // Pickup collectibles (L5) — chest.png is a 6-frame 64×64 shimmer sheet
    const chest = ASSETS.pickups.chest;
    this.load.spritesheet('pickup-chest', chest.path, { frameWidth: chest.frame, frameHeight: chest.frame });

    // Terrain tileset (image for now; L2 decides tilemap vs. manual tiling)
    this.load.image('tileset', ASSETS.tileset);

    // Parallax background layers, keyed by index (far → near)
    ASSETS.bgLayers.forEach(([path], i) => this.load.image(`bg-layer-${i}`, path));
  }

  create() {
    this.generatePlaceholders();
    this.generateLightTextures();
    registerAnimations(this);

    // DoD verification: confirm every animation registered (9 player + 20 zombie + 1 pickup = 30)
    console.log(
      `[BootScene] Animations registered: ${this.anims.anims.size} →`,
      [...this.anims.anims.keys()],
    );

    this.scene.start('Game');
    this.scene.launch('UI'); // overlay — runs above GameScene
  }

  /**
   * Generate every placeholder texture the game needs.
   * Each uses this.make.graphics() → generateTexture(key, w, h).
   * The palette comes from CONFIG.palette.
   */
  generatePlaceholders() {
    const { palette, placeholder } = CONFIG;

    // --- Player (12×20 rectangle with a small facing nub) ---
    let g = this.make.graphics({ x: 0, y: 0, add: false });
    const p = placeholder.PLAYER;
    g.fillStyle(hexToInt(palette.player), 1);
    g.fillRect(0, 0, p.width, p.height);
    // Facing nub — small lighter rectangle on the right edge so aim direction is readable
    g.fillStyle(0xffffff, 0.7);
    g.fillRect(p.width - 2, Math.floor(p.height * 0.3), 3, Math.floor(p.height * 0.4));
    g.generateTexture(p.key, p.width, p.height);
    g.destroy();

    // --- Enemy (12×16 rectangle) ---
    g = this.make.graphics({ x: 0, y: 0, add: false });
    const e = placeholder.ENEMY;
    g.fillStyle(hexToInt(palette.enemy), 1);
    g.fillRect(0, 0, e.width, e.height);
    g.generateTexture(e.key, e.width, e.height);
    g.destroy();

    // --- Bullet (3×2 small rectangle) ---
    g = this.make.graphics({ x: 0, y: 0, add: false });
    const b = placeholder.BULLET;
    g.fillStyle(hexToInt(palette.bullet), 1);
    g.fillRect(0, 0, b.width, b.height);
    g.generateTexture(b.key, b.width, b.height);
    g.destroy();

    // --- 1×1 white pixel (for tinted rectangles like floors/platforms) ---
    g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0xffffff, 1);
    g.fillRect(0, 0, 1, 1);
    g.generateTexture('__WHITE', 1, 1);
    g.destroy();

    // --- Particle textures (8×8 squares — sized for the 960×540 scale) ---
    // Muzzle flash — bright yellow-white
    g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(hexToInt(palette.muzzle), 1);
    g.fillRect(0, 0, 8, 8);
    g.generateTexture('__PARTICLE_MUZZLE', 8, 8);
    g.destroy();

    // Bullet impact — bright white
    g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(hexToInt(palette.bullet), 1);
    g.fillRect(0, 0, 8, 8);
    g.generateTexture('__PARTICLE_IMPACT', 8, 8);
    g.destroy();

    // Blood — dark red
    g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(hexToInt(palette.blood), 1);
    g.fillRect(0, 0, 8, 8);
    g.generateTexture('__PARTICLE_BLOOD', 8, 8);
    g.destroy();

    // --- Pickup fallback (L5): a green medic box with a white cross (used if chest art is missing) ---
    g = this.make.graphics({ x: 0, y: 0, add: false });
    const pk = placeholder.PICKUP;
    g.fillStyle(0x2f9e44, 1);
    g.fillRect(0, 0, pk.width, pk.height);
    g.fillStyle(0xffffff, 1);
    const cx = pk.width / 2, cy = pk.height / 2, arm = pk.width * 0.3, thick = pk.width * 0.16;
    g.fillRect(cx - thick / 2, cy - arm, thick, arm * 2); // vertical bar
    g.fillRect(cx - arm, cy - thick / 2, arm * 2, thick); // horizontal bar
    g.generateTexture(pk.key, pk.width, pk.height);
    g.destroy();

    // --- Health-cross marker (L5): floats above the chest so it reads as HEALTH, not generic loot ---
    g = this.make.graphics({ x: 0, y: 0, add: false });
    const S = 18, t = 6; // marker size, cross-bar thickness
    g.fillStyle(0x0a0a0f, 1); // dark outline for contrast on any background
    g.fillRect(S / 2 - t / 2 - 2, 0, t + 4, S);
    g.fillRect(0, S / 2 - t / 2 - 2, S, t + 4);
    g.fillStyle(0x3ad06a, 1); // bright green cross
    g.fillRect(S / 2 - t / 2, 2, t, S - 4);
    g.fillRect(2, S / 2 - t / 2, S - 4, t);
    g.generateTexture('__HEALTH_CROSS', S, S);
    g.destroy();

    console.log('[BootScene] Placeholder textures generated.');
  }

  /**
   * Generate soft light/fog textures from canvas gradients. Their ALPHA gradients let the
   * GameScene darkness overlay ERASE them into soft holes:
   *   __LIGHT_RADIAL — ambient body glow (opaque centre → transparent edge)
   *   __LIGHT_CONE   — gun flashlight, apex at left-centre, fanning right (blurred soft edges)
   *   __FOG          — a soft drifting puff
   */
  generateLightTextures() {
    // Ambient radial glow
    const R = 256;
    let ct = this.textures.createCanvas('__LIGHT_RADIAL', R, R);
    let cx = ct.context;
    let g = cx.createRadialGradient(R / 2, R / 2, 0, R / 2, R / 2, R / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.55, 'rgba(255,255,255,0.5)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    cx.fillStyle = g;
    cx.fillRect(0, 0, R, R);
    ct.refresh();

    // Flashlight cone — apex at (0, C/2), radial falloff from the apex, clipped to a wedge
    const C = 256, apexY = C / 2, half = Math.tan((24 * Math.PI) / 180) * C;
    ct = this.textures.createCanvas('__LIGHT_CONE', C, C);
    cx = ct.context;
    g = cx.createRadialGradient(0, apexY, 0, 0, apexY, C);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    cx.filter = 'blur(6px)'; // soften the wedge edges
    cx.fillStyle = g;
    cx.beginPath();
    cx.moveTo(0, apexY);
    cx.lineTo(C, apexY - half);
    cx.lineTo(C, apexY + half);
    cx.closePath();
    cx.fill();
    cx.filter = 'none';
    ct.refresh();

    // Fog puff — soft blue-grey blob
    const F = 128;
    ct = this.textures.createCanvas('__FOG', F, F);
    cx = ct.context;
    g = cx.createRadialGradient(F / 2, F / 2, 0, F / 2, F / 2, F / 2);
    g.addColorStop(0, 'rgba(200,210,225,0.9)');
    g.addColorStop(1, 'rgba(200,210,225,0)');
    cx.fillStyle = g;
    cx.fillRect(0, 0, F, F);
    ct.refresh();

    console.log('[BootScene] Light/fog textures generated.');
  }
}
