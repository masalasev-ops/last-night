import { Physics, Input } from 'phaser';
import { CONFIG } from '../config.js';

/**
 * Player — a 12×20 Arcade physics sprite controlled by the keyboard + mouse.
 *
 * Movement:  A/D or Left/Right arrows for horizontal movement.
 * Sprint:    Hold Shift to move faster.
 * Jump:      Space / Up Arrow, with coyote-time (grace after leaving ground) and
 *            jump-buffer (press slightly before landing still counts).
 * Aim:       Mouse pointer — facing direction follows the pointer, not movement.
 * Shoot:     Hold left-click to fire semi-auto at fireRate shots/sec.
 * Reload:    R key — 1.1s reload, ammo refills to magSize.
 * Restart:   R key while dead — requests a full scene restart.
 *
 * All movement is scaled by delta time — frame-rate independent.
 */
export class Player extends Physics.Arcade.Sprite {
  /**
   * @param {Phaser.Scene} scene
   * @param {number} x
   * @param {number} y
   * @param {Phaser.Physics.Arcade.Group} bulletGroup — pooled bullet group for spawning
   */
  constructor(scene, x, y, bulletGroup) {
    super(scene, x, y, CONFIG.TEXTURE_MAP.player);

    // Add to scene display list and physics world
    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Physics body setup
    this.body.setCollideWorldBounds(true);
    this.body.setMaxVelocityY(800);

    // Input keys
    this.keys = {
      left: scene.input.keyboard.addKey(Input.Keyboard.KeyCodes.A),
      right: scene.input.keyboard.addKey(Input.Keyboard.KeyCodes.D),
      arrowLeft: scene.input.keyboard.addKey(Input.Keyboard.KeyCodes.LEFT),
      arrowRight: scene.input.keyboard.addKey(Input.Keyboard.KeyCodes.RIGHT),
      jump: scene.input.keyboard.addKey(Input.Keyboard.KeyCodes.SPACE),
      jumpUp: scene.input.keyboard.addKey(Input.Keyboard.KeyCodes.UP),
      sprint: scene.input.keyboard.addKey(Input.Keyboard.KeyCodes.SHIFT),
      reload: scene.input.keyboard.addKey(Input.Keyboard.KeyCodes.R),
    };

    // --- Health ---
    this.health = CONFIG.playerMaxHealth;

    // --- Death / restart ---
    this.dead = false;
    this.won = false;
    this.wantsRestart = false;

    // --- Debug ---
    this.godMode = false;

    // --- Damage response ---
    this.invulnTimer = 0;      // s — remaining invulnerability after a hit
    this.knockbackTimer = 0;   // s — forced knockback, overrides horizontal input
    this.blinkTimer = 0;       // s — accumulator for alpha blink toggle

    // --- Movement state ---
    this.facingRight = true;
    this.coyoteTimer = 0; // s — grace window after leaving ground
    this.jumpBufferTimer = 0; // s — buffered jump press

    // --- Shooting state ---
    this.bulletGroup = bulletGroup;
    this.shootTimer = 0; // s — cooldown until next shot allowed
    this.ammo = CONFIG.pistol.magSize;
    this.reloading = false;
    this.reloadTimer = 0; // s — remaining reload time
  }

  /** Call from GameScene.update(time, delta) */
  update(_, delta) {
    // --- Dead: freeze all input, watch for restart ---
    if (this.dead || this.won) {
      if (Input.Keyboard.JustDown(this.keys.reload)) {
        this.wantsRestart = true;
      }
      return;
    }

    const dt = delta / 1000;
    const { moveSpeed, sprintMultiplier, jumpVelocity, coyoteTime, jumpBuffer, pistol,
            invulnOnHit, knockback, knockbackDuration } = CONFIG;
    const { left, right, arrowLeft, arrowRight, jump, jumpUp, sprint, reload } = this.keys;
    const onGround = this.body.blocked.down;
    const pointer = this.scene.input.activePointer;

    // --- Invulnerability timer + blink ---
    if (this.invulnTimer > 0) {
      this.invulnTimer -= dt;
      this.blinkTimer += dt;
      if (this.blinkTimer >= 0.1) {
        this.blinkTimer = 0;
        this.setAlpha(this.alpha === 1 ? 0.3 : 1);
      }
      // Unconditionally reset alpha when timer expires (fix: can't be stuck translucent)
      if (this.invulnTimer <= 0) {
        this.setAlpha(1);
      }
    }

    // --- Knockback timer — decays each frame; while active, skip horizontal input ---
    if (this.knockbackTimer > 0) {
      this.knockbackTimer -= dt;
    }

    // --- Coyote timer ---
    if (onGround) {
      this.coyoteTimer = coyoteTime;
    } else {
      this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);
    }

