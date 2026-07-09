import { AUTO, Scale, Game } from 'phaser';
import { CONFIG } from './config.js';
import { runState } from './runState.js';
import { BootScene } from './scenes/BootScene.js';
import { TitleScene } from './scenes/TitleScene.js';
import { GameScene } from './scenes/GameScene.js';
import { UIScene } from './scenes/UIScene.js';
import { ShopScene } from './scenes/ShopScene.js';

const config = {
  type: AUTO,
  width: CONFIG.width,
  height: CONFIG.height,
  parent: 'game-container',
  backgroundColor: CONFIG.backgroundColor,
  pixelArt: true, // crisp pixels at scaled resolution
  scale: {
    mode: Scale.FIT,
    autoCenter: Scale.CENTER_BOTH,
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: CONFIG.gravity },
      debug: false,
    },
  },
  scene: [BootScene, TitleScene, GameScene, UIScene, ShopScene],
};

const StartGame = (parent) => {
  return new Game({ ...config, parent });
};

document.addEventListener('DOMContentLoaded', () => {
  const game = StartGame('game-container');
  // Dev-only globals for console debugging + automated verification. Stripped from prod builds.
  if (import.meta.env.DEV) {
    window.game = game;
    window.CONFIG = CONFIG;
    window.runState = runState; // P3.3 — run-scoped salvage/unlocks/upgrades introspection for the harness
  }
});

export default StartGame;
