/* tests.js — All 5 test modules for Sinapsis 5 */

/* ============================================================
   UTILS
   ============================================================ */
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/* ============================================================
   TEST 1 — Atención
   ============================================================ */
const T1 = {
  shape: null,
  total: 10,
  current: 0,
  hits: 0,
  timestamps: [],
  shapeTimeout: null,
  areaW: 0,
  areaH: 0,

  init() {
    AppState.tests.atencion = { aciertos: 0, total: 10, reaccionMs: 0, pts: 0, atencion: 0 };
    this.hits = 0;
    this.current = 0;
    this.timestamps = [];
    this.shape = BANK_FORMAS[Math.floor(Math.random() * BANK_FORMAS.length)];

    const area = document.getElementById('t1-area');
    this.areaW = area.clientWidth;
    this.areaH = area.clientHeight;
    area.innerHTML = '';

    document.getElementById('t1-instruccion').textContent = 'Tocá la figura cada vez que aparezca';
    document.getElementById('t1-status').textContent = `0 / ${this.total}`;

    AdminConsole.log(`T1 init: shape=${this.shape}`);
    setTimeout(() => this.showShape(), 800);
  },

  svgFor(shape) {
    const color = '#c17f5a';
    switch (shape) {
      case 'circle':
        return `<svg viewBox="0 0 60 60"><circle cx="30" cy="30" r="26" fill="${color}"/></svg>`;
      case 'square':
        return `<svg viewBox="0 0 60 60"><rect x="6" y="6" width="48" height="48" rx="6" fill="${color}"/></svg>`;
      case 'triangle':
        return `<svg viewBox="0 0 60 60"><polygon points="30,4 56,56 4,56" fill="${color}"/></svg>`;
      case 'star':
        return `<svg viewBox="0 0 60 60"><polygon points="30,4 36,22 56,22 41,34 47,54 30,42 13,54 19,34 4,22 24,22" fill="${color}"/></svg>`;
    }
  },

  showShape() {
    if (this.current >= this.total) return;

    const area = document.getElementById('t1-area');
    area.innerHTML = '';

    const margin = 36;
    const x = randInt(margin, this.areaW - margin - 72);
    const y = randInt(margin, this.areaH - margin - 72);

    const el = document.createElement('div');
    el.className = 't1-shape';
    el.style.left = x + 'px';
    el.style.top  = y + 'px';
    el.innerHTML  = this.svgFor(this.shape);

    const shownAt = Date.now();

    const handler = () => {
      clearTimeout(this.shapeTimeout);
      this.hits++;
      const rt = Date.now() - shownAt;
      this.timestamps.push(rt);
      this.current++;
      document.getElementById('t1-status').textContent = `${this.current} / ${this.total}`;
      AdminConsole.log(`T1 hit ${this.current}: ${rt}ms`);
      this.advance();
    };

    el.addEventListener('click', handler);
    el.addEventListener('touchstart', (e) => { e.preventDefault(); handler(); }, { passive: false });
    area.appendChild(el);

    this.shapeTimeout = setTimeout(() => {
      this.current++;
      document.getElementById('t1-status').textContent = `${this.current} / ${this.total}`;
      AdminConsole.log(`T1 miss ${this.current}`);
      this.advance();
    }, 5000);
  },

  advance() {
    if (this.current >= this.total) {
      this.finish();
    } else {
      setTimeout(() => this.showShape(), 600);
    }
  },

  finish() {
    const area = document.getElementById('t1-area');
    area.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:18px;color:var(--text-s);">Completado ✓</div>`;

    const avgRt = this.timestamps.length > 0
      ? Math.round(this.timestamps.reduce((a, b) => a + b, 0) / this.timestamps.length)
      : 5000;

    let pts = (this.hits / this.total) * 0.5;
    if (avgRt > 4000) pts *= 0.85;
    pts = Math.round(pts * 100) / 100;

    // Domain score 0–5: pts_raw is 0–0.5 → × 10
    const atencion = Math.min(5, Math.round(pts * 10));

    AppState.tests.atencion = { aciertos: this.hits, total: this.total, reaccionMs: avgRt, pts, atencion };
    AdminConsole.log(`T1 done: hits=${this.hits} avgRt=${avgRt}ms pts=${pts}`);
    AdminConsole.refresh();

    setTimeout(() => App.goToStep(4), 1000);
  }
};

