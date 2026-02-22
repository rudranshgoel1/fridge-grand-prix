/* ═══════════════════════════════════════════════════════
   FRIDGE GRAND PRIX — game.js
   Betting system + Race engine
═══════════════════════════════════════════════════════ */

'use strict';

// ─── TEAMS ────────────────────────────────────────────
const TEAMS = [
  {
    id: 0,
    name: 'OCTO SPEEDSTER',
    sub: '8-Armed Drifter',
    emoji: '🐙',
    color: '#b44dff',
    bodyColor: '#8833cc',
    odds: 2.0,
    oddsClass: 'odds-safe',
    oddsLabel: '×2.0',
    speed: 5.2,
    accel: 0.18,
    consistency: 0.88,
  },
  {
    id: 1,
    name: 'LAVA LAMP FC',
    sub: 'Slow But Glowing',
    emoji: '🫧',
    color: '#ff6622',
    bodyColor: '#cc4400',
    odds: 2.5,
    oddsClass: 'odds-safe',
    oddsLabel: '×2.5',
    speed: 4.8,
    accel: 0.14,
    consistency: 0.82,
  },
  {
    id: 2,
    name: 'PENGUIN EXPRESS',
    sub: 'Cold-Blooded Racer',
    emoji: '🐧',
    color: '#22aaff',
    bodyColor: '#1177cc',
    odds: 3.2,
    oddsClass: 'odds-mid',
    oddsLabel: '×3.2',
    speed: 5.5,
    accel: 0.22,
    consistency: 0.72,
  },
  {
    id: 3,
    name: 'CHEESE WEDGE',
    sub: 'Unpredictably Slippery',
    emoji: '🧀',
    color: '#ffcc00',
    bodyColor: '#cc9900',
    odds: 4.5,
    oddsClass: 'odds-mid',
    oddsLabel: '×4.5',
    speed: 5.0,
    accel: 0.16,
    consistency: 0.55,
  },
  {
    id: 4,
    name: 'HOT SAUCE DEVIL',
    sub: 'High Risk, High Reward',
    emoji: '🌶️',
    color: '#ff2244',
    bodyColor: '#bb0022',
    odds: 7.0,
    oddsClass: 'odds-high',
    oddsLabel: '×7.0',
    speed: 6.5,
    accel: 0.30,
    consistency: 0.40,
  },
  {
    id: 5,
    name: 'FROZEN BURRITO',
    sub: 'Dark Horse of the Ice',
    emoji: '🌯',
    color: '#44ffaa',
    bodyColor: '#22cc77',
    odds: 10.0,
    oddsClass: 'odds-wild',
    oddsLabel: '×10.0',
    speed: 6.0,
    accel: 0.28,
    consistency: 0.30,
  },
];

// ─── STATE ────────────────────────────────────────────
let state = {
  balance:      1000,
  startBalance: 1000,
  racesPlaced:  0,
  bestWin:      0,
  selectedTeam: null,
  betAmount:    100,
  racing:       false,
  racers:       [],
  placeCounter: 1,
  animFrame:    null,
  raceFinished: false,
};

// ─── CANVAS ───────────────────────────────────────────
const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');
const W      = canvas.width;
const H      = canvas.height;
// NOTE: getLaneW() must be computed dynamically — TEAMS grows when fish unlocks
const FINISH_Y = 55;
const START_Y  = H - 90;

// Always call this instead of the const — returns current lane width
function getLaneW() { return W / TEAMS.length; }

// ─── INIT ─────────────────────────────────────────────
function init() {
  buildTeamsUI();
  bindSlider();
  bindQuickBets();
  document.getElementById('start-btn').addEventListener('click', startRace);
  document.getElementById('race-btn').addEventListener('click', startRace);
  document.getElementById('clear-log-btn').addEventListener('click', clearLog);
  updateHUD();
  updateRaceBtn();
  drawIdleCanvas();
  refreshBetDisplay();
}

// ─── BUILD TEAMS UI ───────────────────────────────────
function buildTeamsUI() {
  const list = document.getElementById('teams-list');
  list.innerHTML = '';
  TEAMS.forEach(t => {
    const el = document.createElement('div');
    el.className = 'team-card';
    el.id = 'tc-' + t.id;
    el.addEventListener('click', () => selectTeam(t.id));
    el.innerHTML = `
      <span class="team-emoji">${t.emoji}</span>
      <div class="team-info">
        <div class="team-name">${t.name}</div>
        <div class="team-sub">${t.sub}</div>
      </div>
      <span class="team-odds ${t.oddsClass}">${t.oddsLabel}</span>
    `;
    list.appendChild(el);
  });
}

