// Bot opponent AI for PvP mode
// Crafts items automatically at configurable speed, prioritizes target-producing combos
class BotAI {
  constructor(engine) {
    this.engine = engine;
    this.inventory = [...BASE_ITEMS];
    this.target = null;
    this._timer = null;
    this._delay = 2500;

    // Callbacks set by game controller
    this.onCombine = null; // ({ a, b, result }) => void
    this.onWin = null;     // () => void
  }

  start(target, difficulty) {
    this.target = target;
    // Base delay by difficulty — jitter added per move
    const delays = { easy: 4500, medium: 2800, hard: 1600 };
    this._delay = delays[difficulty] ?? 2800;
    this._scheduleMove();
  }

  stop() {
    clearTimeout(this._timer);
    this._timer = null;
  }

  reset() {
    this.stop();
    this.inventory = [...BASE_ITEMS];
  }

  _scheduleMove() {
    // ±600ms jitter so bot feels less robotic
    const jitter = (Math.random() - 0.5) * 1200;
    this._timer = setTimeout(() => this._makeMove(), this._delay + jitter);
  }

  _makeMove() {
    const combos = this.engine.getSmartCombos(this.inventory, this.target);

    if (combos.length === 0) {
      // No valid moves yet — wait and retry
      this._scheduleMove();
      return;
    }

    // Pick randomly from smart combos (direct target combos are pre-prioritized)
    const combo = combos[Math.floor(Math.random() * combos.length)];
    this.inventory.push(combo.result);

    if (this.onCombine) this.onCombine(combo);

    if (this.engine.checkWin(this.inventory, this.target)) {
      if (this.onWin) this.onWin();
      return;
    }

    this._scheduleMove();
  }
}
