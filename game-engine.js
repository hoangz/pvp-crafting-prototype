// Core crafting engine: O(1) recipe lookup, win detection, combo finder
class GameEngine {
  constructor() {
    // Build commutative lookup map: "itemA|itemB" (sorted) → result
    this.recipeMap = new Map();
    for (const [a, b, result] of RECIPES) {
      const key = this._key(a, b);
      if (!this.recipeMap.has(key)) {
        // First recipe wins (primary over alternates)
        this.recipeMap.set(key, result);
      }
    }
  }

  // Sorted join for commutative key
  _key(a, b) {
    return a <= b ? `${a}|${b}` : `${b}|${a}`;
  }

  // Returns result item name, or null if no recipe
  combine(itemA, itemB) {
    return this.recipeMap.get(this._key(itemA, itemB)) ?? null;
  }

  // True if target is in inventory
  checkWin(inventory, target) {
    return inventory.includes(target);
  }

  // All valid combinations for current inventory that produce a new item
  getValidCombos(inventory) {
    const combos = [];
    const set = new Set(inventory);
    for (let i = 0; i < inventory.length; i++) {
      for (let j = i; j < inventory.length; j++) {
        const result = this.combine(inventory[i], inventory[j]);
        if (result && !set.has(result)) {
          combos.push({ a: inventory[i], b: inventory[j], result });
        }
      }
    }
    return combos;
  }

  // Prioritize combos that directly produce the target; fall back to all valid
  getSmartCombos(inventory, target) {
    const all = this.getValidCombos(inventory);
    const direct = all.filter(c => c.result === target);
    return direct.length > 0 ? direct : all;
  }
}
