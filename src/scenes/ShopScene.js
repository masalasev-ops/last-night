import { Scene } from 'phaser';
import { CONFIG } from '../config.js';
import { runState } from '../runState.js';

/**
 * ShopScene (P3.3) — the between-levels shop. A functional TEXT UI (placeholder-first; real layout/icons
 * are a later art pass). Reads RunState + CONFIG.SHOP/UPGRADES/WEAPONS and renders: the salvage balance,
 * a weapon-unlock list, an upgrade list (with tier/prereq gating), and a Continue button. Buying goes
 * through runState.unlockWeapon/buyUpgrade (which own affordability/prereq/one-shot rules), then the list
 * re-renders. Continue starts the next level (stub: Level 1 until P3.6) — RunState carries forward
 * untouched, so unlocks/upgrades/salvage persist.
 */
export class ShopScene extends Scene {
  constructor() {
    super('Shop');
  }

  create() {
    const { width, height } = CONFIG;

    // Dark backdrop so it reads as a distinct screen
    this.add.rectangle(0, 0, width, height, 0x0a0a0f, 0.96).setOrigin(0, 0);

    this.f = CONFIG.hud.font.family;
    this.stroke = CONFIG.hud.stroke;

    this.mkText(width / 2, 40, 'SALVAGE SHOP', 30, '#e8e8e8').setOrigin(0.5);
    this.mkText(width / 2, 78, 'Click an item to buy · Continue to the next level', 13, '#8890a0').setOrigin(0.5);

    this.rows = []; // rebuilt each render() so states + balance update and no stale click handlers linger
    this.render();

    console.log('[ShopScene] ready');
  }

  /** (Re)build the whole list — called on create and after every purchase. */
  render() {
    this.rows.forEach((o) => o.destroy());
    this.rows = [];

    const L = 180; // left column x
    let y = 120;

    // Balance
    this.rows.push(this.mkText(L, y, `SALVAGE: ${runState.salvage}`, 22, '#ffd27f'));
    y += 46;

    // --- Weapon unlocks ---
    this.rows.push(this.mkText(L, y, 'WEAPONS', 16, '#9aa0ac'));
    y += 28;
    for (const id of CONFIG.SHOP.weaponsForSale) {
      const w = CONFIG.WEAPONS[id];
      const owned = runState.isUnlocked(id);
      const buyable = runState.weaponAvailable(id);
      const state = owned ? 'OWNED' : buyable ? 'BUY' : 'NEED SALVAGE';
      this.addRow(L, y, `${w.name}  —  ${w.unlockCost}`, state, owned, buyable, () => runState.unlockWeapon(id));
      y += 30;
    }

    y += 16;

    // --- Upgrades ---
    this.rows.push(this.mkText(L, y, 'UPGRADES', 16, '#9aa0ac'));
    y += 28;
    for (const id of CONFIG.SHOP.upgradesForSale) {
      const u = CONFIG.UPGRADES[id];
      const owned = runState.ownedUpgrades.has(id);
      const prereqMet = !u.prereq || runState.ownedUpgrades.has(u.prereq);
      const buyable = runState.upgradeAvailable(id);
      const state = owned
        ? 'OWNED'
        : !prereqMet
          ? `LOCKED (needs ${CONFIG.UPGRADES[u.prereq].name})`
          : buyable
            ? 'BUY'
            : 'NEED SALVAGE';
      this.addRow(L, y, `${u.name}  —  ${u.cost}`, state, owned, buyable, () => runState.buyUpgrade(id));
      y += 30;
    }

    // --- Continue → next level (or the end placeholder) ---
    // P3.6: route by the cleared level's nextLevelId. null → last level of Chapter 1 → the "to be continued"
    // End screen (the seam P3.7's boss replaces). Otherwise advanceLevel() moves the cursor to nextLevelId,
    // flips phase to 'level', and checkpoints (the next level's death-revert target + on-disk save), then Game.
    const isEnd = (CONFIG.LEVELS[runState.levelIndex]?.nextLevelId ?? null) === null;
    const cont = this.mkText(CONFIG.width / 2, CONFIG.height - 44, isEnd ? '[ FINISH CHAPTER → ]' : '[ CONTINUE → ]', 22, '#3ad06a').setOrigin(0.5);
    cont.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      if (isEnd) {
        this.scene.start('End');
      } else {
        runState.advanceLevel();
        this.scene.start('Game');
      }
    });
    this.rows.push(cont);
  }

  /**
   * One purchasable row: a label + a state tag. Interactive (green) only when `buyable`; owned rows are
   * dimmed, unaffordable/locked rows greyed and inert. Clicking a buyable row runs `buy()`; if it
   * succeeds, re-render so balance and every row's state refresh.
   */
  addRow(x, y, label, state, owned, buyable, buy) {
    const color = buyable ? '#d6dae2' : owned ? '#6a8f5a' : '#5a5f6a';
    const row = this.mkText(x, y, `${label}    ${state}`, 16, color);
    if (buyable) {
      row.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        // Single choke point for both weapon unlocks and upgrades: persist immediately on success (P3.5)
        // so purchases survive closing the browser mid-shop, then re-render states + balance.
        if (buy()) {
          runState.save();
          this.render();
        }
      });
    }
    this.rows.push(row);
  }

  /** Small helper: a stroked text in the HUD font. */
  mkText(x, y, text, size, color) {
    return this.add
      .text(x, y, text, { fontFamily: this.f, fontSize: size, color })
      .setStroke(this.stroke.color, this.stroke.thickness);
  }
}