/* ============================================================
   TEST 2 — Asociación
   ============================================================ */
const T2 = {
  pairs: [],
  selectedWord: null,
  selectedEmoji: null,
  matched: {},

  init() {
    AppState.tests.asociacion = { aciertos: 0, total: 4, pts: 0, lenguaje: 0 };
    this.selectedWord  = null;
    this.selectedEmoji = null;
    this.matched = {};

    const picked = shuffle(BANK_PARES).slice(0, 4);
    this.pairs = picked;

    const words   = shuffle(picked.map(p => p.w));
    const emojis  = shuffle(picked.map(p => p.e));

    const area = document.getElementById('t2-area');
    area.innerHTML = `
      <div class="t2-col" id="t2-words"></div>
      <div class="t2-col" id="t2-emojis"></div>
    `;

    const wCol = document.getElementById('t2-words');
    const eCol = document.getElementById('t2-emojis');

    words.forEach(w => {
      const el = document.createElement('div');
      el.className = 't2-word';
      el.textContent = w;
      el.dataset.val = w;
      el.addEventListener('click', () => this.selectWord(el, w));
      wCol.appendChild(el);
    });

    emojis.forEach(e => {
      const el = document.createElement('div');
      el.className = 't2-emoji';
      el.textContent = e;
      el.dataset.val = e;
      el.addEventListener('click', () => this.selectEmoji(el, e));
      eCol.appendChild(el);
    });

    document.getElementById('btn-t2').disabled = true;
    AdminConsole.log('T2 init');
  },

  selectWord(el, val) {
    if (el.classList.contains('matched-correct') || el.classList.contains('matched-wrong')) return;
    document.querySelectorAll('.t2-word').forEach(e => e.classList.remove('selected'));
    this.selectedWord = val;
    el.classList.add('selected');
    if (this.selectedEmoji) this.tryMatch();
  },

  selectEmoji(el, val) {
    if (el.classList.contains('matched-correct') || el.classList.contains('matched-wrong')) return;
    document.querySelectorAll('.t2-emoji').forEach(e => e.classList.remove('selected'));
    this.selectedEmoji = val;
    el.classList.add('selected');
    if (this.selectedWord) this.tryMatch();
  },

  tryMatch() {
    const word  = this.selectedWord;
    const emoji = this.selectedEmoji;
    const wEl   = document.querySelector(`.t2-word[data-val="${CSS.escape(word)}"]`);
    const eEl   = document.querySelector(`.t2-emoji[data-val="${CSS.escape(emoji)}"]`);

    const pair = this.pairs.find(p => p.w === word);
    const correct = pair && pair.e === emoji;

    if (correct) {
      wEl.classList.remove('selected'); wEl.classList.add('matched-correct');
      eEl.classList.remove('selected'); eEl.classList.add('matched-correct');
      this.matched[word] = true;
      AdminConsole.log(`T2 ✓ ${word}=${emoji}`);
    } else {
      wEl.classList.remove('selected'); wEl.classList.add('matched-wrong');
      eEl.classList.remove('selected'); eEl.classList.add('matched-wrong');
      AdminConsole.log(`T2 ✗ ${word}≠${emoji}`);
      setTimeout(() => {
        wEl.classList.remove('matched-wrong');
        eEl.classList.remove('matched-wrong');
      }, 700);
    }

    this.selectedWord  = null;
    this.selectedEmoji = null;

    const done = Object.keys(this.matched).length;
    if (done === 4) {
      document.getElementById('btn-t2').disabled = false;
    } else if (!correct) {
      // allow retry — just clear state
    }
    AdminConsole.refresh();
  },

  t2Confirm() {
    const aciertos = Object.keys(this.matched).length;
    const pts = [0.5, 0.35, 0.2, 0, 0][Math.max(0, 4 - aciertos)];
    const lookup = { 4: 0.5, 3: 0.35, 2: 0.2, 1: 0, 0: 0 };
    const p = lookup[aciertos] !== undefined ? lookup[aciertos] : 0;

    // Domain score 0–5: pts_raw is 0–0.5 → × 10
    const lenguaje = Math.min(5, Math.round(p * 10));

    AppState.tests.asociacion = { aciertos, total: 4, pts: p, lenguaje };
    AdminConsole.log(`T2 done: ${aciertos}/4 pts=${p}`);
    AdminConsole.refresh();
    App.goToStep(5);
  }
};

