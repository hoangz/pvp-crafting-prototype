// Game controller: orchestrates PvP and PvE modes
// Depends on: data.js, game-engine.js, bot-ai.js, ui-renderer.js

const engine = new GameEngine();
const bot    = new BotAI(engine);

// ── Shared State ──────────────────────────────────────────────────────────────
const state = {
  mode:      'pvp',  // 'pvp' | 'pve'
  active:    false,
  target:    null,
  inventory: [...BASE_ITEMS],
  selected:  [],     // pending combine slots [itemA?, itemB?]
};

const pvp = { seconds: 0, timer: null };
const pve = { stageIndex: 0, timeLeft: 0, timer: null, totalScore: 0 };

// ── DOM refs ──────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const playerGrid  = $('player-grid');
const botGrid     = $('bot-grid');
const targetCard  = $('target-card');
const timerEl     = $('timer');
const stageLabel  = $('stage-label');
const playerFB    = $('player-feedback');
const botFB       = $('bot-feedback');
const winOverlay  = $('win-overlay');
const slotA       = $('slot-a');
const slotB       = $('slot-b');
const combineBtn  = $('combine-btn');

// ── Render helpers ────────────────────────────────────────────────────────────
function renderPlayer() {
  renderInventory(state.inventory, playerGrid, state.selected, handleItemClick);
}
function renderBot() {
  renderInventory(bot.inventory, botGrid, [], null);
}

// ── Item selection & combine ──────────────────────────────────────────────────
function handleItemClick(name) {
  if (!state.active) return;
  if (state.selected.length < 2) {
    state.selected.push(name);
    updateSlots();
    renderPlayer();
    if (state.selected.length === 2) setTimeout(executeCombine, 180);
  } else {
    // Reset and start new selection
    state.selected = [name];
    updateSlots();
    renderPlayer();
  }
}

function executeCombine() {
  if (state.selected.length !== 2) return;
  const [a, b] = state.selected;
  const result  = engine.combine(a, b);

  if (result && !state.inventory.includes(result)) {
    state.inventory.push(result);
    showFeedback(playerFB, `✅ ${ITEMS[a].emoji}${a} + ${ITEMS[b].emoji}${b} → ${ITEMS[result].emoji} ${result}!`, 'success');
    clearSelection();
    renderPlayer();
    if (engine.checkWin(state.inventory, state.target)) {
      state.mode === 'pvp' ? endPvP('player') : clearPvEStage();
      return;
    }
  } else if (result) {
    showFeedback(playerFB, `⚠️ Already have ${ITEMS[result].emoji} ${result}`, 'warn');
    clearSelection();
  } else {
    showFeedback(playerFB, `❌ No recipe for ${a} + ${b}`, 'error');
    clearSelection();
  }
}

function clearSelection() {
  state.selected = [];
  updateSlots();
  renderPlayer();
}

function updateSlots() {
  const [a, b] = state.selected;
  slotA.textContent = a ? `${ITEMS[a].emoji} ${a}` : 'Select item';
  slotA.classList.toggle('filled', !!a);
  slotB.textContent = b ? `${ITEMS[b].emoji} ${b}` : 'Select item';
  slotB.classList.toggle('filled', !!b);
  combineBtn.disabled = state.selected.length < 2;
}

// ── PvP Mode ──────────────────────────────────────────────────────────────────
function startPvP() {
  // Stop any running PvE session before switching modes
  clearInterval(pve.timer);

  const diff   = $('diff-select').value;
  const pool   = diff === 'random' ? TARGETS : TARGETS.filter(t => t.difficulty === diff);
  state.target = pool[Math.floor(Math.random() * pool.length)].name;
  state.mode   = 'pvp';
  state.active = true;
  state.inventory = [...BASE_ITEMS];
  state.selected  = [];
  pvp.seconds = 0;

  document.body.classList.remove('pve-mode');
  stageLabel.textContent = '';
  updateTargetDisplay(targetCard, state.target);
  updateSlots();
  hideOverlay(winOverlay);
  renderPlayer();

  clearInterval(pvp.timer);
  pvp.timer = setInterval(() => {
    pvp.seconds++;
    updateTimerDisplay(timerEl, pvp.seconds, false);
  }, 1000);

  bot.reset();
  bot.onCombine = combo => {
    renderBot();
    showFeedback(botFB, `${ITEMS[combo.result].emoji} ${combo.result}`, 'info');
  };
  bot.onWin = () => endPvP('bot');
  bot.start(state.target, diff === 'random' ? 'medium' : diff);
  renderBot();
}

