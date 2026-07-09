import { Physics, TintModes } from 'phaser';
import { CONFIG } from '../config.js';

/**
 * Boss (P3.7) — a DEDICATED entity (NOT a pooled Enemy) fought in a boss-arena level. It reuses GameScene's
 * terrain/camera/HUD/bullets/acid and the player's weapons + save model wholesale; the genuinely new code is
 * this phase controller with two telegraphed attacks + a death sequence that fires the chapter payoff.
 *
 * Lifecycle: INTRO (scripted — GameScene locks the player, then calls beginFight) → a FIGHT loop
 * (IDLE amble → TELEGRAPH wind-up → COMMIT → RECOVER, cadenced per phase) → DEAD (collapse → scene.onBossDefeated).
 * Phases are DATA (`CONFIG.BOSS[key].phases`, selected by HP fraction); this class is the controller.
 * Driven each frame by `GameScene.update()` calling `boss.tick(time, delta)` (deterministic — not the pooled
 * group's runChildUpdate). Bullets hit it via a dedicated overlap → `takeDamage`; contact hurts the player only
 * while a lunge is committed (`contactActive`). No new physics — facing/damage/acid mirror the Enemy patterns.
 */
const S = {
  INTRO: 'INTRO', IDLE: 'IDLE', TELEGRAPH: 'TELEGRAPH', COMMIT: 'COMMIT', RECOVER: 'RECOVER', TRANSITION: 'TRANSITION', DEAD: 'DEAD',
};
const WINDUP_TINT = 0xffcf3a; // readable attack wind-up flash

export class Boss extends Physics.Arcade.Sprite {
  constructor(scene, x, y, defKey) {
    super(scene, x, y, CONFIG.placeholder.BOSS.key);
    const def = CONFIG.BOSS[defKey];
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.def = def;
    this.maxHealth = def.maxHealth;
    this.health = def.maxHealth;
    this.barName = def.barName;
    this.barColor = def.barColor;
    this.muzzleOffset = def.muzzleOffset; // spawnAcid reads this (scaled by artScale)
    this.facesLeft = def.body.facesLeft ?? false;
    this.player = null; // set by GameScene after construction

    this.state = S.INTRO;
    this.phaseIndex = 0;
    this.attackTimer = 0;
    this.subTimer = 0;          // telegraph/commit/recover/transition countdown
    this.pendingAttack = null;
    this.contactActive = false; // player↔boss overlap only hurts while true (a committed lunge)
    this.dying = false;

    // Explicit BIG body, feet-grounded. Mirrors the Enemy pattern (origin → scale → size/offset): Arcade
    // scales body+offset by artScale around the feet origin on the next step, so the hitbox stays fitted.
    const b = def.body;
    this.setOrigin(b.originX, b.originY);
    // Non-uniform scale: scaleY = artScale (height), scaleX = artScale × widthScale (a horizontal-only squash —
    // playtest wanted a 10% narrower Warden). Arcade scales the body by scaleX/scaleY separately, so the hitbox
    // narrows with the art and — because offsetX centres the body symmetrically — stays centred on the feet origin.
    this.setScale(def.artScale * (def.widthScale ?? 1), def.artScale);
    this.body.setSize(b.width, b.height);
    this.body.setOffset(b.offsetX, b.offsetY);
    this.setDepth(5); // in front of terrain

    // Patrol bounds (playtest): the Warden PACES its arena between these edges instead of ambling onto the player
    // (which hovered in place — dir flipped each time it crossed the player — and read as static). Player-independent;
    // the attacks (lunge/acid) are what engage the player. Left bound is an explicit no-go line protecting the
    // player's start; right bound is inset from the arena edge.
    this.patrolMin = def.patrolMinX;
    this.patrolMax = scene.level.worldWidth - def.patrolMargin;
    this.patrolDir = -1; // start heading toward the player's entry side (arena left)
  }

  get phase() { return this.def.phases[this.phaseIndex]; }
  /** Alive for the bar / driver until the death sequence begins. */
  get alive() { return !this.dying; }

  /** Kick off the scripted entrance telegraph (GameScene owns the player lock + the unlock timer). */
  playIntro() {
    this._fill(0xe23a4a);                      // "charging up" glow during the lock (fill: reads on the dark blob)
    this.scene.cameras.main.shake(Math.min(this.def.introMs * 0.6, 600), 0.008);
  }

  /** GameScene calls this once the intro lock elapses — opens the fight. Always reached (timer-driven). */
  beginFight() {
    if (this.dying) return;
    this.clearTint();
    this.state = S.IDLE;
    this.attackTimer = this.phase.attackCadence;
  }

  /** Face a horizontal direction (dir<0 = left), honoring the sheet's default facing (mirrors Enemy.faceDir). */
  faceDir(dir) { this.setFlipX((dir < 0) !== this.facesLeft); }

  /** Solid-fill flash (Phaser 4: setTint + FILL mode) — reads on the DARK boss silhouette where a multiply
   *  tint would stay dark. clearTint() restores both the colour and the default MULTIPLY mode. */
  _fill(color) { return this.setTint(color).setTintMode(TintModes.FILL); }

