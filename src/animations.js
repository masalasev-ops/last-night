// Animation registry — creates every Phaser animation from the ASSETS block in config.js.
// Called once in BootScene.create(), after the spritesheets have finished loading.
//
// Convention: each animation's key matches the spritesheet texture key it plays
// (e.g. 'player-idle', 'Zombie_4-attack'). Phaser stores textures and animations in
// separate managers, so sharing the string is safe and keeps the swap-point obvious.
import { ASSETS } from './config.js';

export function registerAnimations(scene) {
  // Player — one sheet per state, frame counts/fps/loop straight from the registry.
  for (const [state, [, frames, fps, loop]] of Object.entries(ASSETS.player.anims)) {
    const key = `player-${state}`;
    scene.anims.create({
      key,
      frames: scene.anims.generateFrameNumbers(key, { start: 0, end: frames - 1 }),
      frameRate: fps,
      repeat: loop ? -1 : 0,
    });
  }

  // Zombies — per type × per state. Only idle/walk loop; attack/hurt/dead play once.
  const { types, fps } = ASSETS.zombies;
  for (const [type, counts] of Object.entries(types)) {
    for (const [state, n] of Object.entries(counts)) {
      const key = `${type}-${state}`;
      scene.anims.create({
        key,
        frames: scene.anims.generateFrameNumbers(key, { start: 0, end: n - 1 }),
        frameRate: fps[state],
        repeat: state === 'idle' || state === 'walk' ? -1 : 0,
      });
    }
  }

  // Ranged Spitter (P3.1) — one anim per state from ASSETS.spitter, keyed 'Spitter-<state>'.
  // Only idle/walk loop; attack/hurt/dead play once (same rule as the zombies).
  for (const [state, [, frames, fps, loop]] of Object.entries(ASSETS.spitter.anims)) {
    const key = `Spitter-${state}`;
    scene.anims.create({
      key,
      frames: scene.anims.generateFrameNumbers(key, { start: 0, end: frames - 1 }),
      frameRate: fps,
      repeat: loop ? -1 : 0,
    });
  }

  // Pickups (L5) — a looping shimmer per collectible sheet (e.g. 'pickup-chest').
  for (const [name, { frames, fps }] of Object.entries(ASSETS.pickups)) {
    const key = `pickup-${name}`;
    scene.anims.create({
      key,
      frames: scene.anims.generateFrameNumbers(key, { start: 0, end: frames - 1 }),
      frameRate: fps,
      repeat: -1,
    });
  }
}
