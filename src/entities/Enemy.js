import { Physics } from 'phaser';
import { CONFIG, ZOMBIE_BODY } from '../config.js';

/**
 * Enemy — a pooled Arcade physics sprite with a five-state FSM.
 *
 * States: PATROL → CHASE → ATTACK → HURT (→ back to PATROL/CHASE), plus DEAD
 * (plays the death animation, lingers as a corpse, then returns to the pool).
 *
 * Real art (L3): each enemy picks a Zombie_N sheet at spawn; an animation controller
 * maps the FSM state → that type's animation. The physics body is an explicit torso box
 * (ZOMBIE_BODY[type]), never the 128px sprite. Enemies are pooled — spawn() re-sets the
 * texture, body, origin, and anim per type so the pool can safely mix types.
 *
 * Belongs to a Phaser Group with runChildUpdate:true → preUpdate() runs each frame.
 */

/** @enum {string} */
const STATE = {
  PATROL: 'PATROL',
  CHASE: 'CHASE',
  ATTACK: 'ATTACK',
  HURT: 'HURT',
  DEAD: 'DEAD',
};

export class Enemy extends Physics.Arcade.Sprite {
  /**
   * @param {Phaser.Scene} scene
   * @param {number} x
   * @param {number} y
   */
  constructor(scene, x, y) {
    super(scene, x, y, CONFIG.TEXTURE_MAP.enemy); // placeholder default; spawn() swaps in real art

    // Start dead in the pool
    this.setActive(false);
    this.setVisible(false);

    /** @type {import('./Player.js').Player} — set by GameScene after spawn */
    this.player = null;
    this.type = null;
  }

  /**
   * Activate this enemy as a given zombie type at a world position (feet-origin).
   * Re-sets texture / body / origin / anim so a pooled enemy can be reused as any type.
   *
   * @param {number} x
   * @param {number} y     feet position (ground surface)
   * @param {string} type  'Zombie_1'..'Zombie_4'
   */
  spawn(x, y, type) {
    this.type = type;
    const body = ZOMBIE_BODY[type];
    this.facesLeft = body.facesLeft;

    // Real art fitted to an explicit torso body (art never drives the hitbox).
    this.setTexture(`${type}-idle`);
    this.setOrigin(body.originX, body.originY); // feet
    this.setScale(1);
    this.setPosition(x, y);
    this.setActive(true);
    this.setVisible(true);
    this.clearTint();
    this.body.enable = true;
    this.body.setSize(body.width, body.height);   // after setTexture so the frame is set
    this.body.setOffset(body.offsetX, body.offsetY);
    this.play(`${type}-idle`);

    // Death-animation length read from the registered anim (no magic number).
    this.deadDuration = this.scene.anims.get(`${type}-dead`).duration / 1000;

    // --- FSM reset ---
    this.health = CONFIG.enemy.maxHealth;
    this.state = STATE.PATROL;
    this.spawnX = x; // anchor for patrol range
    this.patrolDir = 1; // 1 = right, -1 = left
    this.attackTimer = 0;
    this.hurtTimer = 0;
    this.deathTimer = 0;
  }

  /** Face a horizontal direction (dir<0 = left), honoring the sheet's default facing. */
  faceDir(dir) {
    this.setFlipX((dir < 0) !== this.facesLeft);
  }

