import { Physics, Input } from 'phaser';
import { CONFIG, PLAYER_BODY } from '../config.js';
import { runState } from '../runState.js';

/**
 * Player — a 12×20 Arcade physics sprite controlled by the keyboard + mouse.
 *
 * Movement:  A/D or Left/Right arrows for horizontal movement.
 * Sprint:    Hold Shift to move faster.
 * Jump:      Space / Up Arrow, with coyote-time (grace after leaving ground) and
 *            jump-buffer (press slightly before landing still counts).
 * Aim:       Mouse pointer — facing direction follows the pointer, not movement.
 * Shoot:     Left-click. Fire mode is per-weapon (P3.2): 'auto' weapons (rifle/smg) fire while held at
 *            fireRate shots/sec; 'single' weapons (shotgun) fire once per click (press edge).
 * Switch:    1 / 2 / 3 select rifle / shotgun / smg (WEAPONS order). Each weapon keeps its own mag.
 * Reload:    R key — refills the ACTIVE weapon's mag over its reloadTime.
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
      // Weapon-switch keys — order-matched to Object.keys(CONFIG.WEAPONS) in update().
      one: scene.input.keyboard.addKey(Input.Keyboard.KeyCodes.ONE),
      two: scene.input.keyboard.addKey(Input.Keyboard.KeyCodes.TWO),
      three: scene.input.keyboard.addKey(Input.Keyboard.KeyCodes.THREE),
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
    this.contactKbTimer = 0;   // s — cooldown gating enemy-contact shoves (prevents the juggle/bounce-lock)
    this.blinkTimer = 0;       // s — accumulator for alpha blink toggle
    this.hurtTimer = 0;        // s — remaining hurt-animation window (drives anim priority)
    // Hurt-anim display length read from the registered anim itself — not a magic number.
    this.hurtDuration = scene.anims.get('player-hurt').duration / 1000;

    // --- Movement state ---
    this.facingRight = true;  // movement direction — drives sprite flip, gun side, camera look-ahead
    this.coyoteTimer = 0; // s — grace window after leaving ground
    this.jumpBufferTimer = 0; // s — buffered jump press

    // --- Shooting / weapon state (P3.2) ---
    this.bulletGroup = bulletGroup;
    this.shootTimer = 0; // s — cooldown until next shot allowed. SHARED across weapons (carries across a
    // switch) so you can't spam-switch to dodge fire-rate.
    this.currentWeaponId = runState.unlockedWeapons[0]; // start on the first unlocked weapon (rifle); stats read live
    // Per-weapon CURRENT mag, keyed by weapon id (reserve ammo is out of scope until P3.5). Each mag
    // starts full from the RUNTIME magSize (so a magSize upgrade is reflected the next level), and is
    // tracked independently, so switching weapons preserves each one's remaining rounds.
    this.ammo = {};
    for (const id of Object.keys(CONFIG.WEAPONS)) this.ammo[id] = runState.weapons[id].magSize;
    this.reloading = false;
    this.reloadTimer = 0; // s — remaining reload time (of the active weapon)
    this.prevPointerDown = false; // last frame's pointer state — for 'single' fire-mode press-edge detection
  }

  /** The active weapon's stats, read LIVE from the RUNTIME table (runState.weapons — the upgrade-modified
   * clone of CONFIG.WEAPONS). Never snapshotted: an upgrade's recompute() is seen on the very next read,
   * and the bullet is stamped from it at fire time, so upgrades reach the projectile with no engine change. */
  get weapon() {
    return runState.weapons[this.currentWeaponId];
  }

  /**
   * Switch the active weapon (keys 1/2/3). No-op if it's already active or the player is dead/won.
   * Cancels any in-progress reload (no refund) but leaves the SHARED shootTimer untouched, so
   * spam-switching can't beat the fire-rate cadence. Per-weapon mags are preserved (each lives in
   * this.ammo[id]); the swap only changes which id is active.
   */
  switchWeapon(id) {
    if (this.dead || this.won) return;
    if (id === this.currentWeaponId || !CONFIG.WEAPONS[id]) return;
    if (!runState.isUnlocked(id)) return; // P3.3: locked weapons (shotgun/smg until bought) can't be selected
    this.currentWeaponId = id;
    this.reloading = false;
    this.reloadTimer = 0;
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
    const { moveSpeed, sprintMultiplier, jumpVelocity, coyoteTime, jumpBuffer,
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

    // --- Contact-shove cooldown — longer than knockback, so a cluster can't re-launch every 0.15s ---
    if (this.contactKbTimer > 0) {
      this.contactKbTimer -= dt;
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

    // --- Weapon switching (1/2/3 → WEAPONS order) ---
    const weaponIds = Object.keys(CONFIG.WEAPONS);
    const switchKeys = [this.keys.one, this.keys.two, this.keys.three];
    for (let i = 0; i < switchKeys.length && i < weaponIds.length; i++) {
      if (Input.Keyboard.JustDown(switchKeys[i])) this.switchWeapon(weaponIds[i]);
    }

    // Read the active weapon AFTER the switch loop so a switch-this-frame is reflected in the shooting +
    // reload logic below (fireMode/fireRate/magSize/reloadTime), keeping it consistent with the mag and
    // fireWeapon(), which read the live weapon too. Getter → CONFIG.WEAPONS[currentWeaponId].
    const weapon = this.weapon;

    // --- Shooting — fire mode is per-weapon: 'auto' fires while held, 'single' on the pointer press edge
    // (Phaser Pointer has no JustDown, so detect the edge against last frame's state). Both share the
    // same gate: cooldown up, mag has rounds, not reloading, cursor on the forward arc. ---
    this.shootTimer = Math.max(0, this.shootTimer - dt);
    const pointerJustDown = pointer.isDown && !this.prevPointerDown;
    const wantFire = weapon.fireMode === 'single' ? pointerJustDown : pointer.isDown;
    const mag = this.ammo[this.currentWeaponId];

    if (wantFire && this.shootTimer <= 0 && mag > 0 && !this.reloading && this.aimingForward(pointer)) {
      this.shootTimer = 1 / weapon.fireRate;
      this.fireWeapon(); // aim geometry + pellet spread (from the gun tip) lives in fireWeapon
    }

    // --- Reload (refills the ACTIVE weapon's mag) ---
    if (Input.Keyboard.JustDown(reload) && this.ammo[this.currentWeaponId] < weapon.magSize && !this.reloading) {
      this.reloading = true;
      this.reloadTimer = weapon.reloadTime;
    }

    if (this.reloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        this.ammo[this.currentWeaponId] = weapon.magSize;
        this.reloading = false;
        this.reloadTimer = 0;
      }
    }

    // Track pointer state for next frame's press-edge detection. Set UNCONDITIONALLY every live frame
    // (not inside the fire branch) or 'single' mode would stick down after the first shot and auto-fire.
    this.prevPointerDown = pointer.isDown;

    // --- Facing: sprite + gun flip with movement direction (NOT the mouse) ---
    this.setFlipX(!this.facingRight);

    // --- Animation controller (reads state → plays anim; never changes mechanics) ---
    const moving = (moveLeft || moveRight) && !(moveLeft && moveRight);
    this.updateAnimation(onGround, moving, sprint.isDown);
  }

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

  /**
   * Fire the active weapon: one trigger pull = one ammo = `pellets` bullets fanned within ±spreadDeg/2
   * of the aim vector (spread 0 ⇒ a single straight round, identical to the old rifle). The muzzle
   * point (mx,my) is the feet origin + muzzleOffset on the facing side (tracks the drawn gun); the aim
   * is recomputed FROM the tip so close-range shots point true. Each bullet is STAMPED with the weapon's
   * damage/range/tint at fire time (Bullet.fire) so it's unaffected by a later weapon switch. Ammo
   * decrements once; muzzle flash / shoot anim / camera shake fire once per shot (not per pellet).
   * Fire-rate/mag/reload gating stays in update().
   */
  fireWeapon() {
    const weapon = this.weapon;
    const pointer = this.scene.input.activePointer;
    const dir = this.facingRight ? 1 : -1;
    const mx = this.x + dir * CONFIG.muzzleOffset.x; // gun tip on the facing side — muzzle FLASH origin
    const my = this.y + CONFIG.muzzleOffset.y;

    // Bullets spawn from the player's CENTRE at gun height, NOT the gun tip. A tip-spawned round (26px
    // ahead) overshoots a point-blank enemy sitting between the player and the tip: firing at anything on
    // the enemy's far side sends the bullet away from it → the "can't hit when too close" bug. Spawning at
    // centre removes that forward blind spot and still aims true up close. The flash stays at the tip (mx,my).
    const bx = this.x;
    const by = my;

    const dx = pointer.worldX - bx;
    const dy = pointer.worldY - by;
    const len = Math.hypot(dx, dy);
    if (len === 0) return;
    const baseAngle = Math.atan2(dy, dx); // aim FROM the bullet spawn (player centre)

    // One trigger pull = one ammo, regardless of pellet count.
    this.ammo[this.currentWeaponId]--;

    // Spawn each pellet, its velocity rotated by a random offset within ±spreadDeg/2 of the aim (0 for a
    // single straight round). Each is stamped with the firing weapon's stats, so it carries them to impact.
    const spreadRad = (weapon.spreadDeg * Math.PI) / 180;
    const stats = { damage: weapon.damage, range: weapon.range, tint: weapon.projectileTint };
    for (let i = 0; i < weapon.pellets; i++) {
      const angle = baseAngle + (Math.random() - 0.5) * spreadRad;
      const vx = Math.cos(angle) * weapon.bulletSpeed;
      const vy = Math.sin(angle) * weapon.bulletSpeed;
      const bullet = this.bulletGroup.get(bx, by, CONFIG.TEXTURE_MAP.bullet);
      if (bullet) bullet.fire(bx, by, vx, vy, stats);
    }

    // --- Per-shot feedback — once per trigger pull, outside the pellet loop ---
    this.play('player-shoot', true); // shoot pose (one-shot; hurt/death outrank it)
    this.scene.cameras.main.shake(CONFIG.shake.onShoot.duration, CONFIG.shake.onShoot.intensity);

    // Muzzle flash at the gun tip, scaled to this weapon. Setting the scale op's START (not
    // setParticleScale, which would drop the start→0 fade) keeps the shrink while sizing the flash:
    // base scaleStart × the weapon's muzzleScale.
    const muzzle = CONFIG.particles.muzzle;
    const flashScale = muzzle.scaleStart * weapon.muzzleScale;
    this.scene.muzzleEmitter.ops.scaleX.start = flashScale;
    this.scene.muzzleEmitter.ops.scaleY.start = flashScale;
    this.scene.muzzleEmitter.explode(muzzle.count, mx, my);
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
      // Zero velocity but KEEP the body enabled so gravity + the terrain collider settle the corpse on
      // the ground (disabling it froze the corpse mid-air wherever it died — the "floating corpse" bug).
      // Enemies overlap (never collide with) the player, and onPlayerTouchEnemy/takeDamage/acid all skip
      // when `dead`, so the corpse can't be shoved regardless.
      this.body.setVelocity(0, 0);
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