function selectTeam(id) {
  if (state.racing) return;
  state.selectedTeam = id;
  document.querySelectorAll('.team-card').forEach(c => c.classList.remove('selected'));
  document.getElementById('tc-' + id).classList.add('selected');
  updateRaceBtn();
  updatePotentialReturn();
  addLog(`Backing ${TEAMS[id].emoji} <strong>${TEAMS[id].name}</strong> — odds ${TEAMS[id].oddsLabel}`, 'info');
}

// ─── BET SLIDER ───────────────────────────────────────
function bindSlider() {
  const slider = document.getElementById('bet-slider');
  slider.addEventListener('input', () => {
    state.betAmount = parseInt(slider.value);
    refreshBetDisplay();
  });
}

function bindQuickBets() {
  document.querySelectorAll('.btn-quick').forEach(btn => {
    btn.addEventListener('click', () => {
      const pct = parseFloat(btn.dataset.pct);
      state.betAmount = Math.max(10, Math.min(
        Math.floor(state.balance * pct / 10) * 10,
        state.balance
      ));
      syncSlider();
      refreshBetDisplay();
    });
  });
}

function syncSlider() {
  const slider = document.getElementById('bet-slider');
  slider.max   = Math.max(state.balance, 10);
  slider.value = state.betAmount;
}

function _refreshBetDisplayCore() {
  document.getElementById('bet-display').textContent = fmtNum(state.betAmount);
  document.getElementById('bet-balance-note').textContent = `of ${fmtNum(state.balance)} available`;
  updatePotentialReturn();
  updateRaceBtn();
}

function updatePotentialReturn() {
  const el = document.getElementById('potential-return');
  if (state.selectedTeam === null) {
    el.textContent = 'Select a team to see potential payout';
    el.classList.remove('has-value');
    return;
  }
  const odds   = TEAMS[state.selectedTeam].odds;
  const payout = Math.floor(state.betAmount * odds);
  const profit = payout - state.betAmount;
  el.textContent = `Potential return: ${fmtNum(payout)} (+${fmtNum(profit)})`;
  el.classList.add('has-value');
}

// ─── HUD ──────────────────────────────────────────────
function updateHUD() {
  document.getElementById('balance-display').textContent = fmtNum(state.balance);

  const pnl = state.balance - state.startBalance;
  const pnlEl = document.getElementById('pnl-display');
  pnlEl.textContent = (pnl >= 0 ? '+' : '-') + fmtNum(Math.abs(pnl));
  pnlEl.className   = 'stat-value ' + (pnl > 0 ? 'up' : pnl < 0 ? 'down' : '');

  document.getElementById('races-display').textContent = state.racesPlayed || 0;
  document.getElementById('best-display').textContent  = fmtNum(state.bestWin);

  document.getElementById('bet-balance-note').textContent = `of ${fmtNum(state.balance)} available`;
}

function updateRaceBtn() {
  const ok = state.selectedTeam !== null
    && state.betAmount >= 10
    && state.balance >= state.betAmount
    && !state.racing;

  document.getElementById('race-btn').disabled = !ok;
  document.getElementById('start-btn').disabled = !ok;
  document.getElementById('start-btn').textContent =
    ok                         ? '🏁  RACE NOW'          :
    state.selectedTeam === null ? 'SELECT A TEAM FIRST'  :
                                  'NOT ENOUGH BALANCE';
}

// ─── START RACE ───────────────────────────────────────
function startRace() {
  if (state.racing || state.selectedTeam === null) return;
  if (state.betAmount < 10 || state.balance < state.betAmount) return;

  state.racing      = true;
  state.raceFinished = false;
  state.placeCounter = 1;
  state.balance    -= state.betAmount;
  if (!state.racesPlayed) state.racesPlayed = 0;
  state.racesPlayed++;

  updateHUD();
  updateRaceBtn();
  syncSlider();

  // Hide overlay
  document.getElementById('race-overlay').classList.add('hidden');
  document.getElementById('live-dot').classList.add('live');

  // Init racers
  state.racers = TEAMS.map((t, i) => ({
    ...t,
    lane:      i,
    x:         getLaneW() * i + getLaneW() / 2,
    y:         START_Y,
    vel:       0,
    wobble:    0,
    wobblePhase: Math.random() * Math.PI * 2,
    finished:  false,
    place:     0,
    boostTimer: 0,
    stumbleTimer: 0,
    trail:     [],
  }));

  addLog(`🏁 RACE ${state.racesPlayed} — ${fmtNum(state.betAmount)} on ${TEAMS[state.selectedTeam].emoji} ${TEAMS[state.selectedTeam].name}`, 'info');
  clearStandings();
  requestAnimationFrame(raceLoop);
}