  /**
   * Called automatically each frame by Phaser (via runChildUpdate on the group).
   * Dispatches to the current state's logic, then updates the animation.
   *
   * @param {number} time
   * @param {number} delta  ms since last frame
   */
  preUpdate(time, delta) {
    super.preUpdate(time, delta);
    if (!this.active) return;

    const dt = delta / 1000;

    // --- DEAD: play out the death pose + corpse linger, then return to the pool ---
    if (this.state === STATE.DEAD) {
      this.deathTimer -= dt;
      if (this.deathTimer <= 0) this.deactivate();
      return;
    }

    const { moveSpeed, chaseSpeed, detectionRadius, attackRange, attackCooldown, patrolRange, maxVerticalReach } = CONFIG.enemy;
    const player = this.player;

    // Guard: if player ref isn't set yet, stand idle
    if (!player || !player.active) {
      this.body.setVelocityX(0);
      this.play(`${this.type}-idle`, true);
      return;
    }

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const distToPlayer = Math.sqrt(dx * dx + dy * dy);
    const dirToPlayer = player.x >= this.x ? 1 : -1;

    switch (this.state) {
      // --- PATROL: walk back and forth within patrol range ---
      case STATE.PATROL: {
        this.body.setVelocityX(moveSpeed * this.patrolDir);
        this.faceDir(this.patrolDir);

        if (this.x >= this.spawnX + patrolRange) this.patrolDir = -1;
        if (this.x <= this.spawnX - patrolRange) this.patrolDir = 1;

        if (distToPlayer <= detectionRadius && Math.abs(dy) <= maxVerticalReach) {
          this.state = STATE.CHASE;
        }
        break;
      }

      // --- CHASE: move toward player at chase speed ---
      case STATE.CHASE: {
        this.body.setVelocityX(chaseSpeed * dirToPlayer);
        this.faceDir(dirToPlayer);

        if (distToPlayer > detectionRadius * 1.5 || Math.abs(dy) > maxVerticalReach) {
          this.state = STATE.PATROL;
        }
        if (distToPlayer <= attackRange) {
          this.state = STATE.ATTACK;
          this.attackTimer = 0; // ready to strike immediately
        }
        break;
      }

      // --- ATTACK: deal damage on cooldown; the swing anim is driven by the strike only ---
      case STATE.ATTACK: {
        this.body.setVelocityX(0);
        this.faceDir(dirToPlayer);

        this.attackTimer = Math.max(0, this.attackTimer - dt);
        if (this.attackTimer <= 0) {
          player.takeDamage(CONFIG.enemy.touchDamage, this.x);
          this.attackTimer = attackCooldown;
          this.play(`${this.type}-attack`); // restart the swing on the discrete strike only
        }

        if (distToPlayer > attackRange) this.state = STATE.CHASE;
        break;
      }

      // --- HURT: brief white flash, then resume ---
      case STATE.HURT: {
        this.body.setVelocityX(0);

        this.hurtTimer -= dt;
        if (this.hurtTimer <= 0) {
          this.clearTint();
          this.state = distToPlayer <= detectionRadius ? STATE.CHASE : STATE.PATROL;
        }
        break;
      }
    }

    this.updateAnimation();
  }

  /**
   * Animation controller — maps FSM state → the type's animation each frame.
   * ATTACK is deliberately excluded: its swing is triggered by the discrete strike in
   * the ATTACK case, so it can't stutter from a per-frame replay. DEAD is set at death.
   */
  updateAnimation() {
    if (this.state === STATE.ATTACK) return;
    let anim;
    if (this.state === STATE.HURT) anim = 'hurt';
    else if (this.state === STATE.PATROL || this.state === STATE.CHASE) anim = 'walk';
    else anim = 'idle';
    this.play(`${this.type}-${anim}`, true);
  }

  /**
   * Take damage from a bullet. Lethal → DEAD (plays the death anim, disables the body,
   * lingers as a corpse for corpseLinger, then pools out). Non-lethal → HURT flash.
   *
   * @param {number} amount
   */
  takeDamage(amount) {
    if (this.state === STATE.DEAD) return; // corpse ignores further hits

    this.health -= amount;

    if (this.health <= 0) {
      this.state = STATE.DEAD;
      this.play(`${this.type}-dead`); // one-shot; holds last frame
      this.body.setVelocity(0, 0);
      this.body.enable = false; // corpse: no collisions/overlaps, stays put
      this.clearTint();
      this.deathTimer = this.deadDuration + CONFIG.enemy.corpseLinger;
      return;
    }

    this.state = STATE.HURT;
    this.hurtTimer = CONFIG.enemy.hurtDuration;
    this.play(`${this.type}-hurt`); // trigger on the hit (no 1-frame delay); controller keeps it during HURT
    this.setTint(0xffffff);
  }

  /** Return this enemy to the pool — invisible, stopped, inactive. */
  deactivate() {
    this.setActive(false);
    this.setVisible(false);
    this.body.enable = false;
    this.body.stop();
    this.clearTint();
    this.state = STATE.PATROL;
    this.player = null;
  }
}
