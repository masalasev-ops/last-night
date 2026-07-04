import { Scene } from 'phaser';
import { CONFIG } from '../config.js';

/** Convert a CSS hex string like '#7fb0c8' to a Phaser integer 0x7fb0c8. */
const hexToInt = (hex) => parseInt(hex.replace('#', ''), 16);

/**
 * BootScene — runs once at startup.
 * Generates all placeholder textures from code (no external assets),
 * then launches GameScene + UIScene.
 *
 * Per §6 of the build spec, this is the single place where placeholder
 * visuals are created. Real art will replace these later without touching
 * game logic — just swap the texture keys.
 */
export class BootScene extends Scene {
  constructor() {
    super('Boot');
  }

  create() {
    this.generatePlaceholders();
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

    // --- Particle textures (4×4 squares in palette colors) ---
    // Muzzle flash — bright yellow-white
    g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(hexToInt(palette.muzzle), 1);
    g.fillRect(0, 0, 4, 4);
    g.generateTexture('__PARTICLE_MUZZLE', 4, 4);
    g.destroy();

    // Bullet impact — bright white
    g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(hexToInt(palette.bullet), 1);
    g.fillRect(0, 0, 4, 4);
    g.generateTexture('__PARTICLE_IMPACT', 4, 4);
    g.destroy();

    // Blood — dark red
    g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(hexToInt(palette.blood), 1);
    g.fillRect(0, 0, 4, 4);
    g.generateTexture('__PARTICLE_BLOOD', 4, 4);
    g.destroy();

    console.log('[BootScene] Placeholder textures generated.');
  }
}
