import { Scene } from 'phaser';
import { CONFIG } from '../config.js';

/**
 * VictoryScene (P3.7) — the data-driven chapter payoff, superseding the P3.6 EndScene. It renders the boss
 * level's `beatOnDefeat` (passed via `scene.start('Victory', { beat })`): for `clueAndAlly`, a surviving-ally
 * placeholder + click-advanced dialogue + a clue, then a Victory panel (title + hook) → Back to Title. The
 * dispatch on `beat.type` is the reusable seam — a later boss sets `type:'rescue'` and the same scene renders a
 * different set-piece with no engine change. Text/placeholder only (no HUD, no real art). Carries no HUD; the
 * run's save is left intact (a "chapter complete" flag is later polish).
 */
export class VictoryScene extends Scene {
  constructor() {
    super('Victory');
  }

  create(data) {
    const { width, height } = CONFIG;
    this.beat = (data && data.beat) || {};
    this.f = CONFIG.hud.font.family;
    this.stroke = CONFIG.hud.stroke;
    this._victoryShown = false;
    // Reset per-run state so a scene RESTART (e.g. a second beat type) never reads stale refs from the last run.
    this.dialogue = null;
    this.speaker = null;
    this.prompt = null;
    this.add.rectangle(0, 0, width, height, 0x0a0a0f, 1).setOrigin(0, 0);

    if (this.beat.type === 'clueAndAlly') this.buildClueAndAlly();
    else this.buildVictoryPanel(); // generic fallback — proves the dispatch is data-driven (test G)

    console.log('[VictoryScene] ready —', this.beat.type);
  }

  /** The demo beat: an ally figure + click-advanced dialogue → the Victory panel (clue + title + hook). */
  buildClueAndAlly() {
    const { width, height } = CONFIG;
    this.drawAlly(width * 0.24, height * 0.5);
    this.mkText(width * 0.24, height * 0.5 + 74, 'SURVIVOR', 13, '#8a8f9a').setOrigin(0.5);

    this.dialogue = this.beat.dialogue || [];
    this.step = 0;
    this.speaker = this.mkText(width * 0.5, height * 0.72, '', 18, '#e8e8e8').setOrigin(0.5).setWordWrapWidth(width * 0.66);
    this.prompt = this.mkText(width * 0.5, height - 38, '▶  click / any key to continue', 12, '#6a7280').setOrigin(0.5);

    // Click or key advances the dialogue; either way it ALWAYS reaches the Victory panel (no soft-lock).
    this._advance = () => this.advance();
    this.input.on('pointerdown', this._advance);
    this.input.keyboard.on('keydown', this._advance);

    this.renderStep();
  }

  renderStep() {
    if (this.step < this.dialogue.length) this.speaker.setText(this.dialogue[this.step]);
  }

  advance() {
    if (this.step < this.dialogue.length - 1) {
      this.step += 1;
      this.renderStep();
      return;
    }
    this.toVictory();
  }

  /** Transition from dialogue → the Victory panel (once). Detaches the advance listeners so the Back-to-Title
   *  button is the only interactive element. */
  toVictory() {
    if (this._victoryShown) return;
    this._victoryShown = true;
    this.input.off('pointerdown', this._advance);
    this.input.keyboard.off('keydown', this._advance);
    this.speaker?.destroy();
    this.prompt?.destroy();
    this.buildVictoryPanel();
  }

  /** The Victory panel: chapter-complete title + inline clue + the "where next" hook + Back to Title. */
  buildVictoryPanel() {
    const { width, height } = CONFIG;
    this.mkText(width / 2, height * 0.26, this.beat.title || 'VICTORY', 40, '#3ad06a').setOrigin(0.5);
    if (this.beat.clue) this.mkText(width / 2, height * 0.44, this.beat.clue, 15, '#ffd27f').setOrigin(0.5).setWordWrapWidth(width * 0.72);
    if (this.beat.hook) this.mkText(width / 2, height * 0.55, this.beat.hook, 15, '#9aa0ac').setOrigin(0.5).setWordWrapWidth(width * 0.72);
    const back = this.mkText(width / 2, height * 0.78, 'Back to Title', 22, '#d6dae2').setOrigin(0.5);
    back.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.scene.start('Title'));
  }

  /** A simple ally placeholder silhouette (kneeling survivor) — real NPC art is a later swap-point drop. */
  drawAlly(cx, cy) {
    const g = this.add.graphics();
    g.fillStyle(0x3a4a5a, 1);
    g.fillRoundedRect(cx - 13, cy - 40, 26, 46, 8); // torso
    g.fillCircle(cx, cy - 48, 12);                  // head
    g.fillRect(cx - 18, cy + 4, 36, 10);            // base
    g.fillStyle(0xffcf3a, 0.9);                     // faint eyes
    g.fillCircle(cx - 4, cy - 49, 2);
    g.fillCircle(cx + 4, cy - 49, 2);
  }

  mkText(x, y, text, size, color) {
    return this.add
      .text(x, y, text, { fontFamily: this.f, fontSize: size, color, align: 'center' })
      .setStroke(this.stroke.color, this.stroke.thickness);
  }
}
