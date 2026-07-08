# Last Night — Phase 3 Plan v2 (decisions locked)

> **Where you are.** Phase 2 shipped a complete, tagged one-level forest slice (animated rifle soldier, 4 melee zombie types, tileset + parallax terrain, atmosphere, HUD, pickup, win/restart), fully data-driven on Phaser 4 + Vite, 960×540, CraftPix pixel art.
>
> **What Phase 3 is.** Build the **systems** that make it a game (weapons, upgrades, ranged/varied enemies, checkpoints, save, a boss, menus, audio) and **prove them across a second biome + a boss**, ending in a **shippable Chapter 1 demo** that closes on a boss and a story hook (clue + survivor). Systems built here become reusable → later chapters are content.

---

## Decisions (locked)

| # | Decision | Resolution |
|---|---|---|
| 1 | Weapon look | **HUD/projectile, not character art.** Soldier always visually holds the rifle; weapon identity reads from HUD icon + projectile + sound. Per-weapon character art is a deferrable later art pass (hold-groups, not per-weapon). |
| 2 | Weapon set | **3 weapons** — Rifle (auto), Shotgun (spread/pellets), SMG (fast/low-damage). Weapon "art" = 3 small HUD icons; projectiles/muzzle are config, not new art. |
| 3 | Upgrade economy | **Scrap dropped by enemies**, spent at an **end-of-level shop** (between-levels scene) on weapons and upgrades. No mid-level spending. |
| 4 | Second biome | **Yes** — Level 2 in a darker biome (swamp / cave / ruins; exact CraftPix pack confirmed at P3.6). |
| 5 | Bosses & extra enemies | **AI-generated**, matched to the CraftPix style (see the AI Prompt Kit). Built behavior-first with placeholders, art dropped in via the swap-point. |
| 6 | Save storage | **`localStorage`** for Continue/autosave. **New Game wipes the save clean.** Full save UI deferred. |
| 7 | Story | **Constant goal (reunite the family) + varied per-level beats** — clues, ally encounters, weapon unlocks, twists; **rescues are rare chapter climaxes**, not every level. Demo ends on a **clue + survivor hook**. See below. |
| 8 | Difficulty | **One tuned difficulty** for now; modes are later polish. |

---

## Story & structure (constant goal, varied beats)

The protagonist wakes in the wilderness; his family — wife and kids — have been taken deeper into the nightmare. The **overall goal stays constant** (find them, reunite everyone), but **what happens at the end of each level varies** — this is what keeps a long game fresh. A rescue every level would go stale fast and burn the emotional payoff; instead, rescues are **rare, earned chapter climaxes**, and most levels deliver a different, lighter beat.

**The story-beat toolbox** — rotate through these; each is a *mechanism* Phase 3 mostly already builds, so any level can use any beat:

- **Clue / environmental story** — a note, photo, or recording revealing where the family was taken or what's happening. (Needs: the note-reader.)
- **Ally / survivor encounter** — someone met along the way who tells you something, hands you a weapon or key, points you onward; a recurring face gives the lonely game a human thread. (Needs: a scripted talk/pickup moment.)
- **Weapon / ability unlock** — the level's payoff *is* the new tool. (Needs: weapon pickup — already in P3.3.)
- **Boss + rescue** — reserved for **chapter ends**, not every level. Rare, so it lands. (Needs: boss + rescue beat.)
- **Twist / revelation** — you learn something that recontextualizes the goal. (Needs: a note/vision.)

Why this is *less* work, not more: most beats (a note, an ally handing you a gun) are lightweight text + a pickup + a short scripted moment; only the boss-and-rescue set-pieces are heavy, and you now do those rarely. You build the **toolbox** in Phase 3; **which beat goes in which level is deferred content** you author level by level once the tools exist — no need to script 10–20 levels now.

Still **modular and incrementally shippable**: each chapter (a few levels ending in a boss) is a self-contained, releasable unit, so you ship chapter by chapter. The total level count (10 vs 20) is a later content decision the systems don't care about.

**For the demo:** Chapter 1 ends with the boss, and the payoff is a **clue + a surviving ally who tells you where to go next** — mysterious and hooky, which suits a demo better than resolving a rescue barely set up. The Victory screen delivers that hook. The first *real* rescue is saved for a later chapter where it's earned.

---

