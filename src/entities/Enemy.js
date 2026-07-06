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
  RETREAT: 'RETREAT', // player is perched on a platform above (unreachable) → walk away, re-anchor patrol
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
    this.retreatDir = 1; // walk-away direction while retreating (set on entry to RETREAT)
    this.gaveUp = false; // true after a bounded retreat: don't re-chase/re-retreat this perch until
    // the player becomes reachable again (prevents an endless retreat↔patrol oscillation).
  }

  /**
   * Give up on a player who is standing on a platform overhead (zombies can't jump, so they'd
   * otherwise mill about beneath it). Walk back the way we came — i.e. away from the player's
   * horizontal position (we chased toward them, so away = homeward). Direction is derived from the
   * live player position, NOT spawnX (which RETREAT re-anchors and would otherwise corrupt this).
   */
  enterRetreat() {
    this.state = STATE.RETREAT;
    const p = this.player;
    if (this.x < p.x) this.retreatDir = -1;        // player to our right → back off left
    else if (this.x > p.x) this.retreatDir = 1;    // player to our left  → back off right
    else this.retreatDir = this.spawnX >= this.x ? 1 : -1; // dead-centre: bias toward home
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

    const { moveSpeed, chaseSpeed, detectionRadius, attackRange, attackCooldown, patrolRange, maxVerticalReach, climbHeight, retreatDistance } = CONFIG.enemy;
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

    // Player is standing on a platform overhead, out of reach (zombies can't jump — climbHeight is
    // the most they can step up). Requires the player to be *grounded* above us — not just mid-leap —
    // so a jump-over doesn't trigger it.
    const playerUnreachableAbove =
      player.body.blocked.down && this.y - player.y > climbHeight;

    // Re-arm once the player is reachable again (came down / not perched above), so the next time
    // they perch we retreat afresh instead of staying "given up".
    if (!playerUnreachableAbove) this.gaveUp = false;

    switch (this.state) {
      // --- PATROL: walk back and forth within patrol range. Only chases a *reachable* player, so a
      // player perched on a platform above is simply ignored here (the retreat is driven from CHASE/
      // ATTACK, never from PATROL — re-triggering it here caused an endless walk off-screen). ---
      case STATE.PATROL: {
        // Player just landed on a platform overhead (e.g. mid-patrol, or during the airborne frames
        // of a jump that our CHASE exit dropped us here for) → back off, unless we already gave up
        // on this perch. gaveUp stops this from firing every frame (endless walk-away).
        if (playerUnreachableAbove && distToPlayer <= detectionRadius && !this.gaveUp) {
          this.enterRetreat();
          break;
        }

        this.body.setVelocityX(moveSpeed * this.patrolDir);
        this.faceDir(this.patrolDir);

        if (this.x >= this.spawnX + patrolRange) this.patrolDir = -1;
        if (this.x <= this.spawnX - patrolRange) this.patrolDir = 1;

        // Chase only a *reachable* player (a player camping overhead is handled by the retreat above).
        if (distToPlayer <= detectionRadius && Math.abs(dy) <= maxVerticalReach && !playerUnreachableAbove) {
          this.state = STATE.CHASE;
        }
        break;
      }

      // --- CHASE: move toward player at chase speed ---
      case STATE.CHASE: {
        // Player jumped onto a platform we can't reach → give up and retreat (don't hover below).
        if (playerUnreachableAbove) {
          this.enterRetreat();
          break;
        }

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
        // Player hopped onto a platform overhead mid-melee → stop swinging at nothing, retreat.
        if (playerUnreachableAbove) {
          this.enterRetreat();
          break;
        }

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

      // --- RETREAT: player is perched above; walk back the way we came a *bounded* distance
      // (retreatDistance), then re-home the patrol there so we lurk nearby, still on-screen — not
      // marching off forever. Resume chasing if the player drops back down within reach. ---
      case STATE.RETREAT: {
        this.body.setVelocityX(moveSpeed * this.retreatDir);
        this.faceDir(this.retreatDir);

        // Done once the player comes down, or we've backed off the bounded retreat distance.
        if (!playerUnreachableAbove || distToPlayer >= retreatDistance) {
          this.spawnX = this.x;             // re-home the patrol here (backed off, but still in view)
          this.patrolDir = this.retreatDir; // keep drifting the same way
          if (playerUnreachableAbove) {
            // Backed off far enough while the player is still perched → give up on this perch and
            // patrol locally (gaveUp keeps us from immediately retreating again → no walk off-screen).
            this.gaveUp = true;
            this.state = STATE.PATROL;
          } else {
            // Player dropped back down → re-engage if they're near and reachable, else patrol here.
            this.state =
              distToPlayer <= detectionRadius && Math.abs(dy) <= maxVerticalReach ? STATE.CHASE : STATE.PATROL;
          }
        }
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
    else if (this.state === STATE.PATROL || this.state === STATE.CHASE || this.state === STATE.RETREAT) anim = 'walk';
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
