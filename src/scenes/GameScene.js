import { Scene, Input, BlendModes } from 'phaser';
import { CONFIG, ASSETS, PLAYER_BODY } from '../config.js';
import { Player } from '../entities/Player.js';
import { Bullet } from '../entities/Bullet.js';
import { Enemy } from '../entities/Enemy.js';
import { Pickup } from '../entities/Pickup.js';
import { AcidProjectile } from '../entities/AcidProjectile.js';

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
      maxSize: CONFIG.weapon.bulletPoolSize,
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

    // --- Pickups (L5): health chests from level data; overlap heals the player ---
    this.pickups = this.physics.add.group({ classType: Pickup, runChildUpdate: true });
    for (const pos of LEVEL.pickups ?? []) {
      const pickup = this.pickups.get(pos.x, pos.y);
      if (pickup) pickup.spawn(pos.x, pos.y, pos.type);
    }
    this.physics.add.overlap(this.player, this.pickups, this.onPickup, null, this);

    // --- Acid projectiles (P3.1): pooled ballistic globs spat by ranged enemies ---
    this.acid = this.physics.add.group({
      classType: AcidProjectile,
      maxSize: CONFIG.acid.poolSize,
      runChildUpdate: true,
    });
    // Green splat burst (explode-only, like the blood/impact emitters)
    this.acidSplatEmitter = this.add.particles(0, 0, '__PARTICLE_ACID', {
      speed: { min: impact.speedMin, max: impact.speedMax },
      angle: { min: 0, max: 360 },
      scale: { start: 0.7, end: 0 },
      lifespan: impact.lifespan,
      emitting: false,
    });
    // Acid hits the player → damage + splat; hits the solid GROUND → splat (passes through one-way
    // platforms via the acidGroundOnly filter, so it can arc over a ledge onto a perched player).
    this.physics.add.overlap(this.player, this.acid, this.onAcidHitPlayer, null, this);
    this.physics.add.collider(this.acid, this.terrain, this.onAcidHitGround, this.acidGroundOnly, this);

    // --- Atmosphere (L4) — gated behind the master switch. Off by default: the darkness overlay
    // hid the player/zombies too much to enjoy the level. When enabled it re-adds the full night
    // mode (vignette + optional night grade + darkness/flashlight overlay + fog). ---
    this.darkness = null; // set below only when atmosphere is enabled; update() guards on it
    if (CONFIG.atmosphere.enabled) {
      const cam = this.cameras.main;
      const v = CONFIG.vignette;
      if (v.enabled) cam.filters.external.addVignette(v.x, v.y, v.radius, v.strength, v.color);
      // Night ColorMatrix is opt-in — even low amounts over-darken, so it's off by default
      // (the vignette filter + dark overlay carry the mood). Guarded so it stays re-enableable.
      if (CONFIG.atmosphere.night > 0) {
        cam.filters.internal.addColorMatrix().colorMatrix.night(CONFIG.atmosphere.night);
      }

      // Darkness overlay. Two modes:
      //   flashlight: true  → a camera-pinned RenderTexture re-filled each frame with the player glow
      //                       + gun cone erased into it (a moving lit "window"; see updateLighting).
      //   flashlight: false → a flat, static uniform dark tint (no moving cutout). this.darkness stays
      //                       null so update() skips the per-frame lighting redraw.
      if (CONFIG.atmosphere.flashlight) {
        this.darkness = this.add
          .renderTexture(0, 0, CONFIG.width, CONFIG.height)
          .setOrigin(0, 0)
          .setScrollFactor(0)
          .setDepth(1000);
      } else {
        this.add
          .rectangle(0, 0, CONFIG.width, CONFIG.height, CONFIG.atmosphere.darkColor, CONFIG.atmosphere.darkAlpha)
          .setOrigin(0, 0)
          .setScrollFactor(0)
          .setDepth(1000);
      }

      // Fog: soft drifting puffs just beneath the darkness, so the flashlight catches them.
      const fog = CONFIG.atmosphere.fog;
      this.add
        .particles(0, 0, '__FOG', {
          x: { min: 0, max: CONFIG.width },
          y: { min: CONFIG.height * 0.35, max: CONFIG.height },
          frequency: fog.frequency,
          lifespan: fog.lifespan,
          alpha: { start: fog.alpha, end: 0 },
          scale: fog.scale,
          speedX: { min: fog.speedMin, max: fog.speedMax },
          speedY: { min: -4, max: 4 },
        })
        .setScrollFactor(0)
        .setDepth(999);
    }

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

    // --- Intro beat (L5): fade the view in; UIScene shows the title card (non-blocking) ---
    this.cameras.main.fadeIn(CONFIG.intro.fadeMs);

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

    // Darkness overlay: erase the player glow + gun flashlight cone this frame (only when the
    // night atmosphere is enabled — otherwise there's no overlay to redraw)
    if (this.darkness) this.updateLighting();

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
   * Redraw the darkness overlay each frame: fill near-black, then ERASE a soft body glow and
   * the gun flashlight cone into it. The glow keeps the hero (and nearby zombies) dimly
   * visible; the cone apex sits at the gun muzzle (reusing muzzleOffset) and points at the
   * cursor — the same direction bullets travel.
   */
  updateLighting() {
    const cam = this.cameras.main;
    const p = this.player;
    const A = CONFIG.atmosphere;
    const m = CONFIG.muzzleOffset;
    const dir = p.facingRight ? 1 : -1;

    // Gun muzzle (world) — the exact point bullets spawn from
    const muzzleWX = p.x + dir * m.x;
    const muzzleWY = p.y + m.y;
    const ptr = this.input.activePointer;
    const angleDeg = (Math.atan2(ptr.worldY - muzzleWY, ptr.worldX - muzzleWX) * 180) / Math.PI;

    // Screen-space positions (the overlay is camera-pinned)
    const muzzleX = muzzleWX - cam.scrollX;
    const muzzleY = muzzleWY - cam.scrollY;
    const glowX = p.x - cam.scrollX;
    const glowY = p.y - cam.scrollY - PLAYER_BODY.height / 2; // body centre

    const rt = this.darkness;
    rt.clear();
    rt.fill(A.darkColor, A.darkAlpha);
    rt.stamp('__LIGHT_RADIAL', null, glowX, glowY, { blendMode: BlendModes.ERASE, scale: A.glowScale });
    rt.stamp('__LIGHT_CONE', null, muzzleX, muzzleY, { blendMode: BlendModes.ERASE, angle: angleDeg, originX: 0, originY: 0.5, scale: A.coneScale });
    rt.render();
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
   * Player-pickup overlap callback (L5).
   * Health chest: collect + heal ONLY if the player isn't at full HP — otherwise leave it be.
   * The overlap fires every frame, so an untouched chest is simply offered again when the player
   * returns hurt (it is NOT consumed on first contact at full health).
   */
  onPickup(player, pickup) {
    if (!player.active || !pickup.active || player.dead) return;

    if (pickup.type === 'health') {
      if (player.health >= CONFIG.playerMaxHealth) return; // full HP → leave the chest for later
      player.heal(CONFIG.pickup.heal);
      this.impactEmitter.explode(CONFIG.particles.impact.count, pickup.x, pickup.y); // collect "pop"
      pickup.collect();
    }
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
    enemy.takeDamage(CONFIG.weapon.damage);
  }

  /**
   * Fire one arcing acid glob from a ranged enemy at the player's current position (P3.1).
   * Solves a ballistic lob under CONFIG.acid.gravityY: pick a flight time T (scaled by horizontal
   * distance, floored at minLobTime so a near-overhead shot can't blow up), then vx = dx/T and
   * vy = (dy − ½gT²)/T lands the glob on the target. Because it arcs, a perched player is reachable.
   */
  spawnAcid(enemy, player) {
    const g = CONFIG.acid.gravityY;
    // Muzzle origin: prefer the enemy's explicit muzzleOffset (px from feet-origin, decoupled from
    // the hitbox so body retuning never moves the spit). Fall back to the old body-relative estimate
    // for the placeholder blob / any ranged enemy without one. The ballistic solve below is unchanged.
    const off = enemy.muzzleOffset;
    // off is measured in unscaled texture px from the feet-origin → scale it by the sprite's art scale.
    const mx = off ? enemy.x + off.x * enemy.scaleX : enemy.x;
    const my = off ? enemy.y + off.y * enemy.scaleY : enemy.y - enemy.body.height * 0.6;
    const tx = player.x;
    const ty = player.y - PLAYER_BODY.height * 0.5;         // aim at the player's torso
    const dx = tx - mx;
    const dy = ty - my;

    const T = Math.max(CONFIG.acid.minLobTime, Math.abs(dx) / CONFIG.acid.speed);
    const vx = dx / T;
    const vy = (dy - 0.5 * g * T * T) / T;

    const glob = this.acid.get(mx, my);
    if (glob) glob.fire(mx, my, vx, vy);
  }

  /** Acid overlaps the player → damage, splat, retire the glob. */
  onAcidHitPlayer(player, acid) {
    if (!player.active || !acid.active || player.dead) return;
    player.takeDamage(CONFIG.acid.damage, acid.x);
    this.acidSplat(acid.x, acid.y);
    acid.deactivate();
  }

  /** Acid collides with the ground → splat, retire the glob. */
  onAcidHitGround(acid) {
    if (!acid.active) return;
    this.acidSplat(acid.x, acid.y);
    acid.deactivate();
  }

  /**
   * Collider process filter: acid only splats on the SOLID GROUND (rows ≥ groundRow), passing through
   * one-way floating platforms — so a glob can arc over/around a ledge to reach a perched player
   * instead of splatting on the platform's edge short of them.
   */
  acidGroundOnly(acid, tile) {
    return tile.y >= this.groundRow;
  }

  /** Green acid splat burst at (x, y). */
  acidSplat(x, y) {
    this.acidSplatEmitter.explode(CONFIG.particles.impact.count, x, y);
  }
}

/** Convert a CSS hex string like '#1c2230' to a Phaser integer 0x1c2230. */
const hexToInt = (hex) => parseInt(hex.replace('#', ''), 16);
