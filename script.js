const MODES = {
  focus: { secs: 20 * 60, label: 'Focus Session', color: '#e8a945', glow: 'rgba(232,169,69,0.15)' },
  short: { secs: 5 * 60,  label: 'Short Break',   color: '#6bbf9e', glow: 'rgba(107,191,158,0.15)' },
  long:  { secs: 15 * 60, label: 'Long Break',    color: '#7ba7d4', glow: 'rgba(123,167,212,0.15)' },
};

let currentMode = 'focus';
let totalSecs = MODES.focus.secs;
let remainSecs = totalSecs;
let running = false;
let interval = null;
let sessionsCompleted = 0;
const CIRCUMFERENCE = 2 * Math.PI * 128; // 804.25

const display  = document.getElementById('timerDisplay');
const label    = document.getElementById('timerLabel');
const ring     = document.getElementById('ringProgress');
const ringSvg  = document.getElementById('ringSvg');
const mainBtn  = document.getElementById('mainBtn');
const flash    = document.getElementById('flash');
const toast    = document.getElementById('toast');
const editHint = document.getElementById('editHint');

function fmt(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}

function setRingColor(color) {
  ring.style.stroke = color;
  document.querySelector('.btn-main:not(.running)') && (mainBtn.style.background = color);
  document.documentElement.style.setProperty('--accent', color);
  document.documentElement.style.setProperty('--glow', MODES[currentMode].glow);
}

function updateRing() {
  const pct = remainSecs / totalSecs;
  const offset = CIRCUMFERENCE * (1 - pct);
  ring.style.strokeDashoffset = offset;
}

function setMode(mode) {
  if (running) return;
  currentMode = mode;
  const cfg = MODES[mode];
  totalSecs = cfg.secs;
  remainSecs = cfg.secs;
  label.textContent = cfg.label;
  display.textContent = fmt(remainSecs);
  setRingColor(cfg.color);
  updateRing();

  document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`[data-mode="${mode}"]`).classList.add('active');
  mainBtn.textContent = 'Start';
  mainBtn.classList.remove('running');
  ringSvg.classList.remove('running');
}

function toggleTimer() {
  if (running) {
    pause();
  } else {
    start();
  }
}

const logoEl = document.querySelector('.logo');

function updateLogo(running) {
  const task = document.getElementById('taskInput').value.trim();
  if (running && task) {
    logoEl.textContent = '▸ ' + task;
    logoEl.classList.add('task-mode');
  } else {
    logoEl.textContent = 'FocusFlow';
    logoEl.classList.remove('task-mode');
  }
}

function start() {
  running = true;
  mainBtn.textContent = 'Pause';
  mainBtn.classList.add('running');
  ringSvg.classList.add('running');
  editHint.style.opacity = '0';
  updateLogo(true);

  interval = setInterval(() => {
    remainSecs--;
    display.textContent = fmt(remainSecs);
    updateRing();
    document.title = `${fmt(remainSecs)} — FocusFlow`;

    if (remainSecs <= 0) {
      clearInterval(interval);
      running = false;
      onComplete();
    }
  }, 1000);
}

function pause() {
  clearInterval(interval);
  running = false;
  mainBtn.textContent = 'Resume';
  mainBtn.classList.remove('running');
  ringSvg.classList.remove('running');
  editHint.style.opacity = '0.6';
  updateLogo(false);
}

function resetTimer() {
  clearInterval(interval);
  running = false;
  remainSecs = totalSecs;
  display.textContent = fmt(remainSecs);
  updateRing();
  mainBtn.textContent = 'Start';
  mainBtn.classList.remove('running');
  ringSvg.classList.remove('running');
  document.title = 'FocusFlow — Deep Work Timer';
  editHint.style.opacity = '0.6';
  updateLogo(false);
}

function skipSession() {
  clearInterval(interval);
  running = false;
  onComplete(true);
}

function onComplete(skipped = false) {
  ringSvg.classList.remove('running');
  mainBtn.classList.remove('running');

  if (currentMode === 'focus') {
    sessionsCompleted = Math.min(sessionsCompleted + 1, 4);
    updateDots();

    // Flash & notify
    flash.classList.remove('ping');
    void flash.offsetWidth;
    flash.classList.add('ping');

    showToast(skipped ? '⏭ Session skipped' : '🎯 Focus complete! Time for a break.');

    // Auto-switch to break
    setTimeout(() => {
      setMode(sessionsCompleted >= 4 ? 'long' : 'short');
      if (sessionsCompleted >= 4) sessionsCompleted = 0, updateDots();
    }, 1200);

    // Play beep
    if (!skipped) playBeep();

  } else {
    showToast('☀️ Break over. Ready to focus?');
    setTimeout(() => setMode('focus'), 1000);
    if (!skipped) playBeep(300, 0.5);
  }

  document.title = 'FocusFlow — Done!';
}

function updateDots() {
  for (let i = 0; i < 4; i++) {
    const dot = document.getElementById(`dot${i}`);
    dot.classList.toggle('done', i < sessionsCompleted);
  }
  document.getElementById('sessionLabel').textContent = `${sessionsCompleted} / 4 sessions`;
}

function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3500);
}

function playBeep(freq = 528, vol = 0.7) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const master = ctx.createGain();
    master.gain.setValueAtTime(vol, ctx.currentTime);
    master.connect(ctx.destination);

    [[0, freq, 'sine', 1.0], [0.35, freq * 1.5, 'sine', 0.8], [0.7, freq * 2, 'sine', 0.6]].forEach(([t, f, type, relVol]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(master);
      osc.frequency.value = f;
      osc.type = type;
      gain.gain.setValueAtTime(relVol, ctx.currentTime + t);
      gain.gain.setValueAtTime(relVol, ctx.currentTime + t + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.6);
      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + 0.65);
    });
  } catch(e) {}
}

// Click to edit time
display.addEventListener('click', () => {
  if (running) return;
  const orig = display.textContent;
  display.contentEditable = 'true';
  display.classList.add('editing');
  display.focus();

  const sel = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(display);
  sel.removeAllRanges();
  sel.addRange(range);

  function commit() {
    display.contentEditable = 'false';
    display.classList.remove('editing');
    const val = display.textContent.trim();
    const match = val.match(/^(\d{1,3}):(\d{2})$/);
    if (match) {
      const m = parseInt(match[1]);
      const s = parseInt(match[2]);
      if (m >= 0 && s < 60 && (m > 0 || s > 0)) {
        totalSecs = m * 60 + s;
        remainSecs = totalSecs;
        updateRing();
        return;
      }
    }
    display.textContent = orig;
  }

  display.onblur = commit;
  display.onkeydown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); display.blur(); }
    if (e.key === 'Escape') { display.textContent = orig; display.blur(); }
  };
});

// Init
ring.style.strokeDasharray = CIRCUMFERENCE;
ring.style.strokeDashoffset = 0;
