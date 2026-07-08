import { Physics } from 'phaser';
import { CONFIG } from '../config.js';

/**
 * AcidProjectile — a pooled, BALLISTIC enemy projectile (P3.1). Mirrors Bullet.js, but arcs under its
 * own projectile gravity so it can reach a player perched on a ledge above the spitter.
 *
 * Belongs to a Phaser Group with runChildUpdate:true → preUpdate() runs each frame on active globs.
 *
 * Lifecycle:
 *   - Created once by the pool (Group.get), starts inactive/invisible.
 *   - fire(x, y, vx, vy) → activates, positions, sets velocity + enables gravity for the arc.
 *   - preUpdate() ages it out after `lifespan` (or if it leaves the world) → splat + deactivate.
 *   - GameScene overlap/collider also splat+deactivate on the player / ground.
 * No `new AcidProjectile()` in the hot path — the group reuses inactive members.
 */
export class AcidProjectile extends Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, CONFIG.TEXTURE_MAP.acid);
    this.setActive(false);
    this.setVisible(false);
  }

  /**
   * Launch this glob from (x, y) at the given velocity, arcing under acid gravity.
   * @param {number} x
   * @param {number} y
   * @param {number} velocityX  px/s
   * @param {number} velocityY  px/s (negative = upward lob)
   */
  fire(x, y, velocityX, velocityY) {
    this.setPosition(x, y);
    this.setActive(true);
    this.setVisible(true);
    this.body.enable = true;
    this.body.setCircle(CONFIG.acid.bodyRadius); // tight round hit body (art never drives it)
    this.body.setAllowGravity(true);
    // Arcade ADDS body gravity to the world gravity (2800), so subtract the world's out → the glob's
    // NET downward accel is exactly CONFIG.acid.gravityY, matching the lob solve in GameScene.spawnAcid.
    this.body.setGravityY(CONFIG.acid.gravityY - this.scene.physics.world.gravity.y);
    this.body.setVelocity(velocityX, velocityY);
    this.age = 0;
  }

  /** Called each frame by the pool. Ages the glob out after its lifespan or if it leaves the world. */
  preUpdate(time, delta) {
    super.preUpdate(time, delta);

    this.age += delta / 1000;
    const { worldWidth, worldHeight } = CONFIG.LEVEL;
    if (this.age >= CONFIG.acid.lifespan || this.x < 0 || this.x > worldWidth || this.y > worldHeight) {
      this.scene.acidSplat(this.x, this.y);
      this.deactivate();
    }
  }

  /** Return this glob to the pool — invisible, stopped, gravity reset off so an idle one doesn't drift. */
  deactivate() {
    this.setActive(false);
    this.setVisible(false);
    this.body.stop();
    this.body.setAllowGravity(false);
    this.body.enable = false;
    this.age = 0;
  }
}