## The Phase 3 deliverable
A hostable ~15–20 minute **Chapter 1 demo**: **Main Menu → Level 1 (forest) → end-of-level shop → Level 2 (second biome) → Boss → clue + survivor hook → Victory** — with the 3-weapon set, upgrades, ranged + varied enemies, checkpoints, save/continue (New Game wipes), menus, and audio.

Split point: **3a = P3.1–P3.5 (combat + systems)**, **3b = P3.6–P3.10 (content + shell + ship)**. Pause between to reassess. Same rhythm throughout: one milestone, Plan Mode, a DoD, review, build, commit.

---

## Milestone roadmap

### Phase 3a — Combat depth & systems

**P3.1 — Ranged enemy + enemy-projectile system** *(start here)*
`aiProfile: 'ranged'` on the FSM: maintain a preferred distance, check line-of-sight, fire on cooldown. A pooled enemy-projectile — **green acid, lobbed in an arc** (so a perched player must actually dodge, turning the RETREAT stopgap into a real threat). Built with a placeholder enemy; spitter art dropped in later.
*DoD:* a ranged enemy keeps distance, lobs arcing acid on cooldown, damages the player (incl. perched), dies via the existing FSM; projectiles pooled; 60 FPS.

**P3.2 — Data-driven weapon system + switching**
Refactor the single weapon into a `WEAPONS` table; ship Rifle / Shotgun / SMG with switching (number keys / scroll) and per-weapon ammo. Weapon identity = HUD icon + projectile behavior (pellets/spread/speed/tint) + sound. No character-art change.
*DoD:* 3 weapons switchable and distinctly different; all from data; a 4th would be a data row; HUD shows current weapon + icon; per-weapon ammo tracked.

**P3.3 — Scrap, end-of-level shop & upgrades**
Enemies drop **scrap**. On level-complete, an **end-of-level shop scene** lets the player spend scrap on weapon unlocks and **upgrades** (data-driven stat modifiers: damage, reload, mag, fire rate). Prove one full upgrade path end-to-end. No mid-level spending.
*DoD:* enemies drop scrap that's counted; the shop opens on level-complete and spends scrap to unlock/upgrade; effects apply and persist into the next level; leaving the shop continues the game.

**P3.4 — Enemy roster expansion**
2–3 more types via `aiProfile` + data (fast **runner**, **tank**, optional **flyer**), reusing the FSM. Placeholder-first; AI art later.
*DoD:* new types exist as data + existing profiles, each distinct; a mixed-group fight reads clearly; 60 FPS.

**P3.5 — Checkpoints & save/load**
Checkpoints from level data (respawn, restore state). A save module: **Continue** + autosave on checkpoint via `localStorage` (versioned), persisting level/checkpoint, player stats, ammo, weapons, upgrades, scrap, and rescue/story flags. **New Game wipes the save.**
*DoD:* dying respawns at the last checkpoint with state restored; Continue restores progress across a relaunch; New Game clears everything and starts fresh.

### Phase 3b — Content, shell & ship

**P3.6 — Level system + second biome (Level 2)**
Generalize level loading to pure data (biome, tileset, bg, terrain, spawns, checkpoints, items, `nextLevelId`). Build **Level 2** in the second biome with **zone-triggered spawns** and **paced encounters** (tension → lull → tougher fight). Level→shop→level transition.
*DoD:* Level 2 loads from data in a new biome; enemies spawn by zone as you advance; the level is paced, not a uniform sprinkle; L1 → shop → L2 flows; 60 FPS.

**P3.7 — Boss fight + chapter payoff (Boss 1)**
A **Boss** with a data-driven phase controller (health-threshold phases), a telegraphed intro, two attack patterns (melee lunge + ranged/AoE), a death sequence, and a boss health bar. AI-generated art. On death → the chapter's **story beat** fires (for the demo: a **clue + a surviving ally** who points onward — see Story) → chapter-complete. The beat is data-driven (`beatOnDefeat`) so a later chapter's boss can trigger a rescue instead.
*DoD:* a full two-phase boss encounter — intro, transition, death — with a working boss bar and no soft-locks; defeating it fires the data-defined story beat and the chapter-complete transition.