    // --- Jump buffer ---
    if (Input.Keyboard.JustDown(jump) || Input.Keyboard.JustDown(jumpUp)) {
      this.jumpBufferTimer = jumpBuffer;
    }
    this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt);

    // --- Jump execution ---
    const canJump = (onGround || this.coyoteTimer > 0) && this.jumpBufferTimer > 0;
    if (canJump) {
      this.body.setVelocityY(-jumpVelocity);
      this.coyoteTimer = 0;
      this.jumpBufferTimer = 0;
    }

    // --- Movement direction (shared by facing + horizontal input) ---
    const moveLeft = left.isDown || arrowLeft.isDown;
    const moveRight = right.isDown || arrowRight.isDown;

    // --- Facing (keyboard-driven) ---
    if (moveLeft && !moveRight) {
      this.facingRight = false;
    } else if (moveRight && !moveLeft) {
      this.facingRight = true;
    }

    // --- Horizontal movement (blocked during knockback) ---
    if (this.knockbackTimer <= 0) {
      const isSprinting = sprint.isDown;

      if (moveLeft && !moveRight) {
        const speed = moveSpeed * (isSprinting ? sprintMultiplier : 1);
        this.body.setVelocityX(-speed);
      } else if (moveRight && !moveLeft) {
        const speed = moveSpeed * (isSprinting ? sprintMultiplier : 1);
        this.body.setVelocityX(speed);
      } else {
        this.body.setVelocityX(0);
      }
    }

    // --- Shooting (semi-auto: hold to fire at fire-rate cap) ---
    this.shootTimer = Math.max(0, this.shootTimer - dt);

    if (pointer.isDown && this.shootTimer <= 0 && this.ammo > 0 && !this.reloading) {
      this.shootTimer = 1 / pistol.fireRate;

      // Compute bullet velocity from player toward pointer
      const dx = pointer.worldX - this.x;
      const dy = pointer.worldY - this.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > 0) {
        const vx = (dx / len) * pistol.bulletSpeed;
        const vy = (dy / len) * pistol.bulletSpeed;
        this.spawnBullet(vx, vy);
      }
    }

    // --- Reload ---
    if (Input.Keyboard.JustDown(reload) && this.ammo < pistol.magSize && !this.reloading) {
      this.reloading = true;
      this.reloadTimer = pistol.reloadTime;
    }

    if (this.reloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        this.ammo = pistol.magSize;
        this.reloading = false;
        this.reloadTimer = 0;
      }
    }

    // --- Facing direction (flip sprite so the nub points forward) ---
    this.setFlipX(!this.facingRight);
  }

  /**
   * Spawn a single bullet from the pooled group.
   * group.get() reuses an inactive bullet or creates one if under maxSize.
   *
   * @param {number} vx  velocity X (px/s)
   * @param {number} vy  velocity Y (px/s)
   */
  spawnBullet(vx, vy) {
    const bullet = this.bulletGroup.get(this.x, this.y, CONFIG.TEXTURE_MAP.bullet);
    if (bullet) {
      bullet.fire(this.x, this.y, vx, vy);
      this.ammo--;

      // Screen shake — subtle per-shot recoil
      this.scene.cameras.main.shake(CONFIG.shake.onShoot.duration, CONFIG.shake.onShoot.intensity);

      // Muzzle flash particles — burst in front of the player
      const muzzleX = this.x + (this.facingRight ? 10 : -10);
      const muzzleY = this.y - 4;
      this.scene.muzzleEmitter.explode(CONFIG.particles.muzzle.count, muzzleX, muzzleY);
    }
  }

  /**
   * Take damage from an enemy attack.
   * Applies invulnerability window, knockback, and death check.
   *
   * @param {number} amount   damage to subtract
   * @param {number} sourceX  world X of the damage source (for knockback direction)
   */
  takeDamage(amount, sourceX) {
    // Ignore if invulnerable, dead, or god mode
    if (this.invulnTimer > 0 || this.dead || this.godMode) return;

    // Screen shake — sharp jolt on taking a hit
    this.scene.cameras.main.shake(CONFIG.shake.onHit.duration, CONFIG.shake.onHit.intensity);

    this.health = Math.max(0, this.health - amount);
    this.invulnTimer = CONFIG.invulnOnHit;
    this.blinkTimer = 0;

    // Knockback: push away from the damage source
    const dir = sourceX != null ? (this.x >= sourceX ? 1 : -1) : 0;
    this.body.setVelocityX(CONFIG.knockback * dir);
    this.body.setVelocityY(-CONFIG.knockback * 0.5);
    this.knockbackTimer = CONFIG.knockbackDuration;

    // Death
    if (this.health <= 0) {
      this.dead = true;
      this.setTint(0x880000); // dark red corpse
      this.body.setVelocity(0, 0);
      this.body.enable = false; // fix: corpse can't be shoved by enemies
      return;
    }

    // Brief red flash (alive, will be overlaid by blink)
    this.setTint(0xff0000);
    this.scene.time.delayedCall(80, () => {
      if (this.active && !this.dead) this.clearTint();
    });
  }
}
