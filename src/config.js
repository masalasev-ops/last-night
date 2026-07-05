// All tunable values for Last Night. Gameplay code reads from here — no magic numbers.
// Values are in the 960×540 internal-design space (pixels and seconds).
// Phase 2 note: this is the POC's 480×270 tuning rescaled ×2 (every distance/speed/
// acceleration doubled; times/ratios/counts/health/damage unchanged) so the platforming
// feel is preserved at the new resolution. See docs/BUILD_PHASE2_SLICE.md §0.

export const CONFIG = {
  // Display
  width: 960,
  height: 540,
  backgroundColor: '#0a0a0f',

  // Physics
  gravity: 2800, // px/s²

  // Player
  playerMaxHealth: 100,
  invulnOnHit: 0.6, // s
  knockback: 320, // px/s
  knockbackDuration: 0.15, // s — forced knockback before regaining horizontal control
  moveSpeed: 260, // px/s
  sprintMultiplier: 1.6,
  jumpVelocity: 860, // px/s
  coyoteTime: 0.1, // s — grace period after leaving ground
  jumpBuffer: 0.1, // s — grace period before landing

  // Pistol
  pistol: {
    bulletSpeed: 1240, // px/s
    fireRate: 6, // shots per second
    magSize: 12,
    reloadTime: 1.1, // s
    bulletRange: 800, // px
    damage: 12,
    bulletPoolSize: 30, // max pooled bullets alive at once
  },

  // Gun-tip offset from the player's sprite origin (feet), in texture px.
  // Bullets + muzzle flash spawn here; x is mirrored by aim direction. Tuned on screen.
  muzzleOffset: { x: 26, y: -38 },

  // Enemy
  enemy: {
    maxHealth: 30,
    moveSpeed: 140, // px/s (patrol)
    chaseSpeed: 220, // px/s (chase)
    detectionRadius: 280, // px
    attackRange: 32, // px
    touchDamage: 10,
    attackCooldown: 0.8, // s
    patrolRange: 160, // px — how far enemy walks left/right from spawn point
    hurtDuration: 0.15, // s — white-tint flash when hit
    enemyPoolSize: 10, // max pooled enemies alive at once
    maxVerticalReach: 72, // px — if player is farther above/below, enemy can't reach them
  },

  // Camera
  camera: {
    lookAhead: 80, // px ahead of player
    lerp: 0.12, // follow smoothing
    followOffsetY: -110, // px — lifts the view so the feet-origin soldier is framed with headroom
  },

  // Screen shake (Phaser camera.shake) — { duration: ms, intensity: 0-1 (viewport fraction) }
  shake: {
    onShoot: { duration: 50, intensity: 0.002 },
    onHit: { duration: 150, intensity: 0.01 },
  },

  // Particle burst tunables (explode-only emitters). Speeds retuned to the new scale in L3.
  particles: {
    muzzle: { count: 4, lifespan: 150, speedMin: 20, speedMax: 80 },
    impact: { count: 3, lifespan: 100, speedMin: 50, speedMax: 150 },
    blood: { count: 5, lifespan: 300, speedMin: 30, speedMax: 100, gravityY: 300 },
  },

  // Vignette filter (camera internal filter) — re-enabled/tuned in L4
  vignette: { x: 0.5, y: 0.5, radius: 0.55, strength: 0.6, color: 0x000000 },

  // Player point light (soft radial glow, no normal maps needed) — re-enabled/tuned in L4
  playerLight: { color: 0x5577aa, radius: 140, intensity: 0.4, attenuation: 0.08 },

  // Placeholder visuals — generated in BootScene (§6 of build spec). Sizes doubled to stay
  // proportional at 960×540; real art replaces player (L1) / enemy (L3) via TEXTURE_MAP.
  palette: {
    background: '#0a0a0f',
    platforms: '#1c2230',
    player: '#7fb0c8',
    enemy: '#6f8f4a',
    bullet: '#e8e8c0',
    blood: '#8b0000',
    muzzle: '#ffd27f',
    hudText: '#c8ccd4',
  },

  placeholder: {
    PLAYER: { key: 'placeholder-player', width: 24, height: 40 },
    ENEMY: { key: 'placeholder-enemy', width: 24, height: 32 },
    BULLET: { key: 'placeholder-bullet', width: 6, height: 4 },
  },

  // Single map of entity type → texture key. This is the future art swap-point
  // (§6): replace the generated keys with real asset keys here without touching
  // game logic.
  TEXTURE_MAP: {
    player: 'player-idle', // real Soldier_1 art (swap-point flipped in L1)
    enemy: 'placeholder-enemy',
    bullet: 'placeholder-bullet',
  },

  // World / level (hand-authored platform layout) — coordinates doubled from the POC.
  // This placeholder level is replaced by the tileset forest in L2; it stays proportional
  // here so L1 can validate jump/shoot feel at 2× scale.
  LEVEL: {
    worldWidth: 6400,
    worldHeight: 540,
    groundY: 524, // top of the ground surface (16px thick below this)
    spawn: { x: 160, y: 504 }, // player start; y = groundY − 20 so feet drop onto the ground
    platforms: [
      // { x, y, width, height } — x/y are center-x, top-y.
      // Chained platforms: edge gap designed so walking jumps clear ascending,
      // sprinting clears comfortably.
      // Warm-up: ground → low → higher
      { x: 560, y: 444, width: 128, height: 16 },   // from ground
      { x: 816, y: 380, width: 128, height: 16 },   // from #1  (edge gap 128px)
      // Mid-level crossing
      { x: 1360, y: 424, width: 96, height: 16 },   // from ground
      { x: 1616, y: 356, width: 144, height: 16 },  // from #3  (edge gap 136px)
      { x: 1976, y: 404, width: 112, height: 16 },  // from ground or drop from #4 (edge gap 232px down)
      // Staggered climb — three-step ascent to the peak
      { x: 2760, y: 440, width: 112, height: 16 },  // from ground
      { x: 3008, y: 370, width: 128, height: 16 },  // from #6  (edge gap 128px)
      { x: 3280, y: 300, width: 144, height: 16 },  // from #7  (edge gap 136px) — peak
      { x: 3800, y: 404, width: 112, height: 16 },  // from ground or drop from #8
      // Final stretch
      { x: 4560, y: 428, width: 128, height: 16 },  // from ground
      { x: 4808, y: 360, width: 128, height: 16 },  // from #10 (edge gap 120px)
      { x: 5080, y: 396, width: 112, height: 16 },  // from #11 (edge gap 152px down) or ground
      { x: 5880, y: 440, width: 160, height: 16 },  // from ground — home stretch
    ],
    endMarkerX: 6300,
    // Enemy spawn positions (x, y center). y=508 = on ground (groundY 524 − half enemy height 16)
    enemies: [
      // Solo enemies
      { x: 1100, y: 508 },
      { x: 2500, y: 508 },
      { x: 4700, y: 508 },
      // Spawn cluster (3 grouped near the staggered climb)
      { x: 3360, y: 508 },
      { x: 3440, y: 508 },
      { x: 3520, y: 508 },
    ],
  },

  ground: {
    thickness: 16,
  },

  endMarker: {
    width: 24,
    height: 80,
  },
};

