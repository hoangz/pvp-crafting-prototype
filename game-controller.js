// Game controller: orchestrates PvP, PvE, and Free Craft modes
// Depends on: data.js, game-engine.js, bot-ai.js, ui-renderer.js, free-craft.js

const engine = new GameEngine();
const bot    = new BotAI(engine);

// ── Shared State ──────────────────────────────────────────────────────────────
const state = {
  mode:      'pvp',  // 'pvp' | 'pve' | 'free'
  active:    false,
  target:    null,
  inventory: [...BASE_ITEMS],
  selected:  [],     // pending combine slots [itemA?, itemB?]
};

const pvp = { seconds: 0, timer: null };
const pve = { stageIndex: 0, timeLeft: 0, timer: null, totalScore: 0, awaitingNext: false };
const fc  = { timeLeft: 0, timer: null, stageIndex: 0, stages: [], totalScore: 0, awaitingNext: false };

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
    state.selected = [name];
    updateSlots();
    renderPlayer();
  }
}

async function executeCombine() {
  if (state.selected.length !== 2) return;
  const [a, b] = state.selected;

  // ── Free Craft: AI-powered path ──
  if (state.mode === 'free') {
    combineBtn.disabled = true;
    slotA.classList.add('loading');
    slotB.classList.add('loading');
    try {
      const { name, emoji, isNew } = await FreeCraft.combine(a, b);
      // Register new item into ITEMS so it renders correctly
      if (!ITEMS[name]) ITEMS[name] = { tier: 1, emoji };
      if (!state.inventory.includes(name)) {
        state.inventory.push(name);
        const tag = isNew ? '✨ NEW! ' : '✅ ';
        showFeedback(playerFB, `${tag}${ITEMS[a].emoji} ${a} + ${ITEMS[b].emoji} ${b} → ${emoji} ${name}`, isNew ? 'success' : 'info');
        // Win check: target reached
        if (name.toLowerCase() === state.target.toLowerCase()) {
          clearSelection();
          combineBtn.disabled = false;
          clearFCStage();
          return;
        }
      } else {
        showFeedback(playerFB, `⚠️ Already have ${emoji} ${name}`, 'warn');
      }
    } catch (err) {
      showFeedback(playerFB, `❌ ${err.message}`, 'error');
    }
    slotA.classList.remove('loading');
    slotB.classList.remove('loading');
    clearSelection();
    combineBtn.disabled = false;
    return;
  }

  // ── PvP / PvE: static recipes ──
  const result = engine.combine(a, b);
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
  clearInterval(pve.timer);
  clearInterval(fc.timer);
  document.body.classList.remove('pve-mode', 'free-mode');

  const diff  = $('diff-select').value;
  const pool  = diff === 'random' ? TARGETS : TARGETS.filter(t => t.difficulty === diff);
  if (!pool.length) return;
  const match    = pool[Math.floor(Math.random() * pool.length)];
  const botDiff  = diff === 'random' ? match.difficulty : diff;
  state.target = match.name;
  state.mode   = 'pvp';
  state.active = true;
  state.inventory = [...match.base];
  state.selected  = [];
  pvp.seconds = 0;

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

  bot.reset(match.base);
  bot.onCombine = combo => {
    renderBot();
    showFeedback(botFB, `${ITEMS[combo.result].emoji} ${combo.result}`, 'info');
  };
  bot.onWin = () => endPvP('bot');
  bot.start(state.target, botDiff, match.base);
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
  bot.stop();
  clearInterval(pvp.timer);
  clearInterval(fc.timer);
  document.body.classList.remove('free-mode');

  state.mode = 'pve';
  pve.stageIndex = 0;
  pve.totalScore = 0;

  // Build stages: pick from TARGETS filtered by difficulty, shuffle, take 5, sort easy→hard
  const diff    = $('diff-select').value;
  const pool    = diff === 'random' ? [...TARGETS] : TARGETS.filter(t => t.difficulty === diff);
  const source  = pool.length >= 5 ? pool
    : [...pool, ...TARGETS.filter(t => !pool.includes(t))]; // pad with others if < 5
  const diffOrder = { easy: 0, medium: 1, hard: 2 };
  const timeLimits = { easy: 60, medium: 75, hard: 90 };
  const picked = source.sort(() => Math.random() - 0.5).slice(0, 5);
  picked.sort((a, b) => diffOrder[a.difficulty] - diffOrder[b.difficulty]);
  pve.stages = picked.map((t, i) => ({
    stage: i + 1, target: t.name, base: t.base,
    timeLimit: timeLimits[t.difficulty],
    label: `Stage ${i + 1} — ${t.name}`,
    baseScore: (i + 1) * 150,
  }));
  document.body.classList.add('pve-mode');
  hideOverlay(winOverlay);
  beginPvEStage();
}

function beginPvEStage() {
  const stage = pve.stages[pve.stageIndex];
  state.target    = stage.target;
  state.active    = true;
  state.inventory = [...stage.base];
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

  const timeBonus   = Math.floor((pve.timeLeft / stage.timeLimit) * stage.baseScore);
  const stageScore  = stage.baseScore + timeBonus;
  pve.totalScore   += stageScore;

  if (isLast) {
    showOverlay(winOverlay, 'pve-complete', {
      totalStages: PVE_STAGES.length,
      totalScore:  pve.totalScore,
    });
  } else {
    pve.awaitingNext = true;
    showOverlay(winOverlay, 'stage-clear', {
      stage:      stage.stage,
      target:     state.target,
      timeLeft:   pve.timeLeft,
      stageScore,
      totalScore: pve.totalScore,
    });
  }
}