// ─── RACE LOOP ────────────────────────────────────────
function raceLoop() {
  if (state.raceFinished) return;

  ctx.clearRect(0, 0, W, H);
  drawBackground();
  drawFinishLine();

  let allDone = true;

  state.racers.forEach(r => {
    if (!r.finished) {
      allDone = false;
      updateRacer(r);
    }
    drawTrail(r);
    drawCar(r);
  });

  updateStandingsBar();

  if (!allDone) {
    state.animFrame = requestAnimationFrame(raceLoop);
  } else {
    state.raceFinished = true;
    state.racing = false;
    document.getElementById('live-dot').classList.remove('live');
    setTimeout(showResult, 700);
  }
}

function updateRacer(r) {
  // Random events
  if (r.stumbleTimer <= 0 && Math.random() < 0.004) {
    r.stumbleTimer = 28 + Math.floor(Math.random() * 20);
  }
  if (r.boostTimer <= 0 && Math.random() < 0.003) {
    r.boostTimer = 35 + Math.floor(Math.random() * 20);
  }

  if (r.stumbleTimer > 0) {
    r.stumbleTimer--;
    r.vel = Math.max(r.vel - 0.12, 0.2);
  } else {
    const noise  = (Math.random() - 0.48) * (1.6 - r.consistency);
    const boost  = r.boostTimer > 0 ? 1.8 : 0;
    if (r.boostTimer > 0) r.boostTimer--;
    r.vel += r.accel + noise * 0.5 + boost * 0.12;
    r.vel  = Math.min(r.vel, r.speed + boost);
    r.vel  = Math.max(r.vel, 0.1);
  }

  r.wobblePhase += 0.09 + Math.random() * 0.02;
  r.wobble = Math.sin(r.wobblePhase) * 4;

  r.y -= r.vel * 0.48;

  // Trail
  r.trail.push({ x: r.x + r.wobble, y: r.y, alpha: 1 });
  if (r.trail.length > 22) r.trail.shift();

  if (r.y <= FINISH_Y) {
    r.y = FINISH_Y;
    r.finished = true;
    r.place = state.placeCounter++;
  }
}

// ─── DRAWING ──────────────────────────────────────────
function drawBackground() {
  // Main fill
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#071510');
  bg.addColorStop(1, '#0c2218');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Lane fills
  state.racers.forEach((r, i) => {
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.012)' : 'rgba(0,0,0,0.04)';
    ctx.fillRect(getLaneW() * i, 0, getLaneW(), H);
  });

  // Lane dividers
  ctx.save();
  ctx.strokeStyle = 'rgba(80,160,100,0.18)';
  ctx.lineWidth = 1;
  ctx.setLineDash([12, 16]);
  for (let i = 1; i < TEAMS.length; i++) {
    ctx.beginPath();
    ctx.moveTo(getLaneW() * i, FINISH_Y + 20);
    ctx.lineTo(getLaneW() * i, H);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.restore();

  // START line
  const sq = getLaneW();
  for (let i = 0; i < TEAMS.length; i++) {
    ctx.fillStyle = i % 2 === 0
      ? 'rgba(255,255,255,0.06)'
      : 'rgba(0,0,0,0.08)';
    ctx.fillRect(getLaneW() * i, START_Y + 50, getLaneW(), 8);
  }
}

function drawFinishLine() {
  // Glow strip behind finish line
  const glow = ctx.createLinearGradient(0, FINISH_Y - 6, 0, FINISH_Y + 22);
  glow.addColorStop(0, 'rgba(232,196,74,0)');
  glow.addColorStop(0.4, 'rgba(232,196,74,0.1)');
  glow.addColorStop(1, 'rgba(232,196,74,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, FINISH_Y - 6, W, 30);

  // Checker pattern
  const sq = 12;
  for (let x = 0; x < W; x += sq) {
    const col = Math.floor(x / sq) % 2;
    ctx.fillStyle = col === 0 ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.85)';
    ctx.fillRect(x, FINISH_Y, sq, sq);
  }

  // "FINISH" label
  ctx.fillStyle = 'rgba(232,196,74,0.85)';
  ctx.font = '500 9px IBM Plex Mono';
  ctx.textAlign = 'left';
  ctx.fillText('FINISH', 6, FINISH_Y - 5);
}

