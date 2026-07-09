import { Scene } from 'phaser';
import { CONFIG } from '../config.js';
import { runState } from '../runState.js';

/**
 * TitleScene (P3.5) — the run's entry point, replacing Boot's old auto-start into Game. A minimal TEXT
 * menu (placeholder-first; the real title screen is P3.8, same routing):
 *   • New Game (always) — wipes any save, reset()s the run, starts Level 1.
 *   • Continue (only when a valid save exists) — resumes the saved run; its label names the checkpoint
 *     it will land on (Level N, or the Shop after clearing Level N), peeked from disk without a full load.
 *
 * It's the CONFIRMED entry point, not auto-Continue: Boot routes here and the player chooses. Carries no
 * HUD — the P3.3 rule holds (only GameScene.create() launches the UI overlay).
 */
export class TitleScene extends Scene {
  constructor() {
    super('Title');
  }

  create() {
    const { width, height } = CONFIG;

    // Dark backdrop — matches the Shop's text-screen look
    this.add.rectangle(0, 0, width, height, 0x0a0a0f, 1).setOrigin(0, 0);

    this.f = CONFIG.hud.font.family;
    this.stroke = CONFIG.hud.stroke;

    this.mkText(width / 2, height * 0.30, 'LAST NIGHT', 48, '#e8e8e8').setOrigin(0.5);
    this.mkText(width / 2, height * 0.30 + 44, 'Chapter 1', 16, '#6a7280').setOrigin(0.5);

    let y = height * 0.58;

    // Continue — only if a valid save exists; its label names what it resumes (peek, no full load).
    const peek = runState.peekSave();
    if (runState.hasSave() && peek) {
      const label =
        peek.phase === 'shop'
          ? `Continue — Shop (Level ${peek.levelIndex} cleared)`
          : `Continue — Level ${peek.levelIndex}`;
      this.mkButton(width / 2, y, label, '#3ad06a', () => this.onContinue());
      y += 48;
    }

    // New Game — always present.
    this.mkButton(width / 2, y, 'New Game', '#d6dae2', () => this.onNewGame());
    y += 48;

    // Erase Save — only when a save exists. A two-click confirm (onErase) guards against an accidental wipe.
    if (runState.hasSave()) {
      this._eraseBtn = this.mkButton(width / 2, y, 'Erase Save', '#a86a6a', () => this.onErase());
      this.mkText(width / 2, y + 22, 'deletes your saved progress', 11, '#5a5a66').setOrigin(0.5);
    }

    console.log('[TitleScene] ready');
  }

  /** Two-step erase: first click arms the confirm, second wipes ALL saves + re-renders the menu (the
   * Continue + Erase buttons vanish, which is the visible proof it worked). */
  onErase() {
    if (!this._armed) {
      this._armed = true;
      this._eraseBtn.setText('Erase Save? — click again to confirm').setColor('#e5484d');
      return;
    }
    runState.clearAllSaves();
    this.scene.restart(); // re-render from a clean slate (no save → no Continue/Erase)
  }

  /** Load the saved run and route by phase; a failed load falls through to a fresh New Game. */
  onContinue() {
    if (!runState.loadFromStorage()) {
      this.onNewGame();
      return;
    }
    if (runState.phase === 'shop') this.scene.start('Shop');
    else this.scene.start('Game');
  }

  /** Wipe + reset the run to defaults and start Level 1. (No overwrite-confirm this milestone — P3.8.) */
  onNewGame() {
    runState.newGame();
    this.scene.start('Game');
  }

  /** A centered, interactive menu label (hover cursor). */
  mkButton(x, y, text, color, onClick) {
    const t = this.mkText(x, y, text, 26, color).setOrigin(0.5);
    t.setInteractive({ useHandCursor: true }).on('pointerdown', onClick);
    return t;
  }

  /** Small helper: a stroked text in the HUD font (mirrors ShopScene.mkText). */
  mkText(x, y, text, size, color) {
    return this.add
      .text(x, y, text, { fontFamily: this.f, fontSize: size, color })
      .setStroke(this.stroke.color, this.stroke.thickness);
  }
}
