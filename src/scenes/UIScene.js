import { Scene } from 'phaser';
import { CONFIG } from '../config.js';

/**
 * UIScene — HUD overlay rendered above GameScene.
 * Health, ammo, and status text. Fixed to the camera (no scrolling).
 *
 * Step 3: live ammo counter + reload indicator.
 * Step 6 will add health and win/lose state.
 */
export class UIScene extends Scene {
  constructor() {
    super('UI');
  }

  create() {
    const { palette } = CONFIG;

    this.ammoText = this.add.text(4, 2, '', {
      fontFamily: 'monospace',
      fontSize: 8,
      color: palette.hudText,
    });

    // Debug overlay — hidden by default, shown when GameScene.debugOn is true.
    // Pinned to the bottom of the view; reads CONFIG.height so it tracks the resolution.
    this.debugText = this.add.text(4, CONFIG.height - 18, '', {
      fontFamily: 'monospace',
      fontSize: 7,
      color: '#88ff88',
    });
    this.debugText.setVisible(false);

    console.log('[UIScene] ready');
  }

  /** Called every frame — reads live player state from GameScene. */
  update() {
    const gameScene = this.scene.get('Game');
    if (!gameScene || !gameScene.player) return;

    const player = gameScene.player;

    // --- Debug overlay (FPS + entity counts) ---
    if (gameScene.debugOn) {
      const fps = Math.round(this.game.loop.actualFps);
      const activeBullets = gameScene.bullets.countActive(true);
      const activeEnemies = gameScene.enemies.countActive(true);
      this.debugText.setText(`FPS: ${fps} | Bullets: ${activeBullets} | Enemies: ${activeEnemies} | GOD`);
      this.debugText.setVisible(true);
    } else {
      this.debugText.setVisible(false);
    }

    // Win screen
    if (player.won) {
      this.ammoText.setText('You made it — press R to replay');
      return;
    }

    // Death screen overrides normal HUD
    if (player.dead) {
      this.ammoText.setText('YOU DIED\nPress R to restart');
      return;
    }

    const { magSize } = CONFIG.pistol;

    let ammoLine;
    if (player.reloading) {
      ammoLine = `RELOADING... ${player.reloadTimer.toFixed(1)}s`;
    } else {
      ammoLine = `AMMO: ${player.ammo} / ${magSize}`;
    }

    this.ammoText.setText(`HP: ${player.health}\n${ammoLine}`);
  }
}
