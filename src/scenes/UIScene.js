import { Scene } from 'phaser';
import { CONFIG } from '../config.js';

/**
 * UIScene — HUD overlay rendered above GameScene (and above its darkness overlay, so the HUD
 * stays bright). Shows a health bar, ammo, and the current weapon; plus win/death/reload
 * states and the debug readout. All positions/sizes/colours/fonts come from CONFIG.hud.
 */
export class UIScene extends Scene {
  constructor() {
    super('UI');
  }

  create() {
    const { hud, playerMaxHealth, width, height } = CONFIG;
    const b = hud.bar;
    this.maxHealth = playerMaxHealth;

    // --- Health bar: border + dark bg + fill (fill shrinks left→right via scaleX) ---
    this.add.rectangle(b.x - 2, b.y - 2, b.w + 4, b.h + 4, b.border).setOrigin(0, 0);
    this.add.rectangle(b.x, b.y, b.w, b.h, b.bg).setOrigin(0, 0);
    this.healthFill = this.add.rectangle(b.x, b.y, b.w, b.h, b.fill).setOrigin(0, 0);
    this.hpLabel = this.add
      .text(b.x + 6, b.y + b.h / 2, '', { fontFamily: hud.font.family, fontSize: hud.font.size - 3, color: '#0a0a0a' })
      .setOrigin(0, 0.5);

    // --- Ammo + weapon, below the bar (dark outline so they read over the bright forest) ---
    this.ammoText = this.add
      .text(b.x, b.y + b.h + 6, '', {
        fontFamily: hud.font.family,
        fontSize: hud.font.size,
        color: hud.font.color,
      })
      .setStroke(hud.stroke.color, hud.stroke.thickness);
    this.weaponText = this.add
      .text(b.x, b.y + b.h + 6 + hud.font.size + 4, CONFIG.weapon.name, {
        fontFamily: hud.font.family,
        fontSize: hud.font.size - 2,
        color: '#9aa0ac',
      })
      .setStroke(hud.stroke.color, hud.stroke.thickness);

    // --- Big centred status (win / death) ---
    this.statusText = this.add
      .text(width / 2, height / 2, '', { fontFamily: hud.font.family, fontSize: 28, color: '#e8e8e8', align: 'center' })
      .setOrigin(0.5)
      .setStroke(hud.stroke.color, hud.stroke.thickness + 1)
      .setVisible(false);

    // --- Debug overlay (bottom) ---
    this.debugText = this.add.text(4, height - 20, '', {
      fontFamily: hud.debugFont.family,
      fontSize: hud.debugFont.size,
      color: hud.debugFont.color,
    });
    this.debugText.setVisible(false);

    console.log('[UIScene] ready');
  }

  /** Called every frame — reads live player state from GameScene. */
  update() {
    const gameScene = this.scene.get('Game');
    if (!gameScene || !gameScene.player) return;

    const player = gameScene.player;
    const b = CONFIG.hud.bar;

    // Debug readout
    if (gameScene.debugOn) {
      const fps = Math.round(this.game.loop.actualFps);
      const bullets = gameScene.bullets.countActive(true);
      const enemies = gameScene.enemies.countActive(true);
      this.debugText.setText(`FPS: ${fps} | Bullets: ${bullets} | Enemies: ${enemies} | GOD`).setVisible(true);
    } else {
      this.debugText.setVisible(false);
    }

    // Health bar — scaleX from origin (0,0) shrinks it left→right; reddens when low
    const pct = Math.max(0, Math.min(1, player.health / this.maxHealth));
    this.healthFill.scaleX = pct;
    this.healthFill.setFillStyle(pct <= b.lowPct ? b.low : b.fill);
    this.hpLabel.setText(`HP ${Math.max(0, Math.round(player.health))}`);

    // Win / death overlays
    if (player.won) {
      this.statusText.setText('YOU MADE IT\nPress R to replay').setVisible(true);
      this.ammoText.setText('');
      return;
    }
    if (player.dead) {
      this.statusText.setText('YOU DIED\nPress R to restart').setVisible(true);
      this.ammoText.setText('');
      return;
    }
    this.statusText.setVisible(false);

    // Ammo / reload
    const { magSize } = CONFIG.weapon;
    this.ammoText.setText(
      player.reloading ? `RELOADING ${player.reloadTimer.toFixed(1)}s` : `AMMO ${player.ammo} / ${magSize}`,
    );
  }
}
