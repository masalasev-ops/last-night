import { Physics } from 'phaser';
import { CONFIG } from '../config.js';

/**
 * Enemy — a pooled Arcade physics sprite with a four-state FSM.
 *
 * States: PATROL → CHASE → ATTACK → HURT (→ back to PATROL/CHASE).
 * Death is handled immediately in takeDamage() — no DEAD tick state.
 *
 * Belongs to a Phaser Group with runChildUpdate:true, which calls preUpdate()
 * automatically on every active enemy each frame.
 *
 * Lifecycle:
 *   - Created once by the pool (Group.get), starts inactive/invisible.
 *   - spawn(x, y) → activates, sets health & state, begins AI.
 *   - takeDamage(amount) → reduces health; if ≤0 deactivates instantly.
 *   - deactivate() → invisible, stopped, returned to pool.
 */

/** @enum {string} */
const STATE = {
  PATROL: 'PATROL',
  CHASE: 'CHASE',
  ATTACK: 'ATTACK',
  HURT: 'HURT',
};

export class Enemy extends Physics.Arcade.Sprite {
  /**
   * @param {Phaser.Scene} scene
   * @param {number} x
   * @param {number} y
   */
  constructor(scene, x, y) {
    super(scene, x, y, CONFIG.TEXTURE_MAP.enemy);

    // Start dead in the pool
    this.setActive(false);
    this.setVisible(false);

    /** @type {import('./Player.js').Player} — set by GameScene after spawn */
    this.player = null;
  }

  /**
   * Activate this enemy at a world position. Called by GameScene's spawn loop.
   * @param {number} x
   * @param {number} y
   */
  spawn(x, y) {
    this.setPosition(x, y);
    this.setActive(true);
    this.setVisible(true);
    this.body.enable = true;

    this.health = CONFIG.enemy.maxHealth;
    this.state = STATE.PATROL;
    this.spawnX = x; // anchor for patrol range
    this.patrolDir = 1; // 1 = right, -1 = left
    this.attackTimer = 0;
    this.hurtTimer = 0;
  }

  /**
   * Called automatically each frame by Phaser (via runChildUpdate on the group).
   * Dispatches to the current state's logic.
   *
   * @param {number} time
   * @param {number} delta  ms since last frame
   */
  preUpdate(time, delta) {
    super.preUpdate(time, delta);

    if (!this.active) return;

    const dt = delta / 1000;
    const { moveSpeed, chaseSpeed, detectionRadius, attackRange, attackCooldown, patrolRange, hurtDuration, maxVerticalReach } = CONFIG.enemy;
    const player = this.player;

    // Guard: if player ref isn't set yet, just idle
    if (!player || !player.active) {
      this.body.setVelocityX(0);
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
        this.setFlipX(this.patrolDir < 0);

        // Reverse at patrol boundaries
        if (this.x >= this.spawnX + patrolRange) this.patrolDir = -1;
        if (this.x <= this.spawnX - patrolRange) this.patrolDir = 1;

        // Detect player → chase (only if player is within vertical reach)
        if (distToPlayer <= detectionRadius && Math.abs(dy) <= maxVerticalReach) {
          this.state = STATE.CHASE;
        }
        break;
      }

      // --- CHASE: move toward player at chase speed ---
      case STATE.CHASE: {
        this.body.setVelocityX(chaseSpeed * dirToPlayer);
        this.setFlipX(dirToPlayer < 0);

        // Lost the player (hysteresis or unreachable vertically) → back to patrol
        if (distToPlayer > detectionRadius * 1.5 || Math.abs(dy) > maxVerticalReach) {
          this.state = STATE.PATROL;
        }
        // Close enough to attack
        if (distToPlayer <= attackRange) {
          this.state = STATE.ATTACK;
          this.attackTimer = 0; // ready to strike immediately
        }
        break;
      }

      // --- ATTACK: deal damage on cooldown ---
      case STATE.ATTACK: {
        this.body.setVelocityX(0);
        this.setFlipX(dirToPlayer < 0);

        this.attackTimer = Math.max(0, this.attackTimer - dt);

        if (this.attackTimer <= 0) {
          player.takeDamage(CONFIG.enemy.touchDamage, this.x);
          this.attackTimer = attackCooldown;
        }

        // Player stepped back → chase
        if (distToPlayer > attackRange) {
          this.state = STATE.CHASE;
        }
        break;
      }

      // --- HURT: brief white flash, then resume ---
      case STATE.HURT: {
        this.body.setVelocityX(0);

        this.hurtTimer -= dt;
        if (this.hurtTimer <= 0) {
          this.clearTint();
          // Resume based on distance to player
          this.state = distToPlayer <= detectionRadius ? STATE.CHASE : STATE.PATROL;
        }
        break;
      }
    }
  }

  /**
   * Take damage from a bullet.
   * If health drops to 0, deactivates immediately (no DEAD-state tick).
   * Otherwise enters HURT state for a brief white flash.
   *
   * @param {number} amount
   */
  takeDamage(amount) {
    this.health -= amount;

    if (this.health <= 0) {
      this.deactivate();
      return;
    }

    this.state = STATE.HURT;
    this.hurtTimer = CONFIG.enemy.hurtDuration;
    this.setTint(0xffffff);
  }

  /** Return this enemy to the pool — invisible, stopped, inactive. */
  deactivate() {
    this.setActive(false);
    this.setVisible(false);
    this.body.enable = false;
    this.body.stop();
    this.clearTint();
    this.player = null;
  }
}