// ---------------------------------------------------------------------------
// Real-art asset registry (Phase 2). All character sheets are 128×128 frames.
// Paths omit `public/` — Vite serves public/ at the site root, so they start at
// `assets/…`. Real art enters the game only through this registry (the swap-point);
// gameplay values above never come from a sprite's pixel size.
// ---------------------------------------------------------------------------
export const ASSETS = {
  player: {
    dir: 'assets/soldier-sprite-sheets-pixel-art/Soldier_1',
    frame: 128,
    anims: {
      // state: [file, frameCount, fps, loop]
      idle:    ['Idle.png',     7,  8, true],
      walk:    ['Walk.png',     7, 12, true],
      run:     ['Run.png',      8, 14, true],
      shoot:   ['Shot_1.png',   4, 18, false],
      reload:  ['Recharge.png', 13, 14, false],
      grenade: ['Grenade.png',  9, 14, false],
      melee:   ['Attack.png',   3, 16, false],
      hurt:    ['Hurt.png',     3, 14, false],
      death:   ['Dead.png',     4, 10, false],
    },
  },
  zombies: {
    dir: 'assets/urban-zombie-sprite-sheet-pixel-art-pack',
    frame: 128,
    // Per-type frame counts. Sheet filenames are the capitalized state (idle → Idle.png).
    types: {
      Zombie_1: { idle: 6, walk: 10, attack: 5,  hurt: 4, dead: 5 },
      Zombie_2: { idle: 6, walk: 10, attack: 5,  hurt: 4, dead: 5 },
      Zombie_3: { idle: 6, walk: 10, attack: 4,  hurt: 4, dead: 5 },
      Zombie_4: { idle: 7, walk: 12, attack: 10, hurt: 4, dead: 5 },
    },
    fps: { idle: 6, walk: 10, attack: 12, hurt: 12, dead: 8 },
  },
  tileset: 'assets/platformer-game-tileset-pixel-art/PNG/Tileset.png',
  bgLayers: [
    // [path, parallax scrollFactor] — far → near
    ['assets/platformer-game-tileset-pixel-art/PNG/Background/x32/Skyx32.png',     0.10],
    ['assets/platformer-game-tileset-pixel-art/PNG/Background/x32/Clouds_x32.png', 0.25],
    ['assets/platformer-game-tileset-pixel-art/PNG/Background/x32/Flora2x32.png',  0.45],
    ['assets/platformer-game-tileset-pixel-art/PNG/Background/x32/Flora1x32.png',  0.70],
  ],
};

// Player physics body — set explicitly, NOT derived from the 128px sprite.
// Measured from Soldier_1/Idle.png (opaque region x46–91, y61–127 at scale 1.0):
//   char center-x ≈ 68.5, feet at frame-y 127. Body hugs the torso/legs.
//   originY 1.0 = frame bottom at feet; offsetX centers the 28-wide body on the
//   character (68.5 − 14 ≈ 54) so flipX never shifts the hitbox; offsetY 65 sets
//   the 62-tall body's base at the feet (65 + 62 = 127). Fine-tuned via debug overlay.
export const PLAYER_BODY = {
  width: 28, height: 62, originX: 0.5, originY: 1.0, offsetX: 54, offsetY: 65,
};
