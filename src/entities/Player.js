import { Physics, Input } from 'phaser';
import { CONFIG, PLAYER_BODY } from '../config.js';

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

    // --- Real art fitted to an explicit physics body (art never drives the hitbox) ---
    // Scale 1.0 = native Soldier_1 art (~2 tiles tall). Origin at the feet; the body is
    // the config box (28×62), positioned by offset — independent of the 128px frame.
    this.setOrigin(PLAYER_BODY.originX, PLAYER_BODY.originY);
    this.setScale(1);
    this.body.setSize(PLAYER_BODY.width, PLAYER_BODY.height);
    this.body.setOffset(PLAYER_BODY.offsetX, PLAYER_BODY.offsetY);
    this.play('player-idle'); // initial pose; updateAnimation() drives it each frame

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
    this.hurtTimer = 0;        // s — remaining hurt-animation window (drives anim priority)
    // Hurt-anim display length read from the registered anim itself — not a magic number.
    this.hurtDuration = scene.anims.get('player-hurt').duration / 1000;

    // --- Movement state ---
    this.facingRight = true;  // movement direction — drives sprite flip, gun side, camera look-ahead
    this.coyoteTimer = 0; // s — grace window after leaving ground
    this.jumpBufferTimer = 0; // s — buffered jump press

    // --- Shooting state ---
    this.bulletGroup = bulletGroup;
    this.shootTimer = 0; // s — cooldown until next shot allowed
    this.ammo = CONFIG.weapon.magSize;
    this.reloading = false;
    this.reloadTimer = 0; // s — remaining reload time
  }

  /** Call from GameScene.update(time, delta) */
  update(_, delta) {
    // --- Dead: freeze all input, watch for restart ---
    if (this.dead || this.won) {
      // Death anim was triggered in takeDamage; on win, settle to idle.
      if (this.won && this.anims.currentAnim?.key !== 'player-idle') this.play('player-idle', true);
      if (Input.Keyboard.JustDown(this.keys.reload)) {
        this.wantsRestart = true;
      }
      return;
    }

    const dt = delta / 1000;
    const { moveSpeed, sprintMultiplier, jumpVelocity, coyoteTime, jumpBuffer, weapon,
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

    // --- Hurt-animation window ---
    if (this.hurtTimer > 0) {
      this.hurtTimer -= dt;
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

    if (pointer.isDown && this.shootTimer <= 0 && this.ammo > 0 && !this.reloading && this.aimingForward(pointer)) {
      this.shootTimer = 1 / weapon.fireRate;
      this.spawnBullet(); // aim geometry (from the gun tip) lives in spawnBullet
    }

    // --- Reload ---
    if (Input.Keyboard.JustDown(reload) && this.ammo < weapon.magSize && !this.reloading) {
      this.reloading = true;
      this.reloadTimer = weapon.reloadTime;
    }

    if (this.reloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        this.ammo = weapon.magSize;
        this.reloading = false;
        this.reloadTimer = 0;
      }
    }

    // --- Facing: sprite + gun flip with movement direction (NOT the mouse) ---
    this.setFlipX(!this.facingRight);

    // --- Animation controller (reads state → plays anim; never changes mechanics) ---
    const moving = (moveLeft || moveRight) && !(moveLeft && moveRight);
    this.updateAnimation(onGround, moving, sprint.isDown);
  }

  /**
   * Spawn one pooled bullet from the gun tip, travelling straight at the cursor.
   * The muzzle point (mx,my) is the sprite origin (feet) + muzzleOffset on the facing
   * side (so it tracks the drawn gun); the aim vector is recomputed FROM the tip so
   * close-range shots point true. Fire-rate/ammo/reload gating stays in update().
   */
  /**
   * True when the cursor is on the side the character faces (or straight above/below it). Firing is
   * gated on this so you can't shoot "backwards" toward the mouse while facing away — you must turn
   * (press the movement key toward the target) to face it first. Facing stays keyboard-driven; the
   * mouse only aims within the forward arc (up / down / diagonal on the facing side).
   */
  aimingForward(pointer) {
    const facingDir = this.facingRight ? 1 : -1;
    return (pointer.worldX - this.x) * facingDir >= 0;
  }

  spawnBullet() {
    const pointer = this.scene.input.activePointer;
    const dir = this.facingRight ? 1 : -1;
    const mx = this.x + dir * CONFIG.muzzleOffset.x; // gun tip on the facing side
    const my = this.y + CONFIG.muzzleOffset.y;

    const dx = pointer.worldX - mx;
    const dy = pointer.worldY - my;
    const len = Math.hypot(dx, dy);
    if (len === 0) return;
    const vx = (dx / len) * CONFIG.weapon.bulletSpeed;
    const vy = (dy / len) * CONFIG.weapon.bulletSpeed;

    const bullet = this.bulletGroup.get(mx, my, CONFIG.TEXTURE_MAP.bullet);
    if (bullet) {
      bullet.fire(mx, my, vx, vy);
      this.ammo--;
      this.play('player-shoot', true); // shoot pose (one-shot; hurt/death outrank it)

      // Screen shake — subtle per-shot recoil
      this.scene.cameras.main.shake(CONFIG.shake.onShoot.duration, CONFIG.shake.onShoot.intensity);

      // Muzzle flash at the gun tip
      this.scene.muzzleEmitter.explode(CONFIG.particles.muzzle.count, mx, my);
    }
  }

  /**
   * Animation controller — reads state each frame and plays the matching anim.
   * Never changes movement/shoot/jump mechanics. Priority (highest first):
   *   death  → handled at the dead early-return in update()
   *   hurt   → explicit hurtTimer (NOT anims.isPlaying), outranks reload + shoot
   *   reload → sustained while reloading
   *   shoot  → one-shot; let it finish before locomotion resumes
   *   locomotion → run (sprint) / walk (move) / idle; airborne uses idle (no jump frames)
   */
  updateAnimation(onGround, moving, sprinting) {
    if (this.hurtTimer > 0) { this.play('player-hurt', true); return; }
    if (this.reloading) { this.play('player-reload', true); return; }
    if (this.anims.isPlaying && this.anims.currentAnim?.key === 'player-shoot') return;
    const key = !onGround ? 'player-idle'
      : moving ? (sprinting ? 'player-run' : 'player-walk')
      : 'player-idle';
    this.play(key, true);
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
      this.play('player-death', true); // one-shot, holds last frame (outranks all via dead early-return)
      this.setTint(0x880000); // dark red corpse
      this.body.setVelocity(0, 0);
      this.body.enable = false; // fix: corpse can't be shoved by enemies
      return;
    }

    // Alive hit → hurt animation (top priority while the timer runs) + brief red flash
    this.hurtTimer = this.hurtDuration;
    this.play('player-hurt', true);
    this.setTint(0xff0000);
    this.scene.time.delayedCall(80, () => {
      if (this.active && !this.dead) this.clearTint();
    });
  }

  /**
   * Restore health from a pickup (L5). Clamped to playerMaxHealth (no overheal); ignored when dead.
   * @param {number} amount  HP to add
   */
  heal(amount) {
    if (this.dead) return;
    this.health = Math.min(CONFIG.playerMaxHealth, this.health + amount);
  }
}
