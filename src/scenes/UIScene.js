import { Scene } from 'phaser';
import { CONFIG } from '../config.js';
import { runState } from '../runState.js';

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

    // --- Boss bar (P3.7): a wide top-centred bar, hidden until a boss fight. Mirrors the health bar (border +
    // bg + fill shrinking left→right via scaleX). showBossBar/hideBossBar toggle it; update() drives the fill. ---
    const bbw = 520, bbh = 18, bbx = (width - bbw) / 2, bby = 22;
    this.bossBarBorder = this.add.rectangle(bbx - 3, bby - 3, bbw + 6, bbh + 6, 0x101014).setOrigin(0, 0).setDepth(20).setVisible(false);
    this.bossBarBg = this.add.rectangle(bbx, bby, bbw, bbh, 0x2a0a10).setOrigin(0, 0).setDepth(20).setVisible(false);
    this.bossFill = this.add.rectangle(bbx, bby, bbw, bbh, 0x9a2a3a).setOrigin(0, 0).setDepth(20).setVisible(false);
    this.bossName = this.add
      .text(width / 2, bby + bbh + 4, '', { fontFamily: hud.font.family, fontSize: 13, color: '#e8c8cc' })
      .setOrigin(0.5, 0).setStroke(hud.stroke.color, hud.stroke.thickness).setDepth(20).setVisible(false);
    this.boss = null;

    // --- Ammo + weapon, below the bar (dark outline so they read over the bright forest) ---
    this.ammoText = this.add
      .text(b.x, b.y + b.h + 6, '', {
        fontFamily: hud.font.family,
        fontSize: hud.font.size,
        color: hud.font.color,
      })
      .setStroke(hud.stroke.color, hud.stroke.thickness);
    // Weapon label — text placeholder for the reserved HUD weapon-icon slot (real ~32px icon is a
    // later art drop). Initialised to the default weapon; update() sets it live from the active weapon.
    this.weaponText = this.add
      .text(b.x, b.y + b.h + 6 + hud.font.size + 4, CONFIG.WEAPONS[CONFIG.defaultWeaponId].name, {
        fontFamily: hud.font.family,
        fontSize: hud.font.size - 2,
        color: '#9aa0ac',
      })
      .setStroke(hud.stroke.color, hud.stroke.thickness);

    // --- Salvage counter (P3.3): the run currency, read live from RunState each frame. Gold to match
    // the floating "+N" kill feedback; sits just below the weapon label. ---
    this.salvageText = this.add
      .text(b.x, b.y + b.h + 6 + (hud.font.size + 4) * 2, '', {
        fontFamily: hud.font.family,
        fontSize: hud.font.size - 2,
        color: '#ffd27f',
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

    this.showIntro();

    // Boss arena (P3.7): GameScene sets its `boss` before UIScene's deferred create() runs, so show the bar
    // now — this is what re-shows it after a boss-arena death-restart (UI is stopped + relaunched each create).
    const gs = this.scene.get('Game');
    if (gs && gs.boss) this.showBossBar(gs.boss);

    console.log('[UIScene] ready');
  }

  /** Reveal + bind the boss bar to a boss (called by GameScene / this.create when a boss arena loads). */
  showBossBar(boss) {
    this.boss = boss;
    this.bossName.setText(boss.barName ?? 'BOSS');
    this.bossFill.setFillStyle(boss.barColor ?? 0x9a2a3a);
    [this.bossBarBorder, this.bossBarBg, this.bossFill, this.bossName].forEach((o) => o.setVisible(true));
  }

  /** Hide + unbind the boss bar (called from onBossDefeated). */
  hideBossBar() {
    this.boss = null;
    [this.bossBarBorder, this.bossBarBg, this.bossFill, this.bossName].forEach((o) => o && o.setVisible(false));
  }

  /**
   * Intro beat (L5): a non-blocking title card shown on level start — title + subtitle centred,
   * held for intro.holdMs, then faded out over intro.fadeMs and destroyed. Separate from statusText
   * so the win/death overlays are unaffected. Re-shown on restart (fresh run).
   */
  showIntro() {
    const { intro, width, height, hud } = CONFIG;
    // Per-level subtitle (P3.6): read the level the cursor points at, same resolution GameScene uses;
    // fall back to the global intro.subtitle for any level that doesn't set one.
    const level = CONFIG.LEVELS[runState.levelIndex] ?? CONFIG.LEVELS[1];
    const subtitleText = level.subtitle ?? intro.subtitle;
    const mk = (y, size, text, color) =>
      this.add
        .text(width / 2, y, text, { fontFamily: hud.font.family, fontSize: size, color, align: 'center' })
        .setOrigin(0.5)
        .setStroke(hud.stroke.color, hud.stroke.thickness + 1)
        .setDepth(10);
    const title = mk(height / 2 - 24, 40, intro.title, '#e8e8e8');
    const subtitle = mk(height / 2 + 20, 16, subtitleText, '#9aa0ac');

    this.time.delayedCall(intro.holdMs, () => {
      this.tweens.add({
        targets: [title, subtitle],
        alpha: 0,
        duration: intro.fadeMs,
        onComplete: () => { title.destroy(); subtitle.destroy(); },
      });
    });
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

    // Salvage counter (P3.3) — live from RunState
    this.salvageText.setText(`SALVAGE ${runState.salvage}`);

    // Boss bar (P3.7) — fill = boss HP fraction; shown only while bound. Updates through the death sequence
    // (health 0 → empty) until onBossDefeated calls hideBossBar.
    if (this.boss) {
      this.bossFill.scaleX = Math.max(0, Math.min(1, this.boss.health / this.boss.maxHealth));
    }

    // Death overlay. (Win no longer shows here — level-complete transitions straight to the ShopScene,
    // which stops this UI, so a "YOU MADE IT" branch would be unreachable.)
    if (player.dead) {
      this.statusText.setText('YOU DIED\nPress R to restart').setVisible(true);
      this.ammoText.setText('');
      return;
    }
    this.statusText.setVisible(false);

    // Weapon + ammo / reload — all read LIVE from the active weapon so they update on a switch.
    const weapon = player.weapon;
    this.weaponText.setText(weapon.name);
    const mag = player.ammo[player.currentWeaponId];
    this.ammoText.setText(
      player.reloading ? `RELOADING ${player.reloadTimer.toFixed(1)}s` : `AMMO ${mag} / ${weapon.magSize}`,
    );
  }
}