/* ============================================================
   TEST 3 — Memoria diferida
   ============================================================ */
const T3 = {
  gridWords: [],
  selected: new Set(),

  init() {
    AppState.tests.memoria = { aciertos: 0, total: 3, falsos: 0, pts: 0, memoria: 0 };
    this.selected = new Set();

    const target = AppState.palabrasMemorizadas;
    const distractors = shuffle(
      BANK_PALABRAS.filter(w => !target.includes(w))
    ).slice(0, 6);

    this.gridWords = shuffle([...target, ...distractors]);

    const grid = document.getElementById('t3-grid');
    grid.innerHTML = '';

    this.gridWords.forEach(w => {
      const el = document.createElement('div');
      el.className = 't3-word';
      el.textContent = w;
      el.dataset.word = w;
      el.addEventListener('click', () => this.toggle(el, w));
      grid.appendChild(el);
    });

    document.getElementById('btn-t3').disabled = true;
    AdminConsole.log(`T3 init: target=[${target}]`);
  },

  toggle(el, word) {
    if (this.selected.has(word)) {
      this.selected.delete(word);
      el.classList.remove('selected');
    } else {
      if (this.selected.size >= 3) return;
      this.selected.add(word);
      el.classList.add('selected');
    }
    document.getElementById('btn-t3').disabled = this.selected.size === 0;
  },

  t3Confirm() {
    const target = AppState.palabrasMemorizadas;
    let aciertos = 0, falsos = 0;
    this.selected.forEach(w => {
      if (target.includes(w)) aciertos++;
      else falsos++;
    });

    const base = (aciertos / 3) * 1.0;
    const pen  = falsos * 0.15;
    const pts  = Math.max(0, Math.round((base - pen) * 100) / 100);

    // Domain score 0–5: pts_raw is 0–1.0 → × 5
    const memoria = Math.min(5, Math.round(pts * 5));

    AppState.tests.memoria = { aciertos, total: 3, falsos, pts, memoria };
    AdminConsole.log(`T3 done: ${aciertos}/3 falsos=${falsos} pts=${pts}`);
    AdminConsole.refresh();
    App.goToStep(6);
  }
};

/* ============================================================
   TEST 4 — Secuencia
   ============================================================ */
