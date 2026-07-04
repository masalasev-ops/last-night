import { Scene, Input } from 'phaser';
import { CONFIG } from '../config.js';
import { Player } from '../entities/Player.js';
import { Bullet } from '../entities/Bullet.js';
import { Enemy } from '../entities/Enemy.js';

/**
 * GameScene — the main gameplay scene.
 * Holds the level, player, enemies, bullets, and camera.
 *
 * Step 2: multi-screen level with platforms, end marker, and follow camera.
 */
export class GameScene extends Scene {
  constructor() {
    super('Game');
  }

  create() {
    const { width, height, backgroundColor, palette, LEVEL, ground, endMarker } = CONFIG;

    // Dark background fill — spans the full level width so it doesn't vanish when the camera scrolls
    this.add.rectangle(LEVEL.worldWidth / 2, LEVEL.worldHeight / 2, LEVEL.worldWidth, LEVEL.worldHeight, backgroundColor);

    // World bounds (physics + camera clamping)
    this.physics.world.setBounds(0, 0, LEVEL.worldWidth, LEVEL.worldHeight);

    // --- Level geometry (static physics group) ---
    this.platforms = this.physics.add.staticGroup();

    // Ground — a long thin rectangle across the full level width
    const groundW = LEVEL.worldWidth;
    const groundH = ground.thickness;
    const groundY = LEVEL.groundY + groundH / 2;
    const groundRect = this.add.rectangle(groundW / 2, groundY, groundW, groundH, hexToInt(palette.platforms));
    this.platforms.add(groundRect);
    groundRect.body.updateFromGameObject(); // sync physics body to display size

    // Hand-authored platforms
    for (const p of LEVEL.platforms) {
      const plat = this.add.rectangle(p.x, p.y + p.height / 2, p.width, p.height, hexToInt(palette.platforms));
      this.platforms.add(plat);
      plat.body.updateFromGameObject();
    }

    // End marker — tall bright rectangle on the far right
    const markerX = LEVEL.endMarkerX;
    const markerY = LEVEL.groundY - endMarker.height / 2;
    this.add.rectangle(markerX, markerY, endMarker.width, endMarker.height, hexToInt(palette.bullet));
    // Not in the physics group — it's visual-only for now (Step 6 adds win trigger)

    // --- Bullet pool (created before Player so we can pass it in) ---
    this.bullets = this.physics.add.group({
      classType: Bullet,
      maxSize: CONFIG.pistol.bulletPoolSize,
      runChildUpdate: true, // calls preUpdate on active bullets each frame
    });

    // --- Player ---
    this.player = new Player(this, 80, LEVEL.groundY - 40, this.bullets);

    // --- Collisions ---
    this.physics.add.collider(this.player, this.platforms);

    // --- Enemy pool (created after Player so spawn loop can set enemy.player) ---
    this.enemies = this.physics.add.group({
      classType: Enemy,
      maxSize: CONFIG.enemy.enemyPoolSize,
      runChildUpdate: true, // calls preUpdate on active enemies each frame
    });

    // Spawn each enemy from level config
    for (const pos of LEVEL.enemies) {
      const enemy = this.enemies.get(pos.x, pos.y, CONFIG.TEXTURE_MAP.enemy);
      if (enemy) {
        enemy.spawn(pos.x, pos.y);
        enemy.player = this.player; // AI targeting reference
      }
    }

    // Enemy collisions & overlaps
    this.physics.add.collider(this.enemies, this.platforms);
    // Player-enemy overlap — pushes player away once per contact (gated on knockbackTimer).
    this.physics.add.overlap(this.player, this.enemies, this.onPlayerTouchEnemy, null, this);
    this.physics.add.overlap(this.bullets, this.enemies, this.onBulletHitEnemy, null, this);

    // --- Particle emitters (explode-only bursts, pooled internally by Phaser) ---
    const { muzzle, impact, blood } = CONFIG.particles;

    this.muzzleEmitter = this.add.particles(0, 0, '__PARTICLE_MUZZLE', {
      speed: { min: muzzle.speedMin, max: muzzle.speedMax },
      angle: { min: 0, max: 360 },
      scale: { start: 0.8, end: 0 },
      lifespan: muzzle.lifespan,
      emitting: false,
    });

    this.impactEmitter = this.add.particles(0, 0, '__PARTICLE_IMPACT', {
      speed: { min: impact.speedMin, max: impact.speedMax },
      angle: { min: 0, max: 360 },
      scale: { start: 0.6, end: 0 },
      lifespan: impact.lifespan,
      emitting: false,
    });

    this.bloodEmitter = this.add.particles(0, 0, '__PARTICLE_BLOOD', {
      speed: { min: blood.speedMin, max: blood.speedMax },
      angle: { min: 0, max: 360 },
      scale: { start: 1, end: 0 },
      lifespan: blood.lifespan,
      gravityY: blood.gravityY,
      emitting: false,
    });

    // --- Vignette filter (darkens screen edges) ---
    // const v = CONFIG.vignette;
    // this.cameras.main.filters.internal.addVignette(v.x, v.y, v.radius, v.strength, v.color);

    // --- Player point light (soft radial glow, no normal maps needed) ---
    // const pl = CONFIG.playerLight;
    // this.lights.enable();
    // this.playerLight = this.lights.addPointLight(
    //   this.player.x, this.player.y,
    //   pl.color, pl.radius, pl.intensity, pl.attenuation
    // );

    // --- Debug toggle ---
    this.input.mouse.disableContextMenu();
    this.debugKey = this.input.keyboard.addKey(Input.Keyboard.KeyCodes.BACKTICK);
    this.debugOn = false;

    // --- Camera ---
    this.cameras.main.setBounds(0, 0, LEVEL.worldWidth, LEVEL.worldHeight);
    this.cameras.main.startFollow(this.player, true, CONFIG.camera.lerp, CONFIG.camera.lerp);
    this.cameras.main.setDeadzone(60, 30);
    // Initial follow offset (directionally updated in update())
    this.cameras.main.setFollowOffset(CONFIG.camera.lookAhead, -80);

    console.log('[GameScene] ready');
  }

