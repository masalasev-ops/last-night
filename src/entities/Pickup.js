import { Physics } from 'phaser';
import { CONFIG } from '../config.js';

/**
 * Pickup — a collectible sitting in the level (L5). One health chest for the slice.
 *
 * Static object (no gravity, immovable) fitted to an EXPLICIT overlap body from config — the 64px
 * chest art never drives the hitbox (golden rule 4). A gentle vertical bob makes it read as a
 * collectible. The effect (heal) is applied by GameScene's overlap handler; collect() just retires it.
 * Falls back to the generated placeholder texture if the real chest art isn't loaded.
 *
 * Lives in a Phaser Group with runChildUpdate:true so preUpdate() (the bob) runs each frame.
 */
export class Pickup extends Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, CONFIG.TEXTURE_MAP.pickupHealth);
    this.setActive(false);
    this.setVisible(false);
    this.type = null;
  }

  /**
   * Activate this pickup at a world position (feet-origin, so it rests on the ground surface).
   * @param {number} x
   * @param {number} y     feet position (ground surface)
   * @param {string} type  'health'
   */
  spawn(x, y, type) {
    this.type = type;

    // Real chest art if its animation is registered, else the placeholder medic box.
    const hasArt = this.scene.anims.exists('pickup-chest');
    this.setTexture(hasArt ? 'pickup-chest' : CONFIG.placeholder.PICKUP.key);
    this.setScale(hasArt ? CONFIG.pickup.scale : 1);
    // Centre origin so the (centred) body stays aligned with the visible art; the chest's centre sits
    // half a display-height above the feet-y so it rests on the ground surface.
    this.setOrigin(0.5, 0.5);
    const restY = y - this.displayHeight / 2;
    this.setPosition(x, restY);
    this.baseY = restY;
    this.setActive(true);
    this.setVisible(true);

    // Explicit overlap body (not the sprite frame); static — no gravity, immovable. setSize takes
    // source-frame px and is centred on the sprite; divide by scale so the world body matches config.
    this.body.enable = true;
    this.body.setAllowGravity(false);
    this.body.setImmovable(true);
    const b = CONFIG.pickup.body;
    this.body.setSize(b.width / this.scaleX, b.height / this.scaleY);

    if (hasArt) this.play('pickup-chest');

    // Health-cross marker floating above the chest so it reads as health, not generic loot.
    this.markerDy = this.displayHeight / 2 + 12; // gap above the chest top
    if (type === 'health') {
      this.marker = this.scene.add.image(this.x, this.y - this.markerDy, '__HEALTH_CROSS');
    }
  }

  /** Gentle idle hover so it reads as collectible; the marker rides along above the chest. */
  preUpdate(time, delta) {
    super.preUpdate(time, delta);
    if (!this.active) return;
    const bob = CONFIG.pickup.bob;
    this.y = this.baseY - (Math.sin((time / 1000) * bob.speed) * 0.5 + 0.5) * bob.amp;
    if (this.marker) this.marker.setPosition(this.x, this.y - this.markerDy);
  }

  /** Retire this pickup once collected — invisible, inactive, no more overlaps; drop the marker. */
  collect() {
    this.body.enable = false;
    this.setActive(false);
    this.setVisible(false);
    if (this.marker) { this.marker.destroy(); this.marker = null; }
  }
}
