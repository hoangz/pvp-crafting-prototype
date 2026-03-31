// UI renderer: inventory grid, feedback messages, target display, overlays
// All functions are pure DOM operations — no game state mutation

// Render item cards into a grid container
// selectedItems: string[] of currently selected item names (for highlight)
// onItemClick: (itemName) => void | null for read-only grids
function renderInventory(inventory, container, selectedItems, onItemClick) {
  container.innerHTML = '';
  inventory.forEach(name => {
    const data = ITEMS[name];
    if (!data) return;

    const card = document.createElement('div');
    card.className = 'item-card';
    if (selectedItems.includes(name)) card.classList.add('selected');
    card.dataset.item = name;
    card.innerHTML = `
      <div class="item-emoji">${data.emoji}</div>
      <div class="item-name">${name}</div>
    `;

    if (onItemClick) {
      card.addEventListener('click', () => onItemClick(name));
      // Enable as drag source
      card.draggable = true;
      card.addEventListener('dragstart', e => {
        e.dataTransfer.setData('text/plain', name);
        card.classList.add('dragging');
      });
      card.addEventListener('dragend', () => card.classList.remove('dragging'));
    }

    container.appendChild(card);
  });
}

// Show a temporary feedback message (auto-hides after 2s)
// type: 'success' | 'error' | 'warn' | 'info'
function showFeedback(el, message, type = 'info') {
  el.textContent = message;
  el.className = `feedback ${type} visible`;
  clearTimeout(el._fbTimer);
  el._fbTimer = setTimeout(() => el.classList.remove('visible'), 2000);
}

// Update the target display card
function updateTargetDisplay(targetEl, name) {
  if (!name) {
    targetEl.innerHTML = '<span class="target-placeholder">???</span>';
    return;
  }
  const data = ITEMS[name];
  targetEl.innerHTML = `
    <span class="target-emoji">${data.emoji}</span>
    <span class="target-name">${name}</span>
  `;
}

// Format seconds → "m:ss"
function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// Update timer element; adds 'danger' class when ≤10s remaining
function updateTimerDisplay(timerEl, seconds, isCountdown = false) {
  timerEl.textContent = formatTime(seconds);
  if (isCountdown) {
    timerEl.classList.toggle('danger', seconds <= 10);
  } else {
    timerEl.classList.remove('danger');
  }
}

// Show win/lose/pve-complete overlay with rich result display
// result: 'win' | 'lose' | 'stage-clear' | 'pve-complete' | 'timeout'
function showOverlay(overlay, result, data = {}) {
  const titleEl    = overlay.querySelector('.overlay-title');
  const itemDispEl = overlay.querySelector('.overlay-item-display');
  const statsEl    = overlay.querySelector('.overlay-stats');
  const msgEl      = overlay.querySelector('.overlay-message');
  const btnEl      = overlay.querySelector('.overlay-btn');

  const itemData = ITEMS[data.target] || {};
  const emoji    = itemData.emoji || '✨';

  const scoreTag = data.stageScore != null
    ? ` · +${data.stageScore}pts (total: ${data.totalScore})`
    : '';
  const configs = {
    'win':          { cls: 'win',   title: '🏆 YOU WIN!',              stats: data.score ? `⏱ ${data.time} · 🏅 ${data.score} pts` : `⏱ ${data.time}`, msg: `You crafted ${data.target} first!` },
    'lose':         { cls: 'lose',  title: '🤖 BOT WINS',              stats: `⏱ ${data.time}`,                                       msg: `Bot crafted ${data.target} first. Try again!` },
    'stage-clear':  { cls: 'stage', title: `✅ Stage ${data.stage} Clear!`, stats: `⏱ ${data.timeLeft}s left${scoreTag}`,             msg: `Ready for the next stage?` },
    'pve-complete': { cls: 'win',   title: '🎉 ALL CLEAR!',            stats: `${data.totalStages} stages · 🏅 ${data.totalScore} pts`, msg: `You conquered all stages!` },
    'timeout':      { cls: 'lose',  title: '⏰ TIME\'S UP!',           stats: `Target: ${data.target}`,                               msg: `Couldn't craft it in time. Try again!` },
    'fc-timeout':   { cls: 'win',   title: '⏰ Time\'s Up!',           stats: `✨ ${data.discovered} new items discovered`,            msg: `Not bad! Try again to discover more.` },
  };

  const cfg = configs[result] || configs['win'];
  overlay.className         = `overlay ${cfg.cls}`;
  titleEl.textContent       = cfg.title;
  msgEl.textContent         = cfg.msg;
  statsEl.textContent       = cfg.stats || '';
  // Big item emoji display — hidden for pve-complete
  itemDispEl.textContent    = data.target ? emoji : '';
  itemDispEl.title          = data.target || '';

  // Update button label per result type
  if (btnEl) {
    btnEl.style.display = '';
    btnEl.textContent = result === 'stage-clear' ? 'NEXT STAGE ▶' : 'PLAY AGAIN';
  }

  // Show solution path — skip for stage-clear (already know) and pve-complete
  const solutionEl = overlay.querySelector('.overlay-solution');
  if (solutionEl) {
    const steps = (result !== 'pve-complete') ? (SOLUTIONS[data.target] || []) : [];
    if (steps.length > 0) {
      solutionEl.innerHTML = steps.map(([a, b, res]) => {
        const ea = ITEMS[a]?.emoji || '';
        const eb = ITEMS[b]?.emoji || '';
        const er = ITEMS[res]?.emoji || '';
        return `<div class="solution-step">${ea}<b>${a}</b> + ${eb}<b>${b}</b> → ${er}<b>${res}</b></div>`;
      }).join('');
      solutionEl.style.display = '';
    } else {
      solutionEl.innerHTML = '';
      solutionEl.style.display = 'none';
    }
  }
}

// Hide overlay
function hideOverlay(overlay) {
  overlay.className = 'overlay hidden';
}