function endPvP(winner) {
  state.active = false;
  bot.stop();
  clearInterval(pvp.timer);
  showOverlay(winOverlay, winner === 'player' ? 'win' : 'lose', {
    target: state.target,
    time: timerEl.textContent,
  });
}

// ── PvE Mode ──────────────────────────────────────────────────────────────────
function startPvE() {
  // Stop any running PvP session before switching modes
  bot.stop();
  clearInterval(pvp.timer);

  state.mode = 'pve';
  pve.stageIndex = 0;
  pve.totalScore = 0;
  // Shuffle stage order so each run feels different
  pve.stages = [...PVE_STAGES].sort(() => Math.random() - 0.5);
  document.body.classList.add('pve-mode');
  hideOverlay(winOverlay);
  beginPvEStage();
}

function beginPvEStage() {
  const stage = pve.stages[pve.stageIndex];
  state.target    = stage.target;
  state.active    = true;
  state.inventory = [...BASE_ITEMS];
  state.selected  = [];
  pve.timeLeft    = stage.timeLimit;

  stageLabel.textContent = stage.label;
  updateTargetDisplay(targetCard, state.target);
  updateSlots();
  renderPlayer();

  clearInterval(pve.timer);
  updateTimerDisplay(timerEl, pve.timeLeft, true);
  pve.timer = setInterval(() => {
    pve.timeLeft--;
    updateTimerDisplay(timerEl, pve.timeLeft, true);
    if (pve.timeLeft <= 0) {
      clearInterval(pve.timer);
      timeoutPvE();
    }
  }, 1000);
}

function clearPvEStage() {
  state.active = false;
  clearInterval(pve.timer);
  const stage   = pve.stages[pve.stageIndex];
  const isLast  = pve.stageIndex >= pve.stages.length - 1;

  // Score = base + time bonus (proportional to time remaining)
  const timeBonus   = Math.floor((pve.timeLeft / stage.timeLimit) * stage.baseScore);
  const stageScore  = stage.baseScore + timeBonus;
  pve.totalScore   += stageScore;

  if (isLast) {
    showOverlay(winOverlay, 'pve-complete', {
      totalStages: PVE_STAGES.length,
      totalScore:  pve.totalScore,
    });
  } else {
    showOverlay(winOverlay, 'stage-clear', {
      stage:      stage.stage,
      target:     state.target,
      timeLeft:   pve.timeLeft,
      stageScore,
      totalScore: pve.totalScore,
    });
    setTimeout(() => {
      hideOverlay(winOverlay);
      pve.stageIndex++;
      beginPvEStage();
    }, 2500);
  }
}

function timeoutPvE() {
  state.active = false;
  showOverlay(winOverlay, 'timeout', { target: state.target });
}

// ── Drag & Drop combine slots ─────────────────────────────────────────────────
function setupDropZones() {
  [slotA, slotB].forEach((slot, idx) => {
    slot.addEventListener('dragover', e => { e.preventDefault(); slot.classList.add('drag-over'); });
    slot.addEventListener('dragleave', () => slot.classList.remove('drag-over'));
    slot.addEventListener('drop', e => {
      e.preventDefault();
      slot.classList.remove('drag-over');
      const name = e.dataTransfer.getData('text/plain');
      if (!name || !state.active) return;
      state.selected[idx] = name;
      updateSlots();
      if (state.selected[0] && state.selected[1]) setTimeout(executeCombine, 180);
    });
  });
}

// ── Init ──────────────────────────────────────────────────────────────────────
setupDropZones();
$('start-pvp-btn').addEventListener('click', startPvP);
$('start-pve-btn').addEventListener('click', startPvE);
combineBtn.addEventListener('click', () => { if (state.selected.length === 2) executeCombine(); });
$('play-again-btn').addEventListener('click', () => state.mode === 'pvp' ? startPvP() : startPvE());