const T4 = {
  sequence: [],
  labels: [],
  positions: [],
  currentIdx: 0,
  errors: 0,
  startTime: 0,
  lines: [],

  init() {
    AppState.tests.secuencia = { correcta: false, tiempoSeg: 0, pts: 0, ejecutivo: 0 };
    this.currentIdx = 0;
    this.errors = 0;
    this.lines = [];

    const sessionNum = Math.floor(Math.random() * 1000);
    const isB = sessionNum % 2 === 1;

    if (!isB) {
      // Variant A: 1→2→3→4→5
      this.labels = ['1','2','3','4','5'];
      document.getElementById('t4-instruccion').textContent = 'Tocá los números en orden: 1 → 2 → 3 → 4 → 5';
    } else {
      // Variant B: 1→A→2→B→3→C
      this.labels = ['1','A','2','B','3','C'];
      document.getElementById('t4-instruccion').textContent = 'Tocá en orden: 1 → A → 2 → B → 3 → C';
    }

    const area = document.getElementById('t4-area');
    area.innerHTML = '<svg id="t4-svg" width="100%" height="100%"></svg>';
    const w = area.clientWidth;
    const h = area.clientHeight;

    // Generate non-overlapping positions
    this.positions = this.genPositions(this.labels.length, w, h);
    this.renderDots(area, w, h);

    this.startTime = Date.now();
    AdminConsole.log(`T4 init: variant=${isB ? 'B' : 'A'} labels=[${this.labels}]`);
  },

  genPositions(n, w, h) {
    const margin = 50;
    const minDist = 80;
    const positions = [];
    let attempts = 0;
    while (positions.length < n && attempts < 1000) {
      attempts++;
      const x = randInt(margin, w - margin);
      const y = randInt(margin, h - margin);
      const ok = positions.every(p => Math.hypot(p.x - x, p.y - y) > minDist);
      if (ok) positions.push({ x, y });
    }
    return positions;
  },

  renderDots(area, w, h) {
    this.labels.forEach((label, i) => {
      const pos = this.positions[i];
      const dot = document.createElement('div');
      dot.className = 't4-dot';
      dot.textContent = label;
      dot.style.left = (pos.x - 30) + 'px';
      dot.style.top  = (pos.y - 30) + 'px';
      dot.dataset.idx = i;

      const handler = () => this.tapDot(i, dot);
      dot.addEventListener('click', handler);
      dot.addEventListener('touchstart', (e) => { e.preventDefault(); handler(); }, { passive: false });
      area.appendChild(dot);
    });
  },

  tapDot(idx, el) {
    if (idx === this.currentIdx) {
      el.classList.add('done');

      // Draw line to previous dot if exists
      if (this.currentIdx > 0) {
        const prev = this.positions[this.currentIdx - 1];
        const curr = this.positions[this.currentIdx];
        const svg = document.getElementById('t4-svg');
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', prev.x);
        line.setAttribute('y1', prev.y);
        line.setAttribute('x2', curr.x);
        line.setAttribute('y2', curr.y);
        line.setAttribute('class', 't4-line');
        svg.appendChild(line);
      }

      this.currentIdx++;
      AdminConsole.log(`T4 step ${this.currentIdx}/${this.labels.length}`);

      if (this.currentIdx >= this.labels.length) {
        this.finish();
      }
    } else {
      this.errors++;
      el.classList.add('error');
      setTimeout(() => el.classList.remove('error'), 400);
      AdminConsole.log(`T4 error at idx=${idx} expected=${this.currentIdx}`);
    }
  },

  finish() {
    const elapsed = Math.round((Date.now() - this.startTime) / 1000);
    let pts = 0;
    if (this.errors === 0) pts = 0.5;
    else if (this.errors === 1) pts = 0.25;

    // Domain score 0–5: pts_raw is 0–0.5 → × 10
    const ejecutivo = Math.min(5, Math.round(pts * 10));

    AppState.tests.secuencia = { correcta: this.errors === 0, tiempoSeg: elapsed, pts, ejecutivo };
    AdminConsole.log(`T4 done: errors=${this.errors} time=${elapsed}s pts=${pts}`);
    AdminConsole.refresh();
    setTimeout(() => App.goToStep(7), 800);
  }
};

/* ============================================================
   TEST 5 — Correlación
   ============================================================ */