  update(time, delta) {
    this.player.update(time, delta);

    // Restart: player died/won and pressed R
    if (this.player.wantsRestart) {
      this.scene.restart();
      this.scene.get('UI').scene.restart();
      return; // fix: no further access to torn-down scene objects
    }

    // Win condition: player reached the end marker
    if (!this.player.dead && !this.player.won && this.player.x >= CONFIG.LEVEL.endMarkerX) {
      this.player.won = true;
      this.player.body.setVelocity(0, 0);
    }

    // Player light follows the player
    // this.playerLight.setPosition(this.player.x, this.player.y);

    // --- Debug toggle (backtick `~`) ---
    if (Input.Keyboard.JustDown(this.debugKey)) {
      this.debugOn = !this.debugOn;
      this.player.godMode = this.debugOn;

      if (this.debugOn) {
        // Physics debug draw — create the debug graphic on first enable
        if (!this.physics.world.debugGraphic) {
          this.physics.world.createDebugGraphic();
        }
        this.physics.world.drawDebug = true;
      } else {
        this.physics.world.drawDebug = false;
      }
    }

    // Debug: right-click spawns an enemy at the pointer position
    if (this.debugOn && this.input.activePointer.rightButtonDown()) {
      const worldX = this.input.activePointer.worldX;
      const worldY = this.input.activePointer.worldY;
      const enemy = this.enemies.get(worldX, worldY, CONFIG.TEXTURE_MAP.enemy);
      if (enemy) {
        enemy.spawn(worldX, worldY);
        enemy.player = this.player;
      }
    }

    // Directional camera look-ahead: lead whichever way the player faces
    const lookX = this.player.facingRight
      ? CONFIG.camera.lookAhead
      : -CONFIG.camera.lookAhead;
    this.cameras.main.setFollowOffset(lookX, -80);
  }

  /**
   * Player-enemy overlap callback.
   * Pushes the player away on contact — gated on knockbackTimer so it only
   * fires once per contact (not every overlapping frame).
   * Damage is handled separately by the enemy's ATTACK state.
   */
  onPlayerTouchEnemy(player, enemy) {
    if (!player.active || !enemy.active || player.dead) return;
    // Only fire once per contact — knockbackTimer prevents re-triggering
    if (player.knockbackTimer > 0) return;

    const dir = player.x >= enemy.x ? 1 : -1;
    // Strong push: horizontal away from enemy, vertical up enough to clear them
    player.body.setVelocityX(CONFIG.knockback * 1.2 * dir);
    player.body.setVelocityY(-CONFIG.knockback * 1.0);
    player.knockbackTimer = CONFIG.knockbackDuration;
  }

  /**
   * Bullet-enemy overlap callback.
   * Deactivate the bullet; deal damage to the enemy.
   */
  onBulletHitEnemy(bullet, enemy) {
    if (!bullet.active || !enemy.active) return;

    // Impact particles at bullet position
    this.impactEmitter.explode(CONFIG.particles.impact.count, bullet.x, bullet.y);

    // Blood particles at enemy position
    this.bloodEmitter.explode(CONFIG.particles.blood.count, enemy.x, enemy.y);

    bullet.deactivate();
    enemy.takeDamage(CONFIG.pistol.damage);
  }
}

/** Convert a CSS hex string like '#1c2230' to a Phaser integer 0x1c2230. */
const hexToInt = (hex) => parseInt(hex.replace('#', ''), 16);
