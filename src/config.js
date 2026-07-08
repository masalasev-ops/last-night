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

  // Weapons (P3.2) — the data table that replaced the single flat `weapon` block. The player holds a
  // `currentWeaponId` (never a copy of stats); fire-time code reads CONFIG.WEAPONS[id] LIVE so P3.3's
  // upgrades (which mutate a row) take effect without touching the player. The soldier always visually
  // holds the rifle (Decision 1) — weapon identity is HUD + projectile (tint/pellets/spread/speed) +
  // muzzle scale, NOT character art. A new weapon is a new row here, not new engine code (golden rule 6).
  //   fireMode:  'auto'   = fire while held at the 1/fireRate cadence (rifle, smg)
  //              'single' = fire on the pointer press-edge, one click per shot (shotgun pump)
  //              'burst'  = reserved schema value, NO consumer this milestone (do not wire)
  //   pellets/spreadDeg:  one trigger = one ammo = `pellets` bullets fanned within ±spreadDeg/2 of aim
  //   projectileTint:     null = the bare light bullet (rifle); non-white multiply-tints it per weapon
  //   muzzleScale:        per-weapon muzzle-flash size (× particles.muzzle.scaleStart)
  //   ammoType/hudIcon/sfxFire/sfxReload: RESERVED, inert this milestone (reserve ammo → P3.5, icons →
  //     later art drop, per-weapon SFX → P3.9).
  // The refactor shipped with rifle == the old weapon exactly (regression-safe); rifle was then TUNED in
  // playtest (fireRate 6→4, bulletSpeed 1240→1500) + SMG spreadDeg 3→7 so the two auto weapons read as
  // clearly distinct (deliberate rifle crack + fast flat tracer vs a sprayier SMG), not near-identical.
  // P3.3: WEAPONS is the IMMUTABLE TEMPLATE — never mutated at runtime. runState.recompute() deep-clones
  // it into runState.weapons (the live, upgrade-modified copy that Player.get weapon() reads). `unlockCost`
  // is the salvage price to unlock the weapon in the shop (0 = starting weapon); it rides along in the
  // clone harmlessly (a per-weapon number, not a combat stat).
  WEAPONS: {
    rifle:   { name: 'RIFLE',   fireMode: 'auto',   damage: 12, fireRate: 4,   magSize: 12, reloadTime: 1.1, bulletSpeed: 1500, range: 800, pellets: 1, spreadDeg: 0,  ammoType: 'rifle', projectileTint: null,     muzzleScale: 1.0, unlockCost: 0,  hudIcon: null, sfxFire: null, sfxReload: null },
    shotgun: { name: 'SHOTGUN', fireMode: 'single', damage: 7,  fireRate: 1.5, magSize: 6,  reloadTime: 1.6, bulletSpeed: 1000, range: 420, pellets: 7, spreadDeg: 18, ammoType: 'shell', projectileTint: 0xffd27f, muzzleScale: 1.4, unlockCost: 12, hudIcon: null, sfxFire: null, sfxReload: null },
    smg:     { name: 'SMG',     fireMode: 'auto',   damage: 7,  fireRate: 14,  magSize: 30, reloadTime: 1.3, bulletSpeed: 1180, range: 640, pellets: 1, spreadDeg: 7,  ammoType: 'smg',   projectileTint: 0x9ad0ff, muzzleScale: 0.8, unlockCost: 18, hudIcon: null, sfxFire: null, sfxReload: null },
  },
  defaultWeaponId: 'rifle',       // the weapon the player starts holding (keys 1/2/3 follow WEAPONS order)
  startingWeapon: 'rifle',        // P3.3: the only weapon unlocked at run start (shotgun/smg are shop buys)
  salvageStart: 0,                // P3.3: salvage balance at run start
  bulletPoolSize: 48,             // shared projectile pool — sized for the worst case (SMG spray + shotgun volley)

  // P3.3: data-driven weapon upgrades. Each is a one-shot stat modifier applied by runState.recompute()
  // (adds before mults, rebuilt from the WEAPONS template — order of purchase never changes the result).
  // { name (shop label), target (weapon id; 'player' reserved/unused), stat, mode:'add'|'mult', amount,
  //   cost (salvage), prereq? (upgrade id that must be owned first — tiers) }. Costs/amounts are tuning.
  UPGRADES: {
    rifle_dmg_1:      { name: 'Rifle Damage I',    target: 'rifle',   stat: 'damage',     mode: 'add',  amount: 4,    cost: 10 },
    rifle_dmg_2:      { name: 'Rifle Damage II',   target: 'rifle',   stat: 'damage',     mode: 'add',  amount: 5,    cost: 18, prereq: 'rifle_dmg_1' },
    shotgun_reload_1: { name: 'Shotgun Fast Load', target: 'shotgun', stat: 'reloadTime', mode: 'mult', amount: 0.8,  cost: 12 },
    smg_mag_1:        { name: 'SMG Extended Mag',   target: 'smg',     stat: 'magSize',    mode: 'add',  amount: 10,   cost: 12 },
    rifle_firerate_1: { name: 'Rifle Rapid Fire',  target: 'rifle',   stat: 'fireRate',   mode: 'mult', amount: 1.25, cost: 15 },
  },

  // P3.3: the end-of-level shop's stock — weapon unlocks (cost = WEAPONS[id].unlockCost) + upgrade ids.
  SHOP: {
    weaponsForSale: ['shotgun', 'smg'],
    upgradesForSale: ['rifle_dmg_1', 'rifle_dmg_2', 'shotgun_reload_1', 'smg_mag_1', 'rifle_firerate_1'],
  },

  // Gun-tip offset from the player's sprite origin (feet), in texture px. Global — all weapons use the
  // same rifle gun art (Decision 1). Bullets + muzzle flash spawn here; x is mirrored by aim direction.
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
    salvageDrop: { min: 1, max: 2 }, // P3.3 shared melee salvage roll — GameScene.awardSalvage falls
    // back to this for any enemy type whose ENEMIES row omits salvageDrop (the four Zombie_N rows do).
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
      salvageDrop: { min: 2, max: 4 },         // P3.3 salvage economy — spitter drops more than melee
      // AI art is drawn ~3 tiles tall (95px) vs the ~2-tile (67px) zombies; scale it down to sit in
      // the roster. 0.78 → ~74px (~1.1× a zombie): a touch bulkier, not towering. The body + spit
      // muzzle scale with this automatically (Enemy.spawn / GameScene.spawnAcid) — tune this one value.
      artScale: 0.78,
      // Explicit body fitted to the 40×52 placeholder blob (feet at frame bottom). Art never drives it.
      // Used only on the placeholder-fallback path; the real 128px sprite uses ACID_SPITTER_BODY below.
      body: { width: 28, height: 48, originX: 0.5, originY: 1.0, offsetX: 6, offsetY: 4, facesLeft: false },
      // Spit origin, in texture px from the feet-origin — the sprite's mouth. Decoupled from the
      // hitbox so retuning ACID_SPITTER_BODY never moves the muzzle (GameScene.spawnAcid reads this).
      // x:0 keeps the lob's horizontal origin on centre (identical arc to the placeholder). y from the
      // idle-frame measurement (mouth ≈ 70px above the feet).
      muzzleOffset: { x: 0, y: -70 },
    },

    // --- P3.4 roster expansion. Runner + Tank are PURE DATA on the melee FSM (no code branch): they only
    // work because Enemy.preUpdate now resolves this.def.<stat> ?? CONFIG.enemy.<stat> and `sheet` lets a
    // type borrow an existing zombie's frames (rendered via a `tint` + `artScale` so variants read now).
    // Real per-type art is a later swap-point drop. All numbers are tuning starting points. ---
    Runner: {
      aiProfile: 'melee', sheet: 'Zombie_2', tint: 0xff6a6a, artScale: 0.85, // small + red = fast rusher
      maxHealth: 15, moveSpeed: 180, chaseSpeed: 360, touchDamage: 8, attackCooldown: 0.6,
      salvageDrop: { min: 1, max: 2 },
    },
    Tank: {
      aiProfile: 'melee', sheet: 'Zombie_3', tint: 0x8faf7a, artScale: 1.28, // big + sickly-green = bullet sponge
      maxHealth: 90, moveSpeed: 70, chaseSpeed: 110, touchDamage: 22, attackCooldown: 1.2,
      salvageDrop: { min: 3, max: 5 },
      // Body = Zombie_3's torso box scaled by artScale (Arcade scales body+offset around the feet origin,
      // as the Spitter does), so it stays fitted + grounded at 1.28×. Fine without an explicit override
      // in playtest; add a `body` here only if the debug overlay shows it doesn't hug the bulkier art.
    },
    // Flyer — the ONE new aiProfile branch: ignores gravity, homes toward the player on both axes (can
    // reach a perched player), deals touchDamage on contact. Placeholder blob until art lands.
    Flyer: {
      aiProfile: 'flyer', tint: 0xc79aff, artScale: 0.7,          // purple, small, airborne
      maxHealth: 20, flySpeed: 200, detectionRadius: 420, touchDamage: 10, attackCooldown: 0.8,
      salvageDrop: { min: 2, max: 3 },
      // Explicit blob body (art never drives it). CENTRE origin (0.5,0.5) — airborne, not feet-grounded —
      // centred in the 44×32 placeholder; Arcade scales it by artScale on the next step.
      body: { width: 30, height: 22, originX: 0.5, originY: 0.5, offsetX: 7, offsetY: 5, facesLeft: false },
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
    // scaleStart = base muzzle-flash particle scale (start→0 fade). Player.fireWeapon multiplies it by
    // the active weapon's muzzleScale before exploding, so each weapon flashes at its own size.
    muzzle: { count: 4, lifespan: 150, speedMin: 40, speedMax: 160, scaleStart: 0.8 },
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
    flyer: '#c8ccd4',   // P3.4 flyer blob base — LIGHT so each Flyer row's non-white `tint` colourises it
  },

  placeholder: {
    PLAYER: { key: 'placeholder-player', width: 24, height: 40 },
    ENEMY: { key: 'placeholder-enemy', width: 24, height: 32 },
    BULLET: { key: 'placeholder-bullet', width: 6, height: 4 },
    PICKUP: { key: 'placeholder-pickup', width: 28, height: 28 }, // green medic box fallback
    SPITTER: { key: 'spitter', width: 40, height: 52 }, // P3.1 ranged-enemy blob (real art swaps in later)
    ACID: { key: 'acid', width: 12, height: 12 },       // P3.1 acid glob
    FLYER: { key: 'flyer', width: 44, height: 32 },     // P3.4 flying-enemy blob (real art swaps in later)
  },

  // Single map of entity type → texture key. This is the future art swap-point
  // (§6): replace the generated keys with real asset keys here without touching
  // game logic.
  TEXTURE_MAP: {
    player: 'player-idle', // real Soldier_1 art (swap-point flipped in L1)
    enemy: 'placeholder-enemy',
    bullet: 'placeholder-bullet',
    pickupHealth: 'pickup-chest', // real chest art (falls back to placeholder-pickup if unloaded)
    spitter: 'Spitter-idle', // P3.1 real Spitter sheet (falls back to the 'spitter' placeholder blob if unloaded)
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
      // P3.4 mixed roster cluster (~x2050–2300, open ground before the x2500 zombie): a Tank flanked by
      // two Runners, with a Flyer patrolling the air over the gap — demonstrates the size/speed/height mix.
      { x: 2060, y: 524, type: 'Runner' },
      { x: 2180, y: 524, type: 'Tank' },
      { x: 2300, y: 524, type: 'Runner' },
      { x: 2180, y: 390, type: 'Flyer' },
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
  // Ranged Spitter (P3.1) — AI-generated 128×128 art, assembled into one horizontal strip per state
  // in public/assets/Spitter/ (east-facing; flipped in code for west). Same [file, frames, fps, loop]
  // shape as ASSETS.player. `dead` (not `death`) matches the enemy convention Enemy.js plays.
  spitter: {
    dir: 'assets/Spitter',
    frame: 128,
    anims: {
      // state: [file, frameCount, fps, loop]
      idle:   ['idle.png',   4,  6, true],
      walk:   ['walk.png',   8, 10, true],
      attack: ['attack.png', 9, 12, false],
      hurt:   ['hurt.png',   6, 12, false],
      dead:   ['dead.png',   7,  8, false],
    },
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

// Ranged Spitter physics body — explicit, fitted to the REAL 128px sheet (never the frame size).
// Measured from Spitter/idle.png frame 0: opaque region x45–84, y19–114 → center-x ≈ 64, feet at
// frame-y 114 (the bloated spitter sits higher in its frame than the zombies, which reach y127).
//   originY 0.89 (= 114/128) puts the feet-origin on the opaque feet so it rests on the ground
//   (not floating). Body is the torso+legs core (y44–114): offsetY 44 sets its base at the feet
//   (44 + 70 = 114); offsetX 48 centers the 32-wide body on the frame center (48 + 16 = 64) so
//   flipX never shifts the hitbox. Head/arms extend outside it (as with Zombie_4). Debug-overlay tuned.
export const ACID_SPITTER_BODY = {
  width: 32, height: 70, originX: 0.5, originY: 0.89, offsetX: 48, offsetY: 44, facesLeft: false,
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