const T5 = {
  set: null,
  symbols: [],
  answers: {},
  startTime: 0,

  init() {
    AppState.tests.correlacion = { aciertos: 0, total: 5, tiempoSeg: 0, pts: 0, velocidad: 0 };
    this.answers = {};

    const setIdx = Math.floor(Math.random() * BANK_SETS.length);
    this.set = BANK_SETS[setIdx];
    const entries = Object.entries(this.set.m);
    this.symbols = shuffle(entries);

    // Render reference table
    const tbl = document.getElementById('t5-table');
    tbl.innerHTML = '';
    entries.forEach(([sym, num]) => {
      const cell = document.createElement('div');
      cell.className = 't5-ref-cell';
      cell.innerHTML = `<span class="t5-ref-sym">${sym}</span><span class="t5-ref-num">${num}</span>`;
      tbl.appendChild(cell);
    });

    // Render questions
    const qWrap = document.getElementById('t5-questions');
    qWrap.innerHTML = '';
    const allNums = entries.map(e => e[1]);

    this.symbols.forEach(([sym, correctNum]) => {
      const wrong = shuffle(allNums.filter(n => n !== correctNum)).slice(0, 3);
      const options = shuffle([correctNum, ...wrong]);

      const qDiv = document.createElement('div');
      qDiv.className = 't5-q';
      qDiv.dataset.sym = sym;
      qDiv.innerHTML = `<div class="t5-q-sym">${sym}</div>
        <div class="t5-options" id="t5-opts-${sym.charCodeAt(0)}"></div>`;
      qWrap.appendChild(qDiv);

      const optsEl = qDiv.querySelector('.t5-options');
      options.forEach(num => {
        const btn = document.createElement('button');
        btn.className = 't5-opt';
        btn.textContent = num;
        btn.addEventListener('click', () => this.selectOpt(sym, num, btn, optsEl));
        optsEl.appendChild(btn);
      });
    });

    document.getElementById('btn-t5').disabled = true;
    this.startTime = Date.now();
    AdminConsole.log(`T5 init: set=${setIdx}`);
  },

  selectOpt(sym, num, btn, optsEl) {
    optsEl.querySelectorAll('.t5-opt').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    this.answers[sym] = num;

    // Enable confirm if all answered
    const total = this.symbols.length;
    if (Object.keys(this.answers).length >= total) {
      document.getElementById('btn-t5').disabled = false;
    }
    AdminConsole.log(`T5 pick ${sym}=${num}`);
  },

  t5Confirm() {
    const elapsed = Math.round((Date.now() - this.startTime) / 1000);
    let aciertos = 0;

    this.symbols.forEach(([sym, correct]) => {
      const qDiv  = document.querySelector(`.t5-q[data-sym="${sym}"]`);
      const opts  = qDiv ? qDiv.querySelectorAll('.t5-opt') : [];
      opts.forEach(btn => {
        const val = parseInt(btn.textContent);
        if (val === correct) btn.classList.add('correct');
        if (this.answers[sym] === val && val !== correct) btn.classList.add('wrong');
      });
      if (this.answers[sym] === correct) aciertos++;
    });

    let pts = (aciertos / 5) * 0.5;
    if (elapsed > 90) pts *= 0.85;
    pts = Math.round(pts * 100) / 100;

    // Domain score 0–5: pts_raw is 0–0.5 → × 10
    const velocidad = Math.min(5, Math.round(pts * 10));

    AppState.tests.correlacion = { aciertos, total: 5, tiempoSeg: elapsed, pts, velocidad };
    AdminConsole.log(`T5 done: ${aciertos}/5 time=${elapsed}s pts=${pts}`);
    AdminConsole.refresh();

    // Stop global timer
    const now = Date.now();
    AppState.meta.duracionSeg = Math.round((now - AppState.cronometroGlobal) / 1000);
    AdminConsole.log(`Global time: ${AppState.meta.duracionSeg}s`);

    setTimeout(() => App.goToStep(8), 800);
  }
};

/* Public aliases used by inline onclick handlers */
const Tests = {
  t2Confirm: () => T2.t2Confirm(),
  t3Confirm: () => T3.t3Confirm(),
  t5Confirm: () => T5.t5Confirm()
};
