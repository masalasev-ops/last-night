import { Scene, Input } from 'phaser';
import { CONFIG, ASSETS } from '../config.js';
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
    const { LEVEL, endMarker, palette } = CONFIG;

    // Parallax forest background — 4 camera-pinned layers scrolling at different rates
    this.buildParallax();

    // World bounds (physics + camera clamping)
    this.physics.world.setBounds(0, 0, LEVEL.worldWidth, LEVEL.worldHeight);

    // Forest terrain — real tileset ground + one-way platforms (sets this.terrain, this.groundRow)
    this.buildTerrain();

    // End marker — tall bright rectangle on the far right (visual; win trigger uses endMarkerX)
    const markerX = LEVEL.endMarkerX;
    const markerY = LEVEL.groundY - endMarker.height / 2;
    this.add.rectangle(markerX, markerY, endMarker.width, endMarker.height, hexToInt(palette.bullet));

    // --- Bullet pool (created before Player so we can pass it in) ---
    this.bullets = this.physics.add.group({
      classType: Bullet,
      maxSize: CONFIG.pistol.bulletPoolSize,
      runChildUpdate: true, // calls preUpdate on active bullets each frame
    });

    // --- Player ---
    this.player = new Player(this, LEVEL.spawn.x, LEVEL.spawn.y, this.bullets);

    // --- Collisions (one-way platforms via process callback; ground fully solid) ---
    this.physics.add.collider(this.player, this.terrain, null, this.terrainProcess, this);

    // --- Enemy pool (created after Player so spawn loop can set enemy.player) ---
    this.enemies = this.physics.add.group({
      classType: Enemy,
      maxSize: CONFIG.enemy.enemyPoolSize,
      runChildUpdate: true, // calls preUpdate on active enemies each frame
    });

    // Spawn each enemy from level config (each entry chooses a Zombie_N type)
    for (const pos of LEVEL.enemies) {
      const enemy = this.enemies.get(pos.x, pos.y);
      if (enemy) {
        enemy.spawn(pos.x, pos.y, pos.type);
        enemy.player = this.player; // AI targeting reference
      }
    }

    // Enemy collisions & overlaps
    this.physics.add.collider(this.enemies, this.terrain, null, this.terrainProcess, this);
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
    this.cameras.main.setFollowOffset(CONFIG.camera.lookAhead, CONFIG.camera.followOffsetY);

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

    // Debug: right-click spawns a random-type zombie at the pointer position
    if (this.debugOn && this.input.activePointer.rightButtonDown()) {
      const worldX = this.input.activePointer.worldX;
      const worldY = this.input.activePointer.worldY;
      const enemy = this.enemies.get(worldX, worldY);
      if (enemy) {
        const types = ['Zombie_1', 'Zombie_2', 'Zombie_3', 'Zombie_4'];
        enemy.spawn(worldX, worldY, types[Math.floor(Math.random() * types.length)]);
        enemy.player = this.player;
      }
    }

    // Directional camera look-ahead: lead whichever way the player faces
    const lookX = this.player.facingRight
      ? CONFIG.camera.lookAhead
      : -CONFIG.camera.lookAhead;
    this.cameras.main.setFollowOffset(lookX, CONFIG.camera.followOffsetY);

    // Parallax: scroll each pinned bg layer's texture proportional to camera scroll
    const sx = this.cameras.main.scrollX;
    for (const { ts, factor } of this.bgLayers) ts.tilePositionX = sx * factor;
  }

  /**
   * Build the 4-layer parallax background. Each layer is a camera-pinned tileSprite
   * (scrollFactor 0), bottom-aligned to the view; its texture scrolls in update() at the
   * layer's parallax factor (far/Sky ~0.10 barely moves, near/Flora1 ~0.70 moves most).
   */
  buildParallax() {
    this.bgLayers = ASSETS.bgLayers.map(([, factor], i) => {
      const ts = this.add
        .tileSprite(0, CONFIG.height, CONFIG.width, 544, `bg-layer-${i}`)
        .setOrigin(0, 1)          // bottom-left anchor at the view's bottom
        .setScrollFactor(0)       // pinned to the camera; we scroll the texture instead
        .setDepth(-10 + i);       // behind the world, far → near
      return { ts, factor };
    });
  }

  /**
   * Build the forest terrain as a code-authored Phaser tilemap:
   *   - a continuous grass-top ground (fully solid) across the whole world, and
   *   - the tuned platform layout snapped to the 32px grid (one-way, land-on-top-only).
   * The layer is offset vertically so the grass surface lands exactly on LEVEL.groundY,
   * leaving spawn/enemy/end-marker data untouched. Sets this.terrain and this.groundRow.
   */
  buildTerrain() {
    const { LEVEL, TILES } = CONFIG;
    const T = TILES.size;
    const cols = Math.ceil(LEVEL.worldWidth / T);
    const rows = Math.ceil((LEVEL.worldHeight + T * 3) / T);
    this.groundRow = Math.round(LEVEL.groundY / T);   // grass-surface row
    const layerY = LEVEL.groundY - this.groundRow * T; // shift grid so surface == groundY (524)

    const map = this.make.tilemap({ tileWidth: T, tileHeight: T, width: cols, height: rows });
    const tileset = map.addTilesetImage('tiles', 'tileset', T, T);
    const layer = map.createBlankLayer('terrain', tileset, 0, layerY, cols, rows, T, T);
    this.terrain = layer;

    // Continuous ground: grass surface row + solid fill all the way down (indices cycle per column).
    const { groundTop, groundFill } = TILES;
    for (let c = 0; c < cols; c++) {
      layer.putTileAt(groundTop[c % groundTop.length], c, this.groundRow);
      for (let r = this.groundRow + 1; r < rows; r++) {
        layer.putTileAt(groundFill[c % groundFill.length], c, r);
      }
    }

    // Floating platforms: snap each rect to grid columns/row, place 1-tile grass tiles L/mid/R.
    for (const p of LEVEL.platforms) {
      const left = Math.round((p.x - p.width / 2) / T);
      const right = Math.round((p.x + p.width / 2) / T) - 1; // inclusive last column
      const row = Math.round((p.y - layerY) / T);            // snap platform top to a grid row
      for (let c = left; c <= right; c++) {
        const idx = c === left ? TILES.platformL : c === right ? TILES.platformR : TILES.platformMid;
        layer.putTileAt(idx, c, row);
      }
    }

    layer.setCollision(TILES.solid); // mark solids collidable; terrainProcess refines to one-way
  }

  /**
   * Collider process callback. Ground rows (>= groundRow) are fully solid. Floating
   * platform tiles are one-way: collide only when the body is descending AND its previous
   * bottom was above the tile top — so you jump up through them and land on top, never
   * bonking your head or clipping a side.
   */
  terrainProcess(obj, tile) {
    if (tile.y >= this.groundRow) return true; // ground: fully solid
    const b = obj.body;
    const tileTop = this.terrain.y + tile.pixelY; // world Y of the tile's top (no allocation)
    return b.velocity.y >= 0 && b.prev.y + b.height <= tileTop + 2;
  }

  /**
   * Player-enemy overlap callback.
   * Pushes the player away on contact — gated on knockbackTimer so it only
   * fires once per contact (not every overlapping frame).
   * Damage is handled separately by the enemy's ATTACK state.
   */
  onPlayerTouchEnemy(player, enemy) {
    if (!player.active || !enemy.active || player.dead || enemy.state === 'DEAD') return;
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
    if (!bullet.active || !enemy.active || enemy.state === 'DEAD') return;

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