**P3.8 — Menus & scene flow**
Real menus replacing the template: **Main Menu** (New Game / Continue / Settings / Quit — Continue only if a save exists; New Game confirms + wipes), **Pause**, **Settings** (volume, atmosphere-quality), **Game Over**, **Victory** (delivers the chapter's story beat — for the demo, the clue + survivor hook to the next chapter). Plus the **end-of-level shop** scene from P3.3. Proper routing.
*DoD:* all menus reachable and functional; Continue gated on a save; New Game wipes after confirm; pause halts gameplay; settings apply.

**P3.9 — Audio**
Per-weapon fire SFX, reload, hit, enemy death, projectile, pickup; a music-state controller (ambient / combat / boss); audio manager with volume from settings, silent-safe.
*DoD:* SFX on the right events; music shifts ambient↔combat↔boss; volume applies; missing files don't break anything.

**P3.10 — Chapter 1 assembly, polish & demo build**
Stitch **Menu → L1 → shop → L2 → Boss → clue + survivor hook → Victory** with checkpoints, all systems, and audio. Story beats: intro card, a couple of notes, a family-vision breather, and the boss payoff (clue + ally handing you a lead), outro hook. Balance + performance pass, debug off. Build and **host a public demo** (itch.io / GitHub Pages).
*DoD:* a fresh player completes Chapter 1 start→finish — two biomes, weapon switching + an upgrade path, ranged + varied enemies, checkpoints/save, the boss, the clue/survivor payoff, menus, audio — no console errors, stable frame rate; a hosted build link exists.

---

## Weapon art (what you actually need)
Not character art. Just: **3 small HUD weapon icons** (~32px — CraftPix icon freebies, quick generated ones, or text labels to start). Everything else is config — the shotgun is your bullet fired as N pellets with spread, the SMG a faster tinted bullet, muzzle flash your existing particle tinted/scaled per weapon. Per-weapon character art stays a deferrable later pass.

---

## Key data schemas (refined per milestone)
```
WEAPONS[id]  = { name, fireMode:'single'|'auto'|'burst', damage, fireRate, magSize,
                 reloadTime, bulletSpeed, range, pellets, spreadDeg, ammoType,
                 projectileTint, muzzleScale, hudIcon, sfxFire, sfxReload }
ENEMIES[type]= { aiProfile:'melee'|'ranged'|'runner'|'tank'|'flyer', maxHealth, moveSpeed,
                 chaseSpeed, detectionRadius, attackRange, touchDamage, attackCooldown,
                 scrapDrop:{min,max}, sheet, body,
                 // ranged: projectileId, preferredRange, projectileSpeed, projectileArc }
UPGRADES[id] = { target:weaponId|'player', stat, mode:'add'|'mult', amount, cost, prereq? }
SHOP         = { weaponsForSale:[ids], upgradesForSale:[ids] }        // shown between levels
BOSS[id]     = { maxHealth, introKey, deathKey, musicId, bossBar:true,
                 beatOnDefeat:{ type:'clue'|'ally'|'weapon'|'rescue'|'twist', payload },
                 phases:[{ healthPct, attacks:[...], moveSpeedMult, intro? }] }
LEVEL[id]    = { biome, tilesetKey, bgLayers, terrain, spawn, checkpoints:[...],
                 enemySpawns:[{type,x,y,trigger:'on_load'|'on_enter_zone',zone?}],
                 itemSpawns, pickups, boss?, nextLevelId }
SAVE         = { version, currentLevelId, checkpointIndex, player:{health,armor,maxHealth},
                 ammoByType, unlockedWeapons, upgrades, scrap, storyFlags, beatsSeen }
                 // storyFlags tracks rescues/clues/allies met; New Game deletes this key entirely
```

---

## Scope guard — NOT in Phase 3
Chapters beyond Chapter 1; the full weapon ladder and every upgrade; the skill tree / XP; difficulty modes; per-weapon character art; the total level count (10 vs 20 is a later content decision). All of it rides on top of the Phase 3 systems, added chapter by chapter.

---

## How we work / next steps
1. **Update `CLAUDE.md`** for Phase 3 (source of truth = this doc; scope now = real systems, multiple levels, and the constant-goal / varied-beat story framing).
2. **Write & review the P3.1 plan** (ranged acid spitter, lobbed arc, placeholder art), then build it through Claude Code — same review→build→playtest→commit rhythm.

**Start with P3.1.** It depends on none of the open content decisions, it's the fun playtest-driven priority, and it proves the FSM extends.
