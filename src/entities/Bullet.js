import { Physics } from 'phaser';
import { CONFIG } from '../config.js';

/**
 * Bullet — a pooled Arcade physics sprite.
 *
 * Belongs to a Phaser Group with runChildUpdate:true, which calls preUpdate()
 * automatically on every active bullet each frame.
 *
 * Lifecycle:
 *   - Created once by the pool (Group.get), starts inactive/invisible.
 *   - fire(x, y, vx, vy, stats) → activates, repositions, sets velocity, and STAMPS the shot's
 *     damage/range/tint onto the bullet (P3.2). Per-shot properties live on the projectile, not on a
 *     global weapon — so a weapon switch (or two weapons' rounds in flight at once) never mutates a
 *     round already travelling: it carries the stats it was fired with to impact.
 *   - preUpdate() tracks distance travelled; deactivates when past its own `range`.
 *   - deactivate() → invisible, stopped, tint cleared, returned to pool for reuse.
 *
 * No `new Bullet()` in the hot path — the group reuses inactive members.
 */
export class Bullet extends Physics.Arcade.Sprite {
  /**
   * @param {Phaser.Scene} scene
   * @param {number} x
   * @param {number} y
   */
  constructor(scene, x, y) {
    super(scene, x, y, CONFIG.TEXTURE_MAP.bullet);

    // Start dead in the pool — invisible, no physics updates.
    this.setActive(false);
    this.setVisible(false);
  }

  /**
   * Activate this bullet and send it flying from (x, y) at the given velocity, stamping the shot's
   * per-projectile properties. Called by Player.fireWeapon() via group.get().
   *
   * @param {number} x  spawn position
   * @param {number} y
   * @param {number} velocityX  px/s
   * @param {number} velocityY  px/s
   * @param {{damage:number, range:number, tint:?number}} stats  resolved from the firing weapon; the
   *   bullet carries these to impact so a mid-flight weapon switch can't change them. tint == null →
   *   the bare bullet texture (rifle); a non-white tint multiply-colours it (shotgun/smg).
   */
  fire(x, y, velocityX, velocityY, stats) {
    this.setPosition(x, y);
    this.setActive(true);
    this.setVisible(true);
    this.body.enable = true;
    this.body.setVelocity(velocityX, velocityY);
    this.distanceTraveled = 0;

    // Stamp per-shot properties onto the projectile (the P3.2 refactor).
    this.damage = stats.damage;
    this.range = stats.range;
    stats.tint == null ? this.clearTint() : this.setTint(stats.tint);
  }

  /**
   * Called automatically each frame by Phaser (via runChildUpdate on the group).
   * Tracks how far the bullet has flown and deactivates it when it exceeds range.
   *
   * @param {number} time
   * @param {number} delta  ms since last frame
   */
  preUpdate(time, delta) {
    super.preUpdate(time, delta);

    // Accumulate Euclidean distance travelled this frame
    const vx = this.body.velocity.x;
    const vy = this.body.velocity.y;
    this.distanceTraveled += Math.sqrt(vx * vx + vy * vy) * (delta / 1000);

    if (this.distanceTraveled >= this.range) {
      this.deactivate();
      return;
    }

    // Safety net — deactivate if it somehow leaves the world bounds
    const { worldWidth, worldHeight } = CONFIG.LEVEL;
    if (this.x < 0 || this.x > worldWidth || this.y < 0 || this.y > worldHeight) {
      this.deactivate();
    }
  }

  /** Return this bullet to the pool — invisible, stopped, inactive, tint cleared so a reused round
   * doesn't inherit a stale weapon tint. */
  deactivate() {
    this.setActive(false);
    this.setVisible(false);
    this.body.enable = false;
    this.body.stop();
    this.distanceTraveled = 0;
    this.clearTint();
  }
}