  /** Driven each frame by GameScene.update(). No-ops during INTRO (GameScene-controlled) and once dying. */
  tick(time, delta) {
    if (this.dying || this.state === S.INTRO) return;
    const dt = delta / 1000;
    const p = this.player;
    if (!p || p.dead) { this.body.setVelocityX(0); return; }
    const dir = p.x >= this.x ? 1 : -1;

    switch (this.state) {
      case S.IDLE:
        this.patrol(); // pace the arena between attacks (replaces the old amble-onto-the-player)
        this.attackTimer -= dt;
        if (this.attackTimer <= 0) this.startAttack();
        break;

      case S.TELEGRAPH:
        this.faceDir(dir);           // aim the wind-up at the player
        this.body.setVelocityX(0);
        this.subTimer -= dt;
        if (this.subTimer <= 0) this.commitAttack(dir, p);
        break;

      case S.COMMIT: // lunge in progress — velocity set at commit, contactActive true
        this.subTimer -= dt;
        if (this.subTimer <= 0) this.enterRecover(this.def.lunge.recoverMs);
        break;

      case S.RECOVER:
      case S.TRANSITION:
        this.body.setVelocityX(0);
        this.subTimer -= dt;
        if (this.subTimer <= 0) { this.state = S.IDLE; this.attackTimer = this.phase.attackCadence; }
        break;
    }
  }

  /** Pace the arena between the patrol bounds, reversing at each edge — a player-independent walk so the Warden
   *  reads as an active, roaming threat (not a stationary acid turret). Speed is the phase's `moveSpeed`. It still
   *  faces where it walks; TELEGRAPH/lunge re-face + drive toward the player, so attacks stay player-aimed. */
  patrol() {
    if (this.x <= this.patrolMin) this.patrolDir = 1;
    else if (this.x >= this.patrolMax) this.patrolDir = -1;
    this.faceDir(this.patrolDir);
    this.body.setVelocityX(this.patrolDir * this.phase.moveSpeed);
  }

  /** Pick a random attack from the current phase and begin its telegraph. */
  startAttack() {
    const list = this.phase.attacks;
    this.pendingAttack = list[Math.floor(Math.random() * list.length)];
    this.state = S.TELEGRAPH;
    this.subTimer = (this.pendingAttack === 'lunge' ? this.def.lunge.telegraphMs : this.def.acid.telegraphMs) / 1000;
    this._fill(WINDUP_TINT); // solid flash — the player's cue to dodge (reads on the dark silhouette)
  }

  /** Commit the telegraphed attack: a dash (lunge) or a fanned acid volley. */
  commitAttack(dir, p) {
    this.clearTint();
    if (this.pendingAttack === 'lunge') {
      this.body.setVelocityX(dir * this.phase.lungeSpeed);
      this.contactActive = true; // now the overlap hurts (onPlayerTouchBoss)
      this.state = S.COMMIT;
      this.subTimer = this.def.lunge.commitMs / 1000;
    } else {
      this.fireAcidVolley(p);
      this.enterRecover(this.def.acid.recoverMs);
    }
  }

  enterRecover(ms) {
    this.contactActive = false;
    this.body.setVelocityX(0);
    this.state = S.RECOVER;
    this.subTimer = ms / 1000;
  }

  /** Fan `acidGlobs` globs across [-spread, +spread] around the player so the volley reads as a spread to
   *  dodge — not globs stacking on one point. Reuses the proven ballistic arc (GameScene.spawnAcid). */
  fireAcidVolley(p) {
    const n = this.phase.acidGlobs;
    const spread = this.def.acid.spread;
    for (let i = 0; i < n; i++) {
      const off = n === 1 ? 0 : -spread + (2 * spread) * (i / (n - 1));
      this.scene.spawnAcid(this, p, p.x + off);
    }
  }

  /** Bullet damage (via GameScene.onBulletHitBoss). Feeds the boss bar; crosses phase thresholds; on lethal
   *  runs the death sequence exactly once (guarded by `dying`). */
  takeDamage(amount) {
    if (this.dying) return;
    this.health = Math.max(0, this.health - amount);
    if (this.health <= 0) { this.enterDeath(); return; }

    // Phase transition when HP falls to/through the current phase's floor.
    const hpFrac = this.health / this.maxHealth;
    if (this.phaseIndex < this.def.phases.length - 1 && hpFrac <= this.phase.hpAbove) {
      this.enterTransition();
      return;
    }
    // Otherwise a brief hit flash (don't stomp an active telegraph tint — that's the more important tell).
    if (this.state !== S.TELEGRAPH) {
      this._fill(0xffffff);
      this.scene.time.delayedCall(60, () => { if (!this.dying && this.state !== S.TELEGRAPH && this.state !== S.TRANSITION) this.clearTint(); });
    }
  }

  /** P1→P2 telegraphed beat: advance the phase, brief pause + flash, then resume the (faster) loop. */
  enterTransition() {
    this.phaseIndex += 1;
    this.state = S.TRANSITION;
    this.contactActive = false;
    this.pendingAttack = null;
    this.body.setVelocityX(0);
    this.subTimer = this.def.transitionMs / 1000;
    this._fill(0xe23a4a); // enrage flash (fill: reads on the dark blob)
    this.scene.cameras.main.shake(220, 0.01);
    this.scene.time.delayedCall(this.def.transitionMs, () => { if (!this.dying) this.clearTint(); });
  }

  /** Distinct, non-pooled death: freeze, collapse-blink over deathMs, then fire the payoff — ALWAYS (a boss
   *  dying mid-attack is caught by the `dying` guard in tick; the timer guarantees the beat reaches Victory). */
  enterDeath() {
    this.dying = true;
    this.state = S.DEAD;
    this.contactActive = false;
    this.body.setVelocity(0, 0);
    this.body.enable = false; // no more overlaps; the corpse stays put (already grounded)
    this.setTint(0x444444);
    this.scene.cameras.main.shake(400, 0.016);
    this.scene.tweens.add({ targets: this, alpha: 0.25, yoyo: true, repeat: 3, duration: this.def.deathMs / 8 });
    this.scene.time.delayedCall(this.def.deathMs, () => this.scene.onBossDefeated(this));
  }
}
