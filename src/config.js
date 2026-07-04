// All tunable values for Last Night. Gameplay code reads from here — no magic numbers.
// Values are in the 480×270 internal-design space (pixels and seconds).

export const CONFIG = {
  // Display
  width: 480,
  height: 270,
  backgroundColor: '#0a0a0f',

  // Physics
  gravity: 1400, // px/s²

  // Player
  playerMaxHealth: 100,
  invulnOnHit: 0.6, // s
  knockback: 160, // px/s
  knockbackDuration: 0.15, // s — forced knockback before regaining horizontal control
  moveSpeed: 130, // px/s
  sprintMultiplier: 1.6,
  jumpVelocity: 430, // px/s
  coyoteTime: 0.1, // s — grace period after leaving ground
  jumpBuffer: 0.1, // s — grace period before landing

  // Pistol
  pistol: {
    bulletSpeed: 620, // px/s
    fireRate: 6, // shots per second
    magSize: 12,
    reloadTime: 1.1, // s
    bulletRange: 400, // px
    damage: 12,
    bulletPoolSize: 30, // max pooled bullets alive at once
  },

  // Enemy
  enemy: {
    maxHealth: 30,
    moveSpeed: 70, // px/s (patrol)
    chaseSpeed: 110, // px/s (chase)
    detectionRadius: 140, // px
    attackRange: 16, // px
    touchDamage: 10,
    attackCooldown: 0.8, // s
    patrolRange: 80, // px — how far enemy walks left/right from spawn point
    hurtDuration: 0.15, // s — white-tint flash when hit
    enemyPoolSize: 10, // max pooled enemies alive at once
    maxVerticalReach: 36, // px — if player is farther above/below, enemy can't reach them
  },

  // Camera
  camera: {
    lookAhead: 40, // px ahead of player
    lerp: 0.12, // follow smoothing
  },

  // Screen shake (Phaser camera.shake) — { duration: ms, intensity: 0-1 }
  shake: {
    onShoot: { duration: 50, intensity: 0.002 },
    onHit: { duration: 150, intensity: 0.01 },
  },

  // Particle burst tunables (explode-only emitters)
  particles: {
    muzzle: { count: 4, lifespan: 150, speedMin: 20, speedMax: 80 },
    impact: { count: 3, lifespan: 100, speedMin: 50, speedMax: 150 },
    blood: { count: 5, lifespan: 300, speedMin: 30, speedMax: 100, gravityY: 300 },
  },

  // Vignette filter (camera internal filter)
  vignette: { x: 0.5, y: 0.5, radius: 0.55, strength: 0.6, color: 0x000000 },

  // Player point light (soft radial glow, no normal maps needed)
  playerLight: { color: 0x5577aa, radius: 140, intensity: 0.4, attenuation: 0.08 },

  // Placeholder visuals — generated in BootScene (§6 of build spec)
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
    PLAYER: { key: 'placeholder-player', width: 12, height: 20 },
    ENEMY: { key: 'placeholder-enemy', width: 12, height: 16 },
    BULLET: { key: 'placeholder-bullet', width: 3, height: 2 },
  },

  // Single map of entity type → texture key. This is the future art swap-point
  // (§6): replace the generated keys with real asset keys here without touching
  // game logic.
  TEXTURE_MAP: {
    player: 'placeholder-player',
    enemy: 'placeholder-enemy',
    bullet: 'placeholder-bullet',
  },

  // World / level (hand-authored platform layout)
  LEVEL: {
    worldWidth: 3200,
    worldHeight: 270,
    groundY: 262, // top of the ground surface (8px thick below this)
    platforms: [
      // { x, y, width, height } — x/y are center-x, top-y.
      // Chained platforms: edge gap designed so walking jumps clear ascending,
      // sprinting clears comfortably.
      // Warm-up: ground → low → higher
      { x: 280, y: 222, width: 64, height: 8 },   // from ground
      { x: 408, y: 190, width: 64, height: 8 },   // from #1  (edge gap 64px)
      // Mid-level crossing
      { x: 680, y: 212, width: 48, height: 8 },   // from ground
      { x: 808, y: 178, width: 72, height: 8 },   // from #3  (edge gap 68px)
      { x: 988, y: 202, width: 56, height: 8 },   // from ground or drop from #4 (edge gap 116px down)
      // Staggered climb — three-step ascent to the peak
      { x: 1380, y: 220, width: 56, height: 8 },  // from ground
      { x: 1504, y: 185, width: 64, height: 8 },  // from #6  (edge gap 64px)
      { x: 1640, y: 150, width: 72, height: 8 },  // from #7  (edge gap 68px) — peak
      { x: 1900, y: 202, width: 56, height: 8 },  // from ground or drop from #8
      // Final stretch
      { x: 2280, y: 214, width: 64, height: 8 },  // from ground
      { x: 2404, y: 180, width: 64, height: 8 },  // from #10 (edge gap 60px)
      { x: 2540, y: 198, width: 56, height: 8 },  // from #11 (edge gap 76px down) or ground
      { x: 2940, y: 220, width: 80, height: 8 },  // from ground — home stretch
    ],
    endMarkerX: 3150,
    // Enemy spawn positions (x, y center). y=254 = on ground (groundY 262 − half enemy height 8)
    enemies: [
      // Solo enemies
      { x: 550, y: 254 },
      { x: 1250, y: 254 },
      { x: 2350, y: 254 },
      // Spawn cluster (3 grouped near the staggered climb)
      { x: 1680, y: 254 },
      { x: 1720, y: 254 },
      { x: 1760, y: 254 },
    ],
  },

  ground: {
    thickness: 8,
  },

  endMarker: {
    width: 12,
    height: 40,
  },
};