function drawTrail(r) {
  if (r.trail.length < 2) return;
  for (let i = 1; i < r.trail.length; i++) {
    const alpha = (i / r.trail.length) * 0.35;
    ctx.strokeStyle = r.color + Math.round(alpha * 255).toString(16).padStart(2, '0');
    ctx.lineWidth   = 2 + (i / r.trail.length) * 3;
    ctx.beginPath();
    ctx.moveTo(r.trail[i - 1].x, r.trail[i - 1].y);
    ctx.lineTo(r.trail[i].x,     r.trail[i].y);
    ctx.stroke();
  }
}

function drawCar(r) {
  const cx = r.x + r.wobble;
  const cy = r.y;
  const isPlayer  = r.id === state.selectedTeam;
  const isBoosting = r.boostTimer > 0;
  const isStumble  = r.stumbleTimer > 0;

  ctx.save();
  ctx.translate(cx, cy);

  // Glow for selected or boosting
  if (isPlayer) {
    ctx.shadowColor = '#e8c44a';
    ctx.shadowBlur  = 18;
  } else if (isBoosting) {
    ctx.shadowColor = r.color;
    ctx.shadowBlur  = 14;
  }

  // CAR BODY
  ctx.fillStyle = r.bodyColor;
  ctx.beginPath();
  ctx.roundRect(-16, -22, 32, 44, 6);
  ctx.fill();

  // HOOD HIGHLIGHT
  ctx.fillStyle = r.color;
  ctx.beginPath();
  ctx.roundRect(-12, -22, 24, 18, [6, 6, 0, 0]);
  ctx.fill();

  // WINDSHIELD
  ctx.fillStyle = 'rgba(160,230,255,0.45)';
  ctx.beginPath();
  ctx.roundRect(-9, -18, 18, 12, 3);
  ctx.fill();

  // WHEELS — 4 corners
  ctx.fillStyle = '#0e1a14';
  [[-20, -14], [-20, 10], [20, -14], [20, 10]].forEach(([wx, wy]) => {
    ctx.beginPath();
    ctx.ellipse(wx, wy, 5, 6.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Rim
    ctx.strokeStyle = r.color + '66';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(wx, wy, 2.5, 3.5, 0, 0, Math.PI * 2);
    ctx.stroke();
  });

  ctx.shadowBlur = 0;

  // EMOJI DRIVER
  ctx.font = '12px serif';
  ctx.textAlign = 'center';
  ctx.fillText(r.emoji, 0, 7);

  // BOOST FLAME
  if (isBoosting) {
    ctx.font = '11px serif';
    ctx.fillText('⚡', 0, 28);
  }

  // STUMBLE
  if (isStumble) {
    ctx.font = '10px serif';
    ctx.fillText('💥', 0, -32);
  }

  ctx.restore();

  // PLACE BADGE (if finished)
  if (r.finished) {
    const medal = r.place === 1 ? '🥇' : r.place === 2 ? '🥈' : r.place === 3 ? '🥉' : `#${r.place}`;
    ctx.font = '13px serif';
    ctx.textAlign = 'center';
    ctx.fillText(medal, cx, cy - 32);
  }

  // NAME tag
  ctx.fillStyle = isPlayer ? 'rgba(232,196,74,0.85)' : 'rgba(200,220,210,0.45)';
  ctx.font = isPlayer ? 'bold 7.5px IBM Plex Mono' : '7px IBM Plex Mono';
  ctx.textAlign = 'center';
  ctx.fillText(r.name.split(' ')[0], cx, cy + 36);
}

// ─── STANDINGS BAR ────────────────────────────────────
function updateStandingsBar() {
  const sorted = [...state.racers]
    .sort((a, b) => {
      if (a.finished && b.finished) return a.place - b.place;
      if (a.finished) return -1;
      if (b.finished) return  1;
      return a.y - b.y;
    });

  const list = document.getElementById('standings-list');
  list.innerHTML = '';

  sorted.forEach((r, idx) => {
    const chip = document.createElement('span');
    chip.className = 'pos-chip' +
      (r.id === state.selectedTeam ? ' is-player' : '') +
      (idx === 0 ? ' pos-1' : '');
    const pos = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`;
    chip.textContent = `${pos} ${r.emoji} ${r.name.split(' ')[0]}`;
    list.appendChild(chip);
  });
}

function clearStandings() {
  document.getElementById('standings-list').innerHTML =
    '<span class="standings-placeholder">race in progress...</span>';
}

// ─── RESULT ───────────────────────────────────────────
function _showResultCore() {
  const winner   = state.racers.find(r => r.place === 1);
  const userTeam = state.racers.find(r => r.id === state.selectedTeam);
  const won      = winner.id === state.selectedTeam;

  if (won) {
    const payout = Math.floor(state.betAmount * TEAMS[state.selectedTeam].odds);
    const profit = payout - state.betAmount;
    state.balance += payout;
    state.bestWin  = Math.max(state.bestWin, profit);
    showResultModal(true, winner, userTeam, profit, payout);
    addLog(`🏆 WIN — ${winner.emoji} ${winner.name} 1st. Profit: <strong>+${fmtNum(profit)}</strong>`, 'win');
  } else {
    showResultModal(false, winner, userTeam, -state.betAmount, 0);
    addLog(`❌ LOSS — ${winner.emoji} ${winner.name} won. Lost <strong>${fmtNum(state.betAmount)}</strong>`, 'lose');
  }

  updateHUD();
  syncSlider();
  refreshBetDisplay();
  updateRaceBtn();

  // Check end states after modal delay
  setTimeout(() => {
    if      (state.balance < 10)        triggerSpecial('bankrupt');
    else if (state.balance >= 1_000_000) triggerSpecial('millionaire');
  }, 600);
}

function showResultModal(won, winner, userTeam, netChange, payout) {
  document.getElementById('result-icon').textContent    = won ? '🏆' : '💸';
  document.getElementById('result-title').textContent   = won ? 'YOU WON!' : 'BETTER LUCK NEXT TIME';

  const amountEl = document.getElementById('result-amount');
  amountEl.textContent  = (won ? '+' : '') + fmtNum(Math.abs(netChange));
  amountEl.className    = 'result-amount ' + (won ? 'win' : 'lose');

  document.getElementById('result-desc').textContent = won
    ? `${winner.emoji} ${winner.name} crossed the finish line first. Payout: ${fmtNum(payout)}.`
    : `${winner.emoji} ${winner.name} took 1st place. Your ${TEAMS[state.selectedTeam].emoji} finished ${userTeam.place}${ordinal(userTeam.place)}.`;

  // Meta stats
  const meta = document.getElementById('result-meta');
  meta.innerHTML = `
    <div class="result-meta-item">
      <span class="result-meta-label">Your bet</span>
      <span class="result-meta-value">${fmtNum(state.betAmount)}</span>
    </div>
    <div class="result-meta-item">
      <span class="result-meta-label">Odds</span>
      <span class="result-meta-value">${TEAMS[state.selectedTeam].oddsLabel}</span>
    </div>
    <div class="result-meta-item">
      <span class="result-meta-label">New balance</span>
      <span class="result-meta-value">${fmtNum(state.balance)}</span>
    </div>
  `;

  document.getElementById('result-backdrop').classList.add('show');
}

function closeResult() {
  document.getElementById('result-backdrop').classList.remove('show');
  document.getElementById('race-overlay').classList.remove('hidden');
  updateRaceBtn();
}

// ─── SPECIAL SCREENS ──────────────────────────────────
function triggerSpecial(type) {
  const ss = document.getElementById('special-screen');
  ss.className = 'special-screen show ' + type;

  if (type === 'bankrupt') {
    document.getElementById('special-emoji').textContent = '🫙';
    document.getElementById('special-title').textContent = 'BANKRUPT!';
    document.getElementById('special-desc').textContent  =
      "The fridge has swallowed your last dollar. The octopuses are laughing. The lava lamps are glowing smugly. Ready to rebuild?";
  } else {
    document.getElementById('special-emoji').textContent = '🤑';
    document.getElementById('special-title').textContent = 'MILLIONAIRE!';
    document.getElementById('special-desc').textContent  =
      `You turned ${fmtNum(state.startBalance)} into ${fmtNum(state.balance)} betting on octopuses and lava lamps inside a fridge. A legend is born.`;
    launchConfetti();
  }

  document.getElementById('special-stats').innerHTML = `
    <div class="special-stat">
      <span class="special-stat-label">Final balance</span>
      <span class="special-stat-value">${fmtNum(state.balance)}</span>
    </div>
    <div class="special-stat">
      <span class="special-stat-label">Races played</span>
      <span class="special-stat-value">${state.racesPlayed || 0}</span>
    </div>
    <div class="special-stat">
      <span class="special-stat-label">Best single win</span>
      <span class="special-stat-value">${fmtNum(state.bestWin)}</span>
    </div>
  `;
}

function launchConfetti() {
  const colors = ['#e8c44a', '#4dffc3', '#ff6b35', '#2dff7a', '#ff3d5a', '#b44dff', '#22aaff'];
  for (let i = 0; i < 90; i++) {
    const el = document.createElement('div');
    el.className = 'confetti';
    el.style.cssText = `
      left: ${Math.random() * 100}vw;
      top: -30px;
      width: ${5 + Math.random() * 10}px;
      height: ${5 + Math.random() * 10}px;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      animation-duration: ${1.8 + Math.random() * 2.5}s;
      animation-delay: ${Math.random() * 1.8}s;
      border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
    `;
    document.body.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
  }
}

// ─── RESET ────────────────────────────────────────────
function resetGame() {
  // Cancel any running animation
  if (state.animFrame) cancelAnimationFrame(state.animFrame);

  state = {
    balance:      1000,
    startBalance: 1000,
    racesPlaced:  0,
    racesPlayed:  0,
    bestWin:      0,
    selectedTeam: null,
    betAmount:    100,
    racing:       false,
    racers:       [],
    placeCounter: 1,
    animFrame:    null,
    raceFinished: false,
  };

  document.getElementById('special-screen').className     = 'special-screen';
  document.getElementById('result-backdrop').classList.remove('show');
  document.getElementById('race-overlay').classList.remove('hidden');
  document.getElementById('live-dot').classList.remove('live');
  document.querySelectorAll('.team-card').forEach(c => c.classList.remove('selected'));
  document.getElementById('log-list').innerHTML =
    '<li class="log-entry log-info">Fresh start. 1,000 Schmeckles in the bank. Time to bet wisely.</li>';

  syncSlider();
  updateHUD();
  refreshBetDisplay();
  updateRaceBtn();
  clearStandings();
  drawIdleCanvas();
}

// ─── IDLE CANVAS ──────────────────────────────────────
function drawIdleCanvas() {
  ctx.clearRect(0, 0, W, H);

  // Bg
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#071510');
  bg.addColorStop(1, '#0c2218');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Lane columns
  TEAMS.forEach((t, i) => {
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.012)' : 'rgba(0,0,0,0.04)';
    ctx.fillRect(getLaneW() * i, 0, getLaneW(), H);
  });

  // Draw parked cars on start line
  TEAMS.forEach((t, i) => {
    const cx = getLaneW() * i + getLaneW() / 2;
    const cy = START_Y;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.globalAlpha = 0.65;

    ctx.fillStyle = t.bodyColor;
    ctx.beginPath();
    ctx.roundRect(-16, -22, 32, 44, 6);
    ctx.fill();

    ctx.fillStyle = t.color;
    ctx.beginPath();
    ctx.roundRect(-12, -22, 24, 18, [6, 6, 0, 0]);
    ctx.fill();

    ctx.fillStyle = 'rgba(160,230,255,0.4)';
    ctx.beginPath();
    ctx.roundRect(-9, -18, 18, 12, 3);
    ctx.fill();

    ctx.fillStyle = '#0e1a14';
    [[-20, -14], [-20, 10], [20, -14], [20, 10]].forEach(([wx, wy]) => {
      ctx.beginPath();
      ctx.ellipse(wx, wy, 5, 6.5, 0, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.font = '12px serif';
    ctx.textAlign = 'center';
    ctx.globalAlpha = 0.8;
    ctx.fillText(t.emoji, 0, 7);

    ctx.restore();

    // Name
    ctx.fillStyle = 'rgba(200,220,210,0.35)';
    ctx.font = '7px PT Sans';
    ctx.textAlign = 'center';
    ctx.globalAlpha = 1;
    ctx.fillText(t.name.split(' ')[0], cx, cy + 36);
  });

  // Finish line
  const sq = 12;
  for (let x = 0; x < W; x += sq) {
    const col = Math.floor(x / sq) % 2;
    ctx.fillStyle = col === 0 ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)';
    ctx.fillRect(x, FINISH_Y, sq, sq);
  }
}

// ─── LOG ──────────────────────────────────────────────
function addLog(msg, type = 'info') {
  const list = document.getElementById('log-list');
  const li   = document.createElement('li');
  li.className = `log-entry log-${type}`;
  li.innerHTML = msg;
  list.prepend(li);
  while (list.children.length > 40) list.removeChild(list.lastChild);
}

function clearLog() {
  document.getElementById('log-list').innerHTML =
    '<li class="log-entry log-info">Log cleared.</li>';
}

// ─── UTILS ────────────────────────────────────────────
function fmtNum(n) {
  return Math.abs(Math.round(n)).toLocaleString('en-US') + ' Schmeckles';
}

function ordinal(n) {
  return n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th';
}

// ═══════════════════════════════════════════════════════
//  🥚 EASTER EGGS
// ═══════════════════════════════════════════════════════

// ── 1. KONAMI CODE → unlocks secret racer 🐟 ──────────
const KONAMI = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
let konamiIdx = 0;
let secretUnlocked = false;

document.addEventListener('keydown', (e) => {
  if (e.key === KONAMI[konamiIdx]) {
    konamiIdx++;
    if (konamiIdx === KONAMI.length) {
      konamiIdx = 0;
      if (!secretUnlocked) unlockSecretRacer();
    }
  } else {
    konamiIdx = 0;
  }
});

function unlockSecretRacer() {
  if (secretUnlocked) return;
  secretUnlocked = true;

  TEAMS.push({
    id: 6,
    name: 'MYSTERY FISH',
    sub: '??? do not trust',
    emoji: '🐟',
    color: '#00ffff',
    bodyColor: '#007799',
    odds: 50.0,
    oddsClass: 'odds-wild',
    oddsLabel: '×50.0',
    speed: 3.0,
    accel: 0.08,
    consistency: 0.10,
  });

  buildTeamsUI();

  const logo = document.querySelector('.logo-main');
  logo.style.transition = 'color 0.2s';
  ['#00ffff','#ff00ff','#ffff00','#00ffff','#111111'].forEach((c, i) => {
    setTimeout(() => { logo.style.color = c; }, i * 180);
  });

  addLog('🐟 ??? THE MYSTERY FISH HAS ENTERED THE FRIDGE. ×50 odds. Godspeed.', 'win');
  showToast('🐟 SECRET RACER UNLOCKED', 'You found the Konami Code. The Mystery Fish is now racing.');
}

// ── 2. CLICK LOGO 5× FAST → pizza mode 🍕 ────────────
let logoClicks = 0;
let logoTimer  = null;
let pizzaMode  = false;
const ORIG_EMOJIS = ['🐙','🫧','🐧','🧀','🌶️','🌯'];

function initLogoEgg() {
  const logo = document.querySelector('.logo-lockup');
  if (!logo) return;
  logo.style.cursor = 'pointer';
  logo.addEventListener('click', () => {
    logoClicks++;
    clearTimeout(logoTimer);
    logoTimer = setTimeout(() => { logoClicks = 0; }, 1200);
    if (logoClicks >= 5) {
      logoClicks = 0;
      togglePizzaMode();
    }
  });
}

function togglePizzaMode() {
  pizzaMode = !pizzaMode;
  TEAMS.forEach((t, i) => {
    if (i < ORIG_EMOJIS.length) t.emoji = pizzaMode ? '🍕' : ORIG_EMOJIS[i];
  });
  buildTeamsUI();

  if (pizzaMode) {
    addLog('🍕🍕🍕 PIZZA MODE ACTIVATED. Every racer is now a pizza. 🍕🍕🍕', 'win');
    showToast('🍕 PIZZA MODE', 'Click the logo 5× again to restore normal racing.');
  } else {
    addLog('Pizza mode deactivated. Everyone is themselves again.', 'info');
  }
}

// ── 3. TYPE "schmeckles" → free 500 + coin rain ───────
let typedBuffer = '';
let schmecklesUsed = false;

document.addEventListener('keypress', (e) => {
  if (state.racing) return;
  typedBuffer += e.key.toLowerCase();
  if (typedBuffer.length > 12) typedBuffer = typedBuffer.slice(-12);
  if (typedBuffer.endsWith('schmeckles')) {
    typedBuffer = '';
    schmecklesRain();
  }
});

function schmecklesRain() {
  if (!schmecklesUsed) {
    schmecklesUsed = true;
    state.balance += 500;
    updateHUD();
    syncSlider();
    refreshBetDisplay();
    addLog('🪄 The ancient word was spoken. 500 bonus Schmeckles materialised from the void.', 'win');
    showToast('🪄 SCHMECKLES!', '+500 Schmeckles. You found a secret. Tell no one.');
  } else {
    addLog('🪄 The void is empty. You already claimed your gift.', 'info');
    showToast('🪄 SCHMECKLES?', 'Free money only works once. Nice try.');
  }

  const symbols = ['Ŝ','💰','Ŝ','🪙','Ŝ','✨'];
  for (let i = 0; i < 45; i++) {
    const el = document.createElement('div');
    el.textContent = symbols[Math.floor(Math.random() * symbols.length)];
    el.style.cssText = `
      position:fixed;left:${Math.random()*100}vw;top:-40px;
      font-size:${14+Math.random()*18}px;
      font-family:'Indie Flower',cursive;color:#b87000;
      pointer-events:none;z-index:9000;
      animation:confetti-fall ${1.5+Math.random()*2}s linear ${Math.random()*1.2}s forwards;
    `;
    document.body.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
  }
}

// ── 4. NICE NUMBERS IN THE BET FIELD ─────────────────
let lastNiceAmount = -1;
function checkNiceNumber(amount) {
  if (amount === lastNiceAmount) return;
  lastNiceAmount = amount;
  if (amount === 69)   setTimeout(() => addLog('😏 69 Schmeckles. Nice.', 'info'), 300);
  if (amount === 420)  setTimeout(() => addLog('🌿 420 Schmeckles. Very chill bet.', 'info'), 300);
  if (amount === 1337) setTimeout(() => addLog('💻 1337 Schmeckles. l33t bet, hacker.', 'info'), 300);
}

// ── 5. WIN STREAK TRACKING ────────────────────────────
let winStreak = 0;

function updateWinStreak(won) {
  if (won) {
    winStreak++;
    if (winStreak === 3)
      setTimeout(() => { addLog('🔥🔥🔥 THREE IN A ROW. You are on FIRE. The fridge trembles.', 'win'); showToast('🔥 HOT STREAK!', '3 wins in a row. The other bettors fear you.'); }, 200);
    else if (winStreak === 5)
      setTimeout(() => { addLog('⚡ FIVE IN A ROW. Are you cheating? The octopus is suspicious.', 'win'); showToast('⚡ LEGENDARY STREAK!', '5 wins straight. Statistically concerning.'); }, 200);
    else if (winStreak === 10)
      setTimeout(() => { addLog('👑 TEN IN A ROW. You have transcended gambling. You ARE the fridge.', 'win'); showToast('👑 YOU ARE THE FRIDGE', '10 wins in a row. We are genuinely confused.'); }, 200);
  } else {
    if (winStreak >= 3) addLog(`💔 Streak of ${winStreak} broken. The fridge wins again.`, 'lose');
    winStreak = 0;
  }
}

// ── 6. THE BURRITO PROPHECY ───────────────────────────
let burritoWins = 0;
function checkBurritoProphecy(winner) {
  if (winner.id === 5) {
    burritoWins++;
    const msgs = [
      '🌯 THE PROPHECY IS FULFILLED. The Frozen Burrito rises from the ice.',
      '🌯 Again?! The Burrito is UNSTOPPABLE.',
      '🌯 Three Burrito wins. A new religion has formed inside the fridge.',
      '🌯 The Burrito wins again. At this point it\'s intentional.',
      '🌯 The Burrito has become the fridge itself.',
    ];
    addLog(msgs[Math.min(burritoWins - 1, msgs.length - 1)], 'win');
  }
  if (secretUnlocked && winner.id === 6) {
    addLog('🐟 THE MYSTERY FISH ACTUALLY WON. ×50. The fridge is no longer safe.', 'win');
    showToast('🐟 ×50!!!', 'The Mystery Fish won. We are as shocked as you.');
  }
}

// ── TOAST ─────────────────────────────────────────────
function showToast(title, body) {
  const existing = document.getElementById('egg-toast');
  if (existing) existing.remove();

  if (!document.getElementById('toast-kf')) {
    const s = document.createElement('style');
    s.id = 'toast-kf';
    s.textContent = `@keyframes toast-in { from { transform:translateY(20px) scale(0.9); opacity:0; } to { transform:translateY(0) scale(1); opacity:1; } }`;
    document.head.appendChild(s);
  }

  const toast = document.createElement('div');
  toast.id = 'egg-toast';
  toast.innerHTML = `<strong>${title}</strong><br/><span style="font-size:0.85em;opacity:0.8">${body}</span>`;
  toast.style.cssText = `
    position:fixed;bottom:28px;right:28px;
    background:var(--ink);color:var(--paper);
    font-family:'Indie Flower',cursive;font-size:1rem;
    padding:14px 18px;border:2px solid #333;border-radius:2px;
    box-shadow:4px 4px 0 rgba(0,0,0,0.5);
    max-width:280px;line-height:1.5;z-index:9999;
    animation:toast-in 0.3s cubic-bezier(0.34,1.56,0.64,1);
  `;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.transition = 'opacity 0.4s, transform 0.4s';
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 400);
  }, 4200);
}

// ── PATCH showResult to wire eggs in ─────────────────
// showResult is defined here; raceLoop calls it by name at race end
function showResult() {
  const winner = state.racers.find(r => r.place === 1);
  const won    = winner.id === state.selectedTeam;
  updateWinStreak(won);
  checkBurritoProphecy(winner);
  _showResultCore();
}

// ── PATCH refreshBetDisplay to check nice numbers ─────
function refreshBetDisplay() {
  _refreshBetDisplayCore();
  checkNiceNumber(state.betAmount);
}

// ─── GO ───────────────────────────────────────────────
init();
// init eggs after DOM is ready
setTimeout(() => { initLogoEgg(); }, 100);