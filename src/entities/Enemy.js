import { Physics } from 'phaser';
import { CONFIG, ZOMBIE_BODY, ACID_SPITTER_BODY } from '../config.js';

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
    this.type = type; // roster id — drives salvageDrop / spawn lookups; stays the type even when `sheet` reskins
    // Per-type roster entry selects the FSM behavior branch (P3.1). Default 'melee' if unlisted.
    const def = CONFIG.ENEMIES[type] ?? { aiProfile: 'melee' };
    this.aiProfile = def.aiProfile;
    this.def = def;
    // Animation/texture key (P3.4). A data variant may set `sheet` to borrow another type's frames (Runner
    // renders Zombie_2, Tank renders Zombie_3); anims are played from animKey, while this.type stays the id.
    this.animKey = def.sheet ?? type;

    // --- Flyer (P3.4): the one new profile — ignores gravity, homes in 2D. Placeholder blob (anim-less),
    // like the Spitter's blob-fallback path. Centre-origin (airborne, not feet-grounded). ---
    if (this.aiProfile === 'flyer') {
      const body = def.body;
      const artScale = def.artScale ?? 1;
      this.animated = false;         // blob: the animation controller must not try to play frames
      this.facesLeft = body.facesLeft;
      this.setTexture(CONFIG.placeholder.FLYER.key);
      this.setOrigin(body.originX, body.originY);
      this.setScale(artScale);
      this.setPosition(x, y);
      this.setActive(true);
      this.setVisible(true);
      def.tint != null ? this.setTint(def.tint) : this.clearTint();
      this.body.enable = true;
      this.body.setAllowGravity(false); // the defining trait — it hovers and homes, unaffected by world gravity
      this.body.setSize(body.width, body.height);
      this.body.setOffset(body.offsetX, body.offsetY);
      this.deadDuration = 0;           // no death anim (blob) — DEAD just lingers corpseLinger
      this.health = def.maxHealth ?? CONFIG.enemy.maxHealth;
      this.resetFsm(x);
      return;
    }

    if (this.aiProfile === 'ranged') {
      // Ranged Spitter. Real art enters through the swap-point: if the real sheet TEXTURE loaded,
      // use the 128px sheet + ACID_SPITTER_BODY + animations; otherwise fall back to the generated
      // green blob (anim-less) with its own small body. Golden rule 4 — missing art never breaks the
      // game. Gate on the texture, NOT the anim: animations.js registers `Spitter-*` unconditionally,
      // so a failed sheet load still leaves the anim "existing" (frame-less) — only the texture is
      // absent when the art is missing.
      const hasArt = this.scene.textures.exists(`${type}-idle`);
      // Drives the animation controller: the blob fallback is anim-less, so it must NOT play the
      // registered Spitter-* anims (which would swap its texture back to the real sheet). See playIfExists.
      this.animated = hasArt;
      const body = hasArt ? ACID_SPITTER_BODY : def.body;
      this.facesLeft = body.facesLeft;
      // Spit muzzle: the real sheet's explicit mouth offset; null on the blob path so spawnAcid keeps
      // its body-relative estimate (the −70 offset is tuned to the 128px art, not the 52px blob).
      this.muzzleOffset = hasArt ? def.muzzleOffset : null;
      const artScale = hasArt ? (def.artScale ?? 1) : 1; // shrink the oversized AI art toward ~2-tile scale
      this.setTexture(hasArt ? CONFIG.TEXTURE_MAP.spitter : CONFIG.placeholder.SPITTER.key);
      this.setOrigin(body.originX, body.originY); // feet
      this.setScale(artScale);
      this.setPosition(x, y);
      this.setActive(true);
      this.setVisible(true);
      this.clearTint();
      this.body.enable = true;
      // Body is set in UNSCALED frame px. Arcade scales the body size AND offset by the sprite scale
      // (around the feet origin) on the next physics step, so it keeps hugging the art and stays
      // grounded — verified in Phaser 4: setSize(32,70) + scale 0.78 → a 25×55 body on the feet line.
      // At artScale 1 (melee zombies / blob fallback) this is the original unscaled body.
      this.body.setSize(body.width, body.height);   // after setTexture so the frame is set
      this.body.setOffset(body.offsetX, body.offsetY);
      if (hasArt) {
        this.play(`${type}-idle`);
        this.deadDuration = this.scene.anims.get(`${type}-dead`).duration / 1000;
      } else {
        this.deadDuration = 0; // placeholder blob: no death anim — DEAD just lingers corpseLinger
      }
      this.health = def.maxHealth;
      this.resetFsm(x);
      return;
    }

    // --- Melee (Zombie_N + data-variant reskins Runner/Tank). Zombie_N inherits every default → identical
    // to before; a variant borrows a `sheet`'s frames (animKey) and reads its own stats/tint/scale/body. ---
    const sheetKey = this.animKey;                       // = def.sheet ?? type (Runner→Zombie_2, Tank→Zombie_3)
    const body = this.def.body ?? ZOMBIE_BODY[sheetKey]; // explicit body from config (Tank scales the sheet's)
    const artScale = this.def.artScale ?? 1;
    this.animated = true; // real zombie sheets always load — the controller animates normally
    this.facesLeft = body.facesLeft;

    // Real art fitted to an explicit torso body (art never drives the hitbox). Arcade scales body+offset
    // by artScale around the feet origin on the next step, so a rescaled variant stays fitted + grounded.
    this.setTexture(`${sheetKey}-idle`);
    this.setOrigin(body.originX, body.originY); // feet
    this.setScale(artScale);
    this.setPosition(x, y);
    this.setActive(true);
    this.setVisible(true);
    this.def.tint != null ? this.setTint(this.def.tint) : this.clearTint(); // reskin tint (variants read distinctly)
    this.body.enable = true;
    this.body.setSize(body.width, body.height);   // after setTexture so the frame is set
    this.body.setOffset(body.offsetX, body.offsetY);
    this.play(`${sheetKey}-idle`);

    // Death-animation length read from the registered anim (no magic number).
    this.deadDuration = this.scene.anims.get(`${sheetKey}-dead`).duration / 1000;

    this.health = this.def.maxHealth ?? CONFIG.enemy.maxHealth;
    this.resetFsm(x);
  }

  /** Reset the shared FSM state/timers (health is set per-profile before this). */
  resetFsm(x) {
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
   * Ranged kite: hold a preferred-distance band from the player — approach if farther than max, back
   * away if closer than min, else stop and face. Shared by the ranged CHASE and ATTACK branches.
   */
  kite(dirToPlayer, distToPlayer) {
    const { min, max } = this.def.preferredRange;
    this.faceDir(dirToPlayer);
    if (distToPlayer > max) this.body.setVelocityX(this.def.moveSpeed * dirToPlayer);
    else if (distToPlayer < min) this.body.setVelocityX(-this.def.moveSpeed * dirToPlayer);
    else this.body.setVelocityX(0);
  }

  /**
   * Play an animation only if this enemy is animated AND the anim is registered. The `animated`
   * gate matters for the placeholder-blob Spitter: the Spitter-* anims ARE registered (for the real
   * art), so without this gate the controller would play them and swap the blob's texture to the real
   * sheet. Guarding on `animated` keeps the anim-less fallback truly static.
   */
  playIfExists(key, ignoreIfPlaying) {
    if (this.animated && this.scene.anims.exists(key)) this.play(key, ignoreIfPlaying);
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

    // P3.4: resolve every shared stat per-type — this.def.<stat> ?? CONFIG.enemy.<stat> — so ANY profile
    // (not just ranged) reads its own overrides from data. Zombie_N has no overrides → all fall back to
    // CONFIG.enemy (identical to before). This is what makes Runner/Tank pure data rows: no code branch.
    const stat = (k) => this.def[k] ?? CONFIG.enemy[k];
    const moveSpeed = stat('moveSpeed');
    const chaseSpeed = stat('chaseSpeed');
    const detectionRadius = stat('detectionRadius');
    const attackRange = stat('attackRange');
    const attackCooldown = stat('attackCooldown');
    const patrolRange = stat('patrolRange');
    const maxVerticalReach = stat('maxVerticalReach');
    const climbHeight = stat('climbHeight');
    const retreatDistance = stat('retreatDistance');
    const player = this.player;
    const isRanged = this.aiProfile === 'ranged';

    // Guard: if player ref isn't set yet, stand idle
    if (!player || !player.active) {
      this.body.setVelocityX(0);
      this.playIfExists(`${this.animKey}-idle`, true);
      return;
    }

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const distToPlayer = Math.sqrt(dx * dx + dy * dy);
    const dirToPlayer = player.x >= this.x ? 1 : -1;

    // --- Flyer (P3.4): homes in 2D toward the player and ignores ALL perch/RETREAT/climb logic (it can
    // reach a perched player). Ticks its own attack cooldown here since it returns before the ATTACK-state
    // tick, and deals touchDamage on contact via the same idiom melee ATTACK uses — no new FSM state. ---
    if (this.aiProfile === 'flyer') {
      this.attackTimer = Math.max(0, this.attackTimer - dt);
      if (distToPlayer <= detectionRadius) {
        const len = distToPlayer || 1; // zero-guard the normalization (avoid /0 → NaN velocity)
        this.body.setVelocity((dx / len) * this.def.flySpeed, (dy / len) * this.def.flySpeed);
        this.faceDir(dirToPlayer);
        if (distToPlayer <= attackRange && this.attackTimer <= 0) {
          player.takeDamage(stat('touchDamage'), this.x);
          this.attackTimer = attackCooldown;
        }
      } else {
        this.body.setVelocity(0, 0); // hover in place until the player comes within detection
      }
      return; // never falls through to the melee/ranged perch FSM below
    }

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
        // MELEE only: a player who landed on a platform overhead → back off, unless we already gave up
        // on this perch (gaveUp stops it firing every frame). Ranged enemies don't retreat — they lob.
        if (!isRanged && playerUnreachableAbove && distToPlayer <= detectionRadius && !this.gaveUp) {
          this.enterRetreat();
          break;
        }

        this.body.setVelocityX(moveSpeed * this.patrolDir);
        this.faceDir(this.patrolDir);

        if (this.x >= this.spawnX + patrolRange) this.patrolDir = -1;
        if (this.x <= this.spawnX - patrolRange) this.patrolDir = 1;

        // Engage: ranged ignores vertical (it can arc acid up to a perched player); melee needs a
        // reachable, non-perched player (a camper overhead is handled by the retreat above).
        const canEngage = isRanged
          ? distToPlayer <= detectionRadius
          : distToPlayer <= detectionRadius && Math.abs(dy) <= maxVerticalReach && !playerUnreachableAbove;
        if (canEngage) this.state = STATE.CHASE;
        break;
      }

      // --- CHASE: melee closes to touch range; ranged kites to its preferred band, then spits ---
      case STATE.CHASE: {
        if (isRanged) {
          this.kite(dirToPlayer, distToPlayer);
          if (distToPlayer <= this.def.firingRange) {
            this.state = STATE.ATTACK;
            this.attackTimer = 0; // ready to spit immediately
          } else if (distToPlayer > detectionRadius * 1.5) {
            this.state = STATE.PATROL; // lost the player
          }
          break;
        }

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

      // --- ATTACK: melee deals touch damage on cooldown; ranged keeps spacing and spits acid ---
      case STATE.ATTACK: {
        if (isRanged) {
          this.kite(dirToPlayer, distToPlayer); // hold distance while firing
          this.attackTimer = Math.max(0, this.attackTimer - dt);
          if (this.attackTimer <= 0) {
            this.scene.spawnAcid(this, player); // lob one arcing glob at the player (no touch damage)
            this.attackTimer = this.def.attackCooldown;
            this.playIfExists(`${this.animKey}-attack`); // discrete spit anim (placeholder: no-op)
          }
          if (distToPlayer > this.def.firingRange) this.state = STATE.CHASE;
          break;
        }

        // Player hopped onto a platform overhead mid-melee → stop swinging at nothing, retreat.
        if (playerUnreachableAbove) {
          this.enterRetreat();
          break;
        }

        this.body.setVelocityX(0);
        this.faceDir(dirToPlayer);

        this.attackTimer = Math.max(0, this.attackTimer - dt);
        if (this.attackTimer <= 0) {
          player.takeDamage(stat('touchDamage'), this.x);
          this.attackTimer = attackCooldown;
          this.play(`${this.animKey}-attack`); // restart the swing on the discrete strike only
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
    this.playIfExists(`${this.animKey}-${anim}`, true); // guarded: placeholder spitter has no anims
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
      this.scene.awardSalvage(this.type, this.x, this.y); // P3.3: single kill hook → salvage + floating +N
      this.playIfExists(`${this.animKey}-dead`); // one-shot; holds last frame (placeholder: no-op)
      this.body.setVelocity(0, 0);
      this.body.enable = false; // corpse: no collisions/overlaps, stays put
      this.clearTint();
      this.deathTimer = this.deadDuration + CONFIG.enemy.corpseLinger;
      return;
    }

    this.state = STATE.HURT;
    this.hurtTimer = CONFIG.enemy.hurtDuration;
    this.playIfExists(`${this.animKey}-hurt`); // trigger on the hit; controller keeps it during HURT (placeholder: no-op)
    this.setTint(0xffffff);
  }

  /** Return this enemy to the pool — invisible, stopped, inactive. */
  deactivate() {
    this.setActive(false);
    this.setVisible(false);
    this.body.enable = false;
    this.body.stop();
    this.body.setAllowGravity(true); // P3.4 pooling-safety: restore the default so a pooled Flyer (gravity
    // off) reused as a grounded zombie/spitter doesn't float. Only the flyer spawn() turns gravity off.
    this.clearTint();
    this.state = STATE.PATROL;
    this.player = null;
  }
}