function timeoutPvE() {
  state.active = false;
  showOverlay(winOverlay, 'timeout', { target: state.target });
}

// ── Free Craft Mode (AI PvE — multi-stage with AI-generated recipes) ─────────
async function startFreeCraft() {
  bot.stop();
  clearInterval(pvp.timer);
  clearInterval(pve.timer);
  clearInterval(fc.timer);

  // Show loading
  state.mode   = 'free';
  state.active = false;
  document.body.classList.remove('pve-mode');
  document.body.classList.add('free-mode');
  hideOverlay(winOverlay);
  stageLabel.textContent = '🤖 Generating recipes…';
  targetCard.innerHTML = '<span class="target-placeholder" style="font-size:14px">⏳ AI building recipes…</span>';
  timerEl.textContent = '';
  state.inventory = [...BASE_ITEMS];
  state.selected  = [];
  updateSlots();
  renderPlayer();

  try {
    const tree = await FreeCraft.generateTree();
    FreeCraft.liveCache = {};

    if (tree.targets.length === 0) throw new Error('No targets generated');

    // Build stages from targets (each T3 = 1 stage)
    fc.stages = tree.targets.map((t, i) => ({
      stage:     i + 1,
      target:    t,
      timeLimit: 90,
      label:     `Stage ${i + 1} — ${t}`,
      baseScore: (i + 1) * 300,
    }));
    fc.stageIndex = 0;
    fc.totalScore = 0;
    fc.awaitingNext = false;

    beginFCStage();
  } catch (err) {
    stageLabel.textContent = '❌ Failed to generate recipes';
    targetCard.innerHTML = `<span class="target-placeholder" style="font-size:12px;color:var(--red)">${err.message}</span>`;
    showFeedback(playerFB, `❌ ${err.message}`, 'error');
  }
}

function beginFCStage() {
  const stage = fc.stages[fc.stageIndex];
  state.target    = stage.target;
  state.active    = true;
  state.inventory = [...BASE_ITEMS];
  state.selected  = [];
  fc.timeLeft     = stage.timeLimit;

  stageLabel.textContent = stage.label;
  updateTargetDisplay(targetCard, stage.target);
  updateSlots();
  renderPlayer();

  clearInterval(fc.timer);
  updateTimerDisplay(timerEl, fc.timeLeft, true);
  fc.timer = setInterval(() => {
    fc.timeLeft--;
    updateTimerDisplay(timerEl, fc.timeLeft, true);
    if (fc.timeLeft <= 0) {
      clearInterval(fc.timer);
      state.active = false;
      showOverlay(winOverlay, 'timeout', { target: state.target });
    }
  }, 1000);
}

function clearFCStage() {
  state.active = false;
  clearInterval(fc.timer);
  const stage  = fc.stages[fc.stageIndex];
  const isLast = fc.stageIndex >= fc.stages.length - 1;

  const timeBonus  = Math.floor((fc.timeLeft / stage.timeLimit) * stage.baseScore);
  const stageScore = stage.baseScore + timeBonus;
  fc.totalScore   += stageScore;

  if (isLast) {
    showOverlay(winOverlay, 'pve-complete', {
      totalStages: fc.stages.length,
      totalScore:  fc.totalScore,
    });
  } else {
    fc.awaitingNext = true;
    showOverlay(winOverlay, 'stage-clear', {
      stage:      stage.stage,
      target:     state.target,
      timeLeft:   fc.timeLeft,
      stageScore,
      totalScore: fc.totalScore,
    });
  }
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

// ── Active mode button highlight ──────────────────────────────────────────────
function setActiveBtn(activeId) {
  ['start-pvp-btn','start-pve-btn'].forEach(id => {
    const el = $(id);
    el.classList.toggle('btn-primary',   id === activeId);
    el.classList.toggle('btn-secondary', id !== activeId);
  });
}

// ── Init ──────────────────────────────────────────────────────────────────────
setupDropZones();
$('start-pvp-btn').addEventListener('click', () => { setActiveBtn('start-pvp-btn'); startPvP(); });
$('start-pve-btn').addEventListener('click', () => { setActiveBtn('start-pve-btn'); startPvE(); });
$('start-fc-btn').addEventListener('click',  () => { showFeedback(playerFB, '🚧 API mode coming soon!', 'info'); });

// Default: start PvE on load
setActiveBtn('start-pve-btn');
startPvE();
combineBtn.addEventListener('click', () => { if (state.selected.length === 2) executeCombine(); });
$('play-again-btn').addEventListener('click', () => {
  if (state.mode === 'pve' && pve.awaitingNext) {
    pve.awaitingNext = false;
    hideOverlay(winOverlay);
    pve.stageIndex++;
    beginPvEStage();
  } else if (state.mode === 'pvp') {
    startPvP();
  } else if (state.mode === 'free' && fc.awaitingNext) {
    fc.awaitingNext = false;
    hideOverlay(winOverlay);
    fc.stageIndex++;
    beginFCStage();
  } else if (state.mode === 'free') {
    startFreeCraft();
  } else {
    startPvE();
  }
});
