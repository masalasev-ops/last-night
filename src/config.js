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

  // Weapon — the soldier wields a two-handed rifle (Soldier_1 Shot sheet). `name` drives the HUD label.
  weapon: {
    name: 'RIFLE',
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
    retreatDistance: 150, // px — when the player is perched unreachable above, the zombie backs off
    // toward where it came from until it's this far away, then settles into a local patrol there.
    // Bounded (well under a screen-width) so it stays visible instead of marching off-screen.
    hurtDuration: 0.15, // s — white-tint flash when hit
    enemyPoolSize: 10, // max pooled enemies alive at once
    maxVerticalReach: 72, // px — chase/detection vertical tolerance (how far above/below it will pursue)
    climbHeight: 32, // px — max step-up a zombie can manage (it can't jump). A *grounded* player higher
    // than this is unreachable → the zombie gives up and retreats. Must be below the smallest platform
    // rise (~64px after grid-snap) so every platform triggers it, but above flat-ground noise (0).
    corpseLinger: 1.5, // s — how long the dead pose holds on the ground before pooling out
  },

  // Per-type enemy roster (Phase 3). `aiProfile` selects the FSM behavior branch in Enemy.preUpdate.
  // Melee zombies keep their shared tuning in CONFIG.enemy + ZOMBIE_BODY (unchanged) — their entry only
  // declares the profile. The ranged Spitter carries its own full tuning here (the extension pattern
  // P3.4 reuses). detectionRadius >= firingRange so it's never in firing range while still unengaged.
  ENEMIES: {
    Zombie_1: { aiProfile: 'melee' },
    Zombie_2: { aiProfile: 'melee' },
    Zombie_3: { aiProfile: 'melee' },
    Zombie_4: { aiProfile: 'melee' },
    Spitter: {
      aiProfile: 'ranged',
      maxHealth: 24,
      moveSpeed: 110,                          // px/s (kiting)
      detectionRadius: 440,                    // px — >= firingRange (no "in range but unengaged" dead zone)
      preferredRange: { min: 180, max: 320 },  // px — the kite band it holds
      firingRange: 420,                        // px — max distance it will spit from
      attackCooldown: 1.6,                     // s between spits
      scrapDrop: { min: 2, max: 4 },           // unused until P3.3 (scrap economy)
      // Explicit body fitted to the 40×52 placeholder blob (feet at frame bottom). Art never drives it.
      body: { width: 28, height: 48, originX: 0.5, originY: 1.0, offsetX: 6, offsetY: 4, facesLeft: false },
    },
  },

  // Acid projectile (P3.1) — pooled, ballistic: it arcs under its own gravityY so it can reach a player
  // perched on a ledge above the spitter (answering the perch exploit with a real threat).
  acid: {
    speed: 520,      // px/s — nominal horizontal speed used to choose the lob's flight time
    gravityY: 900,   // px/s² — projectile-only gravity that gives the arc
    damage: 12,
    lifespan: 3.0,   // s before it splats and returns to the pool
    poolSize: 20,    // max acid globs alive at once
    bodyRadius: 6,   // px — circular hit body
    minLobTime: 0.3, // s — floor on flight time so a near-overhead shot can't launch at an absurd speed
  },

  // Pickup (L5). One health chest placed from level data (LEVEL.pickups). `heal` is the HP restored;
  // `body` is the explicit overlap box (art never drives the hitbox — golden rule 4); `scale` fits the
  // 64px chest art to the world; `bob` is a gentle idle float so it reads as collectible.
  pickup: {
    heal: 40,                       // HP restored on collect
    body: { width: 28, height: 30 },
    scale: 0.6,
    animFps: 8,                     // chest shimmer loop
    bob: { amp: 6, speed: 2 },      // px amplitude, radians/sec
  },

  // Intro beat (L5) — a short, non-blocking title card on level start (camera fades in, text fades out).
  intro: {
    fadeMs: 600,   // camera fade-in + text fade-out duration
    holdMs: 1800,  // how long the title holds before it fades
    title: 'LAST NIGHT',
    subtitle: 'Reach the far side of the forest',
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

  // Particle burst tunables (explode-only emitters). Retuned ×2 for the 960×540 scale in
  // L3 (speeds/gravity doubled; blood count bumped). Particle textures are 8×8 (BootScene).
  particles: {
    muzzle: { count: 4, lifespan: 150, speedMin: 40, speedMax: 160 },
    impact: { count: 4, lifespan: 100, speedMin: 100, speedMax: 300 },
    blood: { count: 8, lifespan: 350, speedMin: 60, speedMax: 200, gravityY: 600 },
  },

  // Vignette camera filter — cam.filters.external.addVignette(x, y, radius, strength, color).
  // The dark oval edge-framing. enabled: false → no circular porthole; just the flat even tint.
  vignette: { enabled: true, x: 0.5, y: 0.5, radius: 0.58, strength: 0.20, color: 0x000000 },

  // Night atmosphere (L4). The darkness overlay fills the screen with darkColor@darkAlpha and
  // erases a body glow (glowScale) + a gun flashlight cone (coneScale). glowScale is generous
  // so mid-range zombies stay dimly visible (fairness). night = optional ColorMatrix.night()
  // amount — left at 0: even small amounts darken the whole scene to near-black, so the mood
  // comes from the vignette filter + dark overlay instead. Tuned together, by eye.
  //
  // enabled: master switch. L5 re-enables it at a GENTLE level — a light nighttime tint + soft
  // vignette + player glow/flashlight, kept bright enough that the background and both the soldier
  // and the zombies stay clearly visible (the earlier over-dark version hid them). Set false for a
  // fully bright forest; all of it stays wired either way.
  atmosphere: {
    enabled: true,        // master switch for the whole night-atmosphere stack (see note above)
    flashlight: true,    // the moving lit "window" (player glow + gun flashlight cone). false = a flat,
                          // uniform mild-dark tint everywhere instead of a torch-in-the-dark cutout.
    night: 0,             // ColorMatrix.night() grade — 0 = off (over-darkens; see note above)
    darkColor: 0x05070f,  // darkness overlay fill (near-black navy)
    darkAlpha: 0.40,      // overlay opacity — light nighttime tint; background stays clearly visible
    glowScale: 1.8,       // ambient player-body glow size (only used when flashlight: true)
    coneScale: 3.0,       // flashlight cone reach (only used when flashlight: true)
    fog: { alpha: 0.13, scale: 1.5, speedMin: 8, speedMax: 24, lifespan: 9000, frequency: 650 },
  },

  // HUD (UIScene) — health bar + ammo + weapon, sized for 960×540.
  hud: {
    bar: { x: 12, y: 12, w: 200, h: 18, bg: 0x3a0a0a, fill: 0x3ad06a, low: 0xd03a3a, lowPct: 0.35, border: 0x101014 },
    font: { size: 16, family: 'monospace', color: '#d6dae2' },
    debugFont: { size: 12, family: 'monospace', color: '#88ff88' },
    // Dark outline on HUD text so it stays legible over the bright forest (no darkness overlay now).
    stroke: { color: '#0a0a0f', thickness: 3 },
  },

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
    spitter: '#4faf5a', // P3.1 placeholder spitter blob (green)
    acid: '#7fe08a',    // P3.1 acid projectile + splat (green)
  },

  placeholder: {
    PLAYER: { key: 'placeholder-player', width: 24, height: 40 },
    ENEMY: { key: 'placeholder-enemy', width: 24, height: 32 },
    BULLET: { key: 'placeholder-bullet', width: 6, height: 4 },
    PICKUP: { key: 'placeholder-pickup', width: 28, height: 28 }, // green medic box fallback
    SPITTER: { key: 'spitter', width: 40, height: 52 }, // P3.1 ranged-enemy blob (real art swaps in later)
    ACID: { key: 'acid', width: 12, height: 12 },       // P3.1 acid glob
  },

  // Single map of entity type → texture key. This is the future art swap-point
  // (§6): replace the generated keys with real asset keys here without touching
  // game logic.
  TEXTURE_MAP: {
    player: 'player-idle', // real Soldier_1 art (swap-point flipped in L1)
    enemy: 'placeholder-enemy',
    bullet: 'placeholder-bullet',
    pickupHealth: 'pickup-chest', // real chest art (falls back to placeholder-pickup if unloaded)
    spitter: 'spitter', // P3.1 placeholder blob — point at a real Spitter sheet when art is ready
    acid: 'acid',       // P3.1 acid glob
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
      { x: 1976, y: 428, width: 112, height: 16 },  // from ground (L2: lowered 1 tile → 96px rise, comfortably reachable)
      // Staggered climb — three-step ascent to the peak
      { x: 2760, y: 440, width: 112, height: 16 },  // from ground
      { x: 3008, y: 370, width: 128, height: 16 },  // from #6  (edge gap 128px)
      { x: 3280, y: 300, width: 144, height: 16 },  // from #7  (edge gap 136px) — peak
      { x: 3800, y: 428, width: 112, height: 16 },  // from ground (L2: lowered 1 tile → 96px rise, comfortably reachable)
      // Final stretch
      { x: 4560, y: 428, width: 128, height: 16 },  // from ground
      { x: 4808, y: 360, width: 128, height: 16 },  // from #10 (edge gap 120px)
      { x: 5080, y: 428, width: 112, height: 16 },  // from ground (L2: lowered 1 tile → 96px rise, comfortably reachable)
      { x: 5880, y: 440, width: 160, height: 16 },  // from ground — home stretch
    ],
    endMarkerX: 6300,
    // Health pickups (L5). x, feet-y (y = groundY so the chest rests on the ground). Placed just past
    // the 3-zombie cluster / staggered climb (x≈3360–3520) where a hurt player arrives. Reachability
    // + natural-arrival confirmed in the human playtest (§H); relocate here if the level re-tune moved it.
    pickups: [
      { x: 3650, y: 524, type: 'health' },
    ],
    // Enemy spawns (x, feet-y). y = groundY (524) so feet rest on the ground. Each picks a
    // Zombie_N sheet; the mix covers all four types.
    enemies: [
      // Solo enemies
      { x: 1100, y: 524, type: 'Zombie_1' },
      { x: 2500, y: 524, type: 'Zombie_2' },
      { x: 4700, y: 524, type: 'Zombie_3' },
      // Spawn cluster (3 grouped near the staggered climb) — includes Zombie_4
      { x: 3360, y: 524, type: 'Zombie_4' },
      { x: 3440, y: 524, type: 'Zombie_1' },
      { x: 3520, y: 524, type: 'Zombie_2' },
      // P3.1 ranged Spitter — on the ground between the mid-crossing ledges (#3 x1360 / #4 x1616) so a
      // player perched on x1360 (rise ~100px) sits inside firingRange and the spitter must lob acid up.
      { x: 1500, y: 524, type: 'Spitter' },
    ],
  },

  ground: {
    thickness: 16,
  },

  endMarker: {
    width: 24,
    height: 80,
  },

  // Tileset (Tileset.png, 32×32, 17×12 grid → indices 0..203). The swap-point for
  // terrain art: chosen by rendering an indexed overlay. groundTop/groundFill are
  // cycled across columns for a natural, seam-free forest floor; platforms reuse the
  // grass family. Solid = the collidable set (the one-way callback refines by row).
  TILES: {
    size: 32,
    groundTop: [6, 7, 8],      // grass surface, cycled per column
    groundFill: [35, 36, 37],  // solid dirt/rock body beneath
    platformL: 6,              // 1-tile floating platform: left / middle / right
    platformMid: 7,
    platformR: 8,
    solid: [6, 7, 8, 35, 36, 37], // indices marked collidable via setCollision()
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
  // Pickups (L5) — collectible art from the platformer tileset pack. chest.png is 384×64 → 6 frames
  // of 64×64 (a shimmer loop). Loaded as a spritesheet; the `pickup-chest` anim is registered from this.
  pickups: {
    chest: { path: 'assets/platformer-game-tileset-pixel-art/PNG/chest.png', frame: 64, frames: 6, fps: 8 },
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

// Per-type zombie physics bodies — explicit, NOT derived from the 128px sprite.
// Measured from each Zombie_N/Idle.png (all ~2 tiles, feet at frame-y 127, torso ~28px).
// Body = torso/legs only (Zombie_4's reaching arms extend outside it). offsetX centers the
// body on each character; offsetY (65) sets the 62-tall body's base at the feet (65+62=127).
// facesLeft: false — all four sheets face RIGHT by default (verified), so flip is standard.
// Tuned against the physics-debug overlay.
export const ZOMBIE_BODY = {
  Zombie_1: { width: 28, height: 62, originX: 0.5, originY: 1.0, offsetX: 48, offsetY: 65, facesLeft: false },
  Zombie_2: { width: 28, height: 62, originX: 0.5, originY: 1.0, offsetX: 44, offsetY: 65, facesLeft: false },
  Zombie_3: { width: 28, height: 62, originX: 0.5, originY: 1.0, offsetX: 48, offsetY: 65, facesLeft: false },
  Zombie_4: { width: 28, height: 62, originX: 0.5, originY: 1.0, offsetX: 49, offsetY: 65, facesLeft: false },
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
