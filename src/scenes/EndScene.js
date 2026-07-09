import { Scene } from 'phaser';
import { CONFIG } from '../config.js';

/**
 * EndScene (P3.6) — the minimal "to be continued" placeholder reached from the shop after clearing the last
 * level of Chapter 1 (a level whose `nextLevelId` is `null`). Text-only, mirrors the Title styling, carries
 * NO HUD (the P3.3 rule: only GameScene launches the UI overlay). This is the exact seam P3.7 replaces —
 * clearing the final level will route to the boss/victory flow instead of here.
 */
export class EndScene extends Scene {
  constructor() {
    super('End');
  }

  create() {
    const { width, height } = CONFIG;

    this.add.rectangle(0, 0, width, height, 0x0a0a0f, 1).setOrigin(0, 0);

    this.f = CONFIG.hud.font.family;
    this.stroke = CONFIG.hud.stroke;

    this.mkText(width / 2, height * 0.34, 'CHAPTER 1', 44, '#e8e8e8').setOrigin(0.5);
    this.mkText(width / 2, height * 0.34 + 46, 'to be continued…', 20, '#8a8f9a').setOrigin(0.5);
    this.mkText(width / 2, height * 0.34 + 78, 'You survived the night. The ruins hold more — soon.', 13, '#5a6070').setOrigin(0.5);

    // Back to Title (the run's save is left intact — Continue still lands on the cleared shop).
    const back = this.mkText(width / 2, height * 0.72, 'Back to Title', 22, '#3ad06a').setOrigin(0.5);
    back.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.scene.start('Title'));

    console.log('[EndScene] ready');
  }

  /** Small helper: a stroked text in the HUD font (mirrors Title/Shop). */
  mkText(x, y, text, size, color) {
    return this.add
      .text(x, y, text, { fontFamily: this.f, fontSize: size, color })
      .setStroke(this.stroke.color, this.stroke.thickness);
  }
}
