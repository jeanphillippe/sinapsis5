/* adminconsole.js — Debug panel for Sinapsis 5 */

const AdminConsole = {
  tapCount: 0,
  tapTimer: null,
  logEntries: [],
  timerInterval: null,

  init() {
    const logo = document.getElementById('logo-tap');
    if (!logo) return;
    logo.addEventListener('click', () => this.toggle());
    logo.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.toggle();
    }, { passive: false });
    AdminConsole.log('AdminConsole ready');
  },

  toggle() {
    const ac = document.getElementById('admin-console');
    if (ac.classList.contains('hidden')) {
      this.open();
    } else {
      this.close();
    }
  },

  open() {
    document.getElementById('admin-console').classList.remove('hidden');
    this.refresh();
    if (!this.timerInterval) {
      this.timerInterval = setInterval(() => this.refreshTimer(), 1000);
    }
  },

  close() {
    document.getElementById('admin-console').classList.add('hidden');
    clearInterval(this.timerInterval);
    this.timerInterval = null;
  },

  refresh() {
    const ac = document.getElementById('admin-console');
    if (!ac || ac.classList.contains('hidden')) return;

    const stateEl = document.getElementById('ac-state');
    if (stateEl) {
      try {
        stateEl.textContent = JSON.stringify(AppState, null, 2);
      } catch(e) { stateEl.textContent = 'Error serializing state'; }
    }

    const scoreEl = document.getElementById('ac-score');
    if (scoreEl) {
      const s = AppState.scoring;
      scoreEl.textContent = s.final !== undefined ? `${s.final} / 25` : '—';
    }

    const multsEl = document.getElementById('ac-mults');
    if (multsEl) {
      const s = AppState.scoring;
      multsEl.textContent = s.multEdad ? `edad×${s.multEdad} edu×${s.multEdu}` : '—';
    }
  },

  refreshTimer() {
    const timerEl = document.getElementById('ac-timer');
    if (!timerEl) return;
    if (AppState.cronometroGlobal) {
      const sec = Math.round((Date.now() - AppState.cronometroGlobal) / 1000);
      timerEl.textContent = `${sec}s`;
    } else {
      timerEl.textContent = 'no iniciado';
    }
  },

  log(msg) {
    const ts = new Date().toISOString().substr(11, 8);
    this.logEntries.unshift(`[${ts}] ${msg}`);
    if (this.logEntries.length > 40) this.logEntries.pop();

    const logEl = document.getElementById('ac-log');
    if (logEl) {
      logEl.textContent = this.logEntries.slice(0, 10).join('\n');
    }
  },

  copyState() {
    try {
      navigator.clipboard.writeText(JSON.stringify(AppState, null, 2))
        .then(() => this.log('State copiado al portapapeles'))
        .catch(() => this.log('Error copiando state'));
    } catch(e) {
      this.log('Clipboard no disponible');
    }
  },

  forceNext() {
    this.log('Forzando siguiente paso...');
    App.forceNext();
  }
};
