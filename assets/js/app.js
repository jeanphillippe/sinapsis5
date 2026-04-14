/* app.js — Global state, navigation and init for Sinapsis 5 v3 */

/* ============================================================
   GLOBAL STATE
   ============================================================ */
const AppState = {
  meta: { version: '3.0.0', fechaInicio: null, duracionSeg: 0, iniciado: false },
  paciente: {
    nombre: '', edad: 35, genero: '', telefono: '',
    educacion: null, educacionCategoria: null,
    localidad: '', provincia: ''
  },
  palabrasMemorizadas: [],
  cronometroGlobal: null,
  tests: {
    atencion:    { aciertos: 0, total: 10, reaccionMs: 0, pts: 0, atencion: 0 },
    asociacion:  { aciertos: 0, total: 4,  pts: 0, lenguaje: 0 },
    memoria:     { aciertos: 0, total: 3,  falsos: 0, pts: 0, memoria: 0 },
    secuencia:   { correcta: false, tiempoSeg: 0, pts: 0, ejecutivo: 0 },
    correlacion: { aciertos: 0, total: 5,  tiempoSeg: 0, pts: 0, velocidad: 0 }
  },
  scoring: {
    dominios: { memoria: 0, ejecutivo: 0, atencion: 0, lenguaje: 0, velocidad: 0 },
    scorePonderado: 0, ajusteEdad: 0, ajusteEdu: 0, scoreFinal: 0,
    max: 32, categoria: '', color: '', alerta: null, caida: null,
    indiceCognitivo: 0, tiempoTotal: 0, erroresTotal: 0,
    final: 0, base: 0
  }
};

/* ============================================================
   STEP → PASO MAPPING
   ============================================================ */
const STEPS = [
  'paso-0',  // 0: Bienvenida
  'paso-1',  // 1: Datos paciente
  'paso-2',  // 2: Memorización
  'paso-3',  // 3: Test 1 Atención
  'paso-4',  // 4: Test 2 Asociación
  'paso-5',  // 5: Test 3 Memoria
  'paso-6',  // 6: Test 4 Secuencia
  'paso-7',  // 7: Test 5 Correlación
  'paso-8'   // 8: Resultados
];

let currentStep = 0;

/* ============================================================
   PERSISTENCIA LOCAL — localStorage helpers
   ============================================================ */
const DB_KEY = 'sinapsis_pacientes';

function guardarResultado(state) {
  try {
    const db = JSON.parse(localStorage.getItem(DB_KEY) || '{}');
    const id = state.paciente.telefono || state.paciente.nombre;
    if (!id) return;
    if (!db[id]) db[id] = { paciente: state.paciente, historial: [] };
    db[id].paciente = state.paciente; // Update patient data
    db[id].historial.push({
      fecha: new Date().toISOString(),
      scoring: state.scoring,
      tests: state.tests,
      meta: state.meta
    });
    localStorage.setItem(DB_KEY, JSON.stringify(db));
    AdminConsole.log('Resultado guardado en localStorage');
  } catch (e) {
    AdminConsole.log('Error guardando resultado: ' + e.message);
  }
}

function obtenerTestPrevio(id) {
  try {
    const db = JSON.parse(localStorage.getItem(DB_KEY) || '{}');
    const historial = db[id]?.historial;
    if (!historial || historial.length < 2) return null;
    return historial[historial.length - 2];
  } catch (e) {
    return null;
  }
}

function obtenerTodosLosPacientes() {
  try {
    return JSON.parse(localStorage.getItem(DB_KEY) || '{}');
  } catch (e) {
    return {};
  }
}

function importarLoteJSON(jsonArray) {
  try {
    const db = JSON.parse(localStorage.getItem(DB_KEY) || '{}');
    jsonArray.forEach(state => {
      const id = state.paciente?.telefono || state.paciente?.nombre;
      if (!id) return;
      if (!db[id]) db[id] = { paciente: state.paciente, historial: [] };

      // Usar meta.fecha (formato "YYYY-MM-DD") o meta.fechaInicio (ISO), en ese orden
      const rawFecha = state.meta?.fecha || state.meta?.fechaInicio;
      const fechaISO = rawFecha
        ? (rawFecha.includes('T') ? rawFecha : rawFecha + 'T12:00:00.000Z')
        : new Date().toISOString();

      // Deduplicar: no insertar si ya existe una entrada con la misma fecha normalizada
      const fechaDia = fechaISO.slice(0, 10); // "YYYY-MM-DD"
      const yaExiste = db[id].historial.some(h => (h.fecha || '').slice(0, 10) === fechaDia);
      if (yaExiste) return;

      db[id].historial.push({
        fecha: fechaISO,
        scoring: state.scoring,
        tests: state.tests,
        meta: state.meta
      });
    });
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  } catch (e) {
    AdminConsole.log('Error importando lote: ' + e.message);
  }
}

function descargarArchivo(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/* ============================================================
   APP CONTROLLER
   ============================================================ */
const App = {

  goToStep(step) {
    if (step < 0 || step >= STEPS.length) return;

    const fromEl = document.getElementById(STEPS[currentStep]);
    const toEl   = document.getElementById(STEPS[step]);
    if (!toEl) return;

    // Fade out current
    if (fromEl) {
      fromEl.style.opacity = '0';
      fromEl.style.transform = 'translateY(-12px)';
      fromEl.style.pointerEvents = 'none';
      setTimeout(() => {
        fromEl.classList.remove('active');
        fromEl.style.opacity = '';
        fromEl.style.transform = '';
      }, 300);
    }

    currentStep = step;

    // Update header
    if (step === 0) {
      document.getElementById('app-header').classList.add('hidden');
    } else {
      document.getElementById('app-header').classList.remove('hidden');
      document.getElementById('step-indicator').textContent = `${step} / ${STEPS.length - 1}`;
    }

    // Activate new step after fade
    setTimeout(() => {
      toEl.classList.add('active');
      toEl.style.opacity = '0';
      toEl.style.transform = 'translateY(18px)';
      void toEl.offsetWidth;
      toEl.style.opacity = '';
      toEl.style.transform = '';
      toEl.style.pointerEvents = '';

      App.onStepEnter(step);
      AdminConsole.log(`→ paso ${step}`);
      AdminConsole.refresh();
    }, 310);
  },

  onStepEnter(step) {
    switch (step) {
      case 1: App.paso1Init(); break;
      case 2: App.paso2Init(); break;
      case 3: T1.init(); break;
      case 4: T2.init(); break;
      case 5: T3.init(); break;
      case 6: T4.init(); break;
      case 7: T5.init(); break;
      case 8: App.resultsInit(); break;
    }
  },

  /* ---- PASO 1 ---- */
  paso1Init() {
    // Flag de inicio para métricas
    sessionStorage.setItem('sinapsis_iniciado', Date.now());
    AppState.meta.iniciado = true;
    AppState.meta.fechaInicio = sessionStorage.getItem('sinapsis_iniciado');

    const inputs = ['f-nombre','f-telefono','f-localidad','f-provincia','f-educacion'];
    inputs.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', App.validatePaso1);
      if (el) el.addEventListener('change', App.validatePaso1);
    });
    App.validatePaso1();
  },

  validatePaso1() {
    const nombre    = (document.getElementById('f-nombre')?.value || '').trim();
    const telefono  = (document.getElementById('f-telefono')?.value || '').trim();
    const localidad = (document.getElementById('f-localidad')?.value || '').trim();
    const provincia = document.getElementById('f-provincia')?.value || '';
    const eduVal    = document.getElementById('f-educacion')?.value || '';
    const genero    = AppState.paciente.genero;

    const educacion = eduVal !== '' ? parseInt(eduVal) : null;

    const valid = nombre && telefono && localidad && provincia && genero && educacion !== null;
    const btn = document.getElementById('btn-paso1');
    if (btn) btn.disabled = !valid;

    // Sync to state
    AppState.paciente.nombre             = nombre;
    AppState.paciente.telefono           = telefono;
    AppState.paciente.localidad          = localidad;
    AppState.paciente.provincia          = provincia;
    AppState.paciente.educacion          = educacion;
    AppState.paciente.educacionCategoria = mapearEducacion(educacion);
  },

  stepperChange(field, delta) {
    let val = AppState.paciente[field] + delta;
    if (field === 'edad') val = Math.min(110, Math.max(18, val));
    AppState.paciente[field] = val;
    const el = document.getElementById(`${field}-val`);
    if (el) el.textContent = val;
    App.validatePaso1();
  },

  selectToggle(field, val, btn) {
    AppState.paciente[field] = val;
    const group = btn.closest('.toggle-group') || btn.parentElement;
    group.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    App.validatePaso1();
  },
syncGeneroDropdown(select) {
  const val = select.value;
  if (!val) return;

  const group = select.closest('.toggle-group');
  const btn = group.querySelector(`.toggle-btn[data-val="${val}"]`);

  if (btn) {
    btn.click(); // reutiliza TODO lo existente
  }
},
  /* ---- PASO 2: Memorización ---- */
  paso2Init() {
    const pool   = shuffle([...BANK_PALABRAS]);
    const chosen = pool.slice(0, 3);
    AppState.palabrasMemorizadas = chosen;
    AdminConsole.log(`Palabras: [${chosen}]`);

    const display  = document.getElementById('memo-word-display');
    const barFill  = document.getElementById('memo-bar-fill');
    const doneMsg  = document.getElementById('memo-done-msg');
    const btn      = document.getElementById('btn-paso2');
    doneMsg.classList.add('hidden');
    btn.disabled = true;

    display.style.opacity = '0';
    display.innerHTML = chosen.map(w => `<div>${w}</div>`).join('');

    const DURATION = 10000;

    setTimeout(() => {
      display.style.opacity = '1';

      let elapsed = 0;
      const interval = 50;
      const timer = setInterval(() => {
        elapsed += interval;
        if (barFill) barFill.style.width = Math.min(100, (elapsed / DURATION) * 100) + '%';

        if (elapsed >= DURATION) {
          clearInterval(timer);
          display.style.opacity = '0';
          if (barFill) barFill.style.width = '0%';
          setTimeout(() => {
            display.textContent = '';
            doneMsg.classList.remove('hidden');
            btn.disabled = false;
          }, 300);
        }
      }, interval);
    }, 300);
  },

  startTests() {
    AppState.cronometroGlobal = Date.now();
    AdminConsole.log('Cronómetro global iniciado');
    App.goToStep(3);
  },

  /* ---- PASO 8: Resultados ---- */
  resultsInit() {
    // Guardar inicio en meta
    AppState.meta.fechaInicio = sessionStorage.getItem('sinapsis_iniciado') || AppState.meta.fechaInicio || new Date().toISOString();

    const scoring = Scoring.calcAll();

    // Guardar en localStorage (persistencia longitudinal)
    guardarResultado(AppState);

    // Título por categoría
    const catInfo = TEXTOS_CATEGORIA[scoring.categoria] || { titulo: scoring.categoria, color: scoring.color };

    // Score display
    document.getElementById('score-number').textContent = scoring.scoreFinal.toFixed(1);
    document.getElementById('score-label').textContent  = `de ${scoring.max}`;
    document.getElementById('score-categoria').textContent = catInfo.titulo;
    document.getElementById('score-categoria').style.color = catInfo.color;

    const bar = document.getElementById('score-bar-fill');
    bar.style.background = catInfo.color;
    setTimeout(() => {
      bar.style.width = Math.min(100, (scoring.scoreFinal / scoring.max) * 100) + '%';
    }, 100);

    // Banner de alerta clínica
    const alertaBanner = document.getElementById('alerta-banner');
    if (alertaBanner) {
      if (scoring.alerta) {
        const alertaTextos = {
          memoria_baja:       '⚠️ Memoria baja — se recomienda seguimiento',
          ejecutivo_bajo:     '⚠️ Función ejecutiva baja — se recomienda evaluación',
          caida_progresiva:   '⚠️ Caída progresiva respecto al test anterior',
          tiempo_aumentado:   '⚠️ Tiempo de respuesta aumentado respecto al test anterior'
        };
        const partes = scoring.alerta.split('+').map(a => alertaTextos[a] || a);
        alertaBanner.innerHTML = partes.join('<br>');
        alertaBanner.classList.remove('hidden');
      } else {
        alertaBanner.classList.add('hidden');
      }
    }

    // Tabla de dominios (reemplaza tabla antigua)
    const tbody = document.getElementById('results-tbody');
    const d = scoring.dominios;
    const ps = PESOS;

    const rows = [
      ['Memoria',   d.memoria,   ps.memoria,   d.memoria   * ps.memoria],
      ['Ejecutivo', d.ejecutivo, ps.ejecutivo, d.ejecutivo * ps.ejecutivo],
      ['Atención',  d.atencion,  ps.atencion,  d.atencion  * ps.atencion],
      ['Lenguaje',  d.lenguaje,  ps.lenguaje,  d.lenguaje  * ps.lenguaje],
      ['Velocidad', d.velocidad, ps.velocidad, d.velocidad * ps.velocidad]
    ];

    tbody.innerHTML = rows.map(([nombre, puntaje, peso, pond]) =>
      `<tr>
        <td>${nombre}</td>
        <td>${puntaje} / 5</td>
        <td>×${peso.toFixed(1)}</td>
        <td>${(Math.round(pond * 10) / 10).toFixed(1)}</td>
      </tr>`
    ).join('') + `
      <tr class="total-row">
        <td colspan="3">Score ponderado</td>
        <td>${scoring.scorePonderado.toFixed(1)} / 32</td>
      </tr>
      <tr>
        <td colspan="3">Ajuste edad</td>
        <td>${scoring.ajusteEdad >= 0 ? '+' : ''}${scoring.ajusteEdad}</td>
      </tr>
      <tr>
        <td colspan="3">Ajuste educación</td>
        <td>${scoring.ajusteEdu >= 0 ? '+' : ''}${scoring.ajusteEdu}</td>
      </tr>
      <tr class="total-row">
        <td colspan="3"><strong>Score final</strong></td>
        <td><strong>${scoring.scoreFinal.toFixed(1)}</strong></td>
      </tr>
    `;

    // Caída longitudinal (si hay comparación previa)
    const caidaEl = document.getElementById('caida-info');
    if (caidaEl) {
      if (scoring.caida !== null) {
        const signo = scoring.caida > 0 ? '↓' : scoring.caida < 0 ? '↑' : '→';
        const color = scoring.caida >= 3 ? '#c45c5c' : scoring.caida <= -3 ? '#7ab894' : '#d4a85a';
        caidaEl.innerHTML = `<span style="color:${color}">${signo} ${Math.abs(scoring.caida).toFixed(1)} pts vs. test anterior</span>`;
        caidaEl.classList.remove('hidden');
      } else {
        caidaEl.classList.add('hidden');
      }
    }

    // ── Modelo cuantitativo P(DCL) ──
    try {
      const cuant   = ScoringCuantitativo.calcAll(AppState);
      const pdclBlock = document.getElementById('pdcl-block');
      if (pdclBlock) {
        pdclBlock.classList.remove('hidden');

        document.getElementById('pdcl-scnorm').textContent = cuant.scNorm.toFixed(3);
        document.getElementById('pdcl-prob').textContent   = (cuant.pDCL * 100).toFixed(1) + '%';

        const riesgoEl = document.getElementById('pdcl-riesgo');
        const RIESGO_TEXTO = { bajo: 'Bajo', intermedio: 'Intermedio', alto: 'Alto' };
        const RIESGO_COLOR = { bajo: '#7ab894', intermedio: '#d4a85a', alto: '#c45c5c' };
        riesgoEl.textContent   = RIESGO_TEXTO[cuant.riesgo] || cuant.riesgo;
        riesgoEl.style.color   = RIESGO_COLOR[cuant.riesgo] || '';

        // Longitudinal
        if (cuant.longitudinal) {
          const longWrap = document.getElementById('pdcl-long-wrap');
          if (longWrap) {
            longWrap.classList.remove('hidden');
            const signo = cuant.longitudinal.deltaSC >= 0 ? '+' : '';
            document.getElementById('pdcl-deltaSC').textContent =
              `${signo}${cuant.longitudinal.deltaSC.toFixed(3)}`;
            document.getElementById('pdcl-indice').textContent =
              `${cuant.longitudinal.indiceDeclive.toFixed(4)} / mes`;
          }
        }

        // Alerta longitudinal
        const alertaLongEl = document.getElementById('pdcl-alerta-long');
        if (alertaLongEl) {
          if (cuant.alertaLong) {
            alertaLongEl.textContent = '⚠️ Declive sostenido detectado — se recomienda seguimiento clínico';
            alertaLongEl.classList.remove('hidden');
          } else {
            alertaLongEl.classList.add('hidden');
          }
        }

        AdminConsole.log(`P(DCL)=${cuant.pDCL} riesgo=${cuant.riesgo} SC_norm=${cuant.scNorm}`);
      }
    } catch(e) {
      AdminConsole.log('Error modelo cuantitativo: ' + e.message);
    }

    // Patient summary
    const p = AppState.paciente;
    const eduLabels = {
      primario: 'Primario', secundario: 'Secundario', universitario: 'Universitario'
    };
    document.getElementById('paciente-summary').innerHTML = `
      <strong>${p.nombre}</strong><br>
      Edad: ${p.edad} · Género: ${p.genero}<br>
      Tel: ${p.telefono}<br>
      ${p.localidad}, ${p.provincia}<br>
      Educación: ${eduLabels[p.educacionCategoria] || 'nivel ' + p.educacion}
    `;
  },

  solicitarTurno() {
    window.open('#', '_blank');
    AdminConsole.log('Turno solicitado');
  },

  recordarRepeticion() {
    alert('Se registró un recordatorio para repetir la evaluación en 6 meses.');
    AdminConsole.log('Recordatorio 6 meses registrado');
  },

  exportJSON() {
    const now = new Date();
    const fecha = now.toISOString().slice(0, 10);
    const nombre = (AppState.paciente.nombre || 'paciente').replace(/\s+/g, '_').toLowerCase();
    const filename = `sinapsis5_${nombre}_${fecha}.json`;

    const data = JSON.stringify(AppState, null, 2);
    descargarArchivo(data, filename, 'application/json');
    AdminConsole.log(`JSON exportado: ${filename}`);
  },

  shareResult() {
    const text = `Sinapsis 5 — ${AppState.paciente.nombre}\nScore: ${AppState.scoring.scoreFinal} / 32`;
    if (navigator.share) {
      navigator.share({ title: 'Sinapsis 5', text }).catch(() => App.copyToClipboard(text));
    } else {
      App.copyToClipboard(text);
    }
  },

  copyToClipboard(text) {
    navigator.clipboard?.writeText(text)
      .then(() => alert('Resultado copiado al portapapeles'))
      .catch(() => alert('No se pudo copiar'));
  },

  abrirDashboard() {
    const pin = prompt('Código de acceso:');
    if (pin === '1234') {
      document.querySelectorAll('.paso').forEach(s => s.classList.remove('active'));
      document.getElementById('app-header').classList.add('hidden');
      const dash = document.getElementById('dashboard-medico');
      if (dash) {
        dash.classList.remove('hidden');
        Dashboard.render();
      }
    } else if (pin !== null) {
      alert('Código incorrecto');
    }
  },

  cerrarDashboard() {
    document.getElementById('dashboard-medico').classList.add('hidden');
    const paso0 = document.getElementById('paso-0');
    if (paso0) {
      paso0.classList.add('active');
      currentStep = 0;
    }
  },

  /* ── Tema claro / oscuro ── */
  toggleTheme() {
    const isLight = document.body.classList.toggle('light');
    try { localStorage.setItem('sinapsis-theme', isLight ? 'light' : 'dark'); } catch(e) {}
    const btn = document.getElementById('theme-toggle-btn');
    if (btn) {
      btn.textContent = isLight ? '🌙' : '☀️';
      btn.title       = isLight ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro';
    }
  },

  forceNext() {
    const next = Math.min(currentStep + 1, STEPS.length - 1);
    switch (currentStep) {
      case 3:
        AppState.tests.atencion   = { aciertos: 8, total: 10, reaccionMs: 1200, pts: 0.4, atencion: 4 };
        break;
      case 4:
        AppState.tests.asociacion = { aciertos: 4, total: 4,  pts: 0.5, lenguaje: 5 };
        break;
      case 5:
        AppState.tests.memoria    = { aciertos: 3, total: 3,  falsos: 0, pts: 1.0, memoria: 5 };
        break;
      case 6:
        AppState.tests.secuencia  = { correcta: true, tiempoSeg: 20, pts: 0.5, ejecutivo: 5 };
        break;
      case 7:
        AppState.tests.correlacion = { aciertos: 5, total: 5, tiempoSeg: 30, pts: 0.5, velocidad: 5 };
        AppState.meta.duracionSeg  = Math.round((Date.now() - (AppState.cronometroGlobal || Date.now())) / 1000);
        break;
    }
    App.goToStep(next);
  }
};

/* ============================================================
   DASHBOARD MÉDICO
   ============================================================ */
let _dashCharts = {};

const Dashboard = {

  _vista: 'total', // 'total' | 'dominios'

  render() {
    // Destruir gráficos existentes
    Object.values(_dashCharts).forEach(c => { try { c.destroy(); } catch(e) {} });
    _dashCharts = {};
    // Cerrar panel de detalle
    Dashboard.cerrarDetalle();
    // Renderizar todas las secciones
    Dashboard.renderGeneral();
    Dashboard.renderAnalisis();
    Dashboard.renderAlertas();
    Dashboard.renderMetricas();
    Dashboard._renderStats();
    // Cargar configuración del modelo cuantitativo
    DashboardModelo.init();
  },

  // Compatibilidad: showTab ya no navega entre tabs, solo re-renderiza todo
  showTab(_tab) {
    Dashboard.render();
  },

  setVista(vista, pacienteId = null) {
    Dashboard._vista = vista;

    // Toggle button states
    document.getElementById('btn-vista-total')?.classList.toggle('active', vista === 'total');
    document.getElementById('btn-vista-dominios')?.classList.toggle('active', vista === 'dominios');

    // Show/hide controls
    const filtroCat = document.getElementById('filtro-cat-wrap');
    const selPac    = document.getElementById('selector-paciente-wrap');
    const nota      = document.getElementById('dash-dominios-nota');
    if (filtroCat) filtroCat.style.display = vista === 'total'    ? 'flex' : 'none';
    if (selPac)    selPac.style.display    = vista === 'dominios' ? 'flex' : 'none';
    if (nota)      nota.style.display      = vista === 'dominios' ? 'block' : 'none';

    // Destroy + re-render
    if (_dashCharts.general) { try { _dashCharts.general.destroy(); } catch(e) {} delete _dashCharts.general; }

    if (vista === 'total') {
      Dashboard.renderScoreTotal();
    } else {
      Dashboard._poblarSelectorPaciente();
      // Si se pasó un pacienteId, pre-seleccionarlo antes de renderizar
      if (pacienteId) {
        const sel = document.getElementById('selector-paciente');
        if (sel) sel.value = pacienteId;
      }
      Dashboard.renderDominios();
    }
  },

  /* ---- TAB GENERAL (entry point) ---- */
  renderGeneral() {
    // Populate patient selector regardless of view
    Dashboard._poblarSelectorPaciente();

    // Reset to total view button state
    document.getElementById('btn-vista-total')?.classList.add('active');
    document.getElementById('btn-vista-dominios')?.classList.remove('active');
    document.getElementById('filtro-cat-wrap') && (document.getElementById('filtro-cat-wrap').style.display = 'flex');
    document.getElementById('selector-paciente-wrap') && (document.getElementById('selector-paciente-wrap').style.display = 'none');
    document.getElementById('dash-dominios-nota') && (document.getElementById('dash-dominios-nota').style.display = 'none');
    Dashboard._vista = 'total';

    Dashboard.renderScoreTotal();
  },

  /* ---- VISTA: Score total (una línea por paciente) ---- */
  renderScoreTotal() {
    const db = obtenerTodosLosPacientes();
    const ids = Object.keys(db);

    const filtro = document.getElementById('filtro-categoria')?.value || 'todos';
    const colors = ['#c17f5a','#7ab894','#d4a85a','#c45c5c','#8b9dc3','#b07ab8','#5ac4c4','#c4c45a'];
    const datasets = [];
    const leyendaHTML = [];

    ids.forEach((id, idx) => {
      const pac = db[id];
      if (!pac.historial || pac.historial.length === 0) return;
      const lastScore = pac.historial[pac.historial.length - 1];
      const cat = lastScore?.scoring?.categoria || 'normal';
      if (filtro !== 'todos' && cat !== filtro) return;

      const color = colors[idx % colors.length];
      const labels = pac.historial.map(h => h.fecha ? new Date(h.fecha).toLocaleDateString('es-AR') : '—');
      const data   = pac.historial.map(h => h.scoring?.scoreFinal || 0);

      datasets.push({
        label: pac.paciente?.nombre || id,
        data,
        labels,
        borderColor: color,
        backgroundColor: color + '22',
        tension: 0.35,
        fill: false,
        pointRadius: 5,
        pointHoverRadius: 7
      });
      const badgeCls = cat === 'normal' ? 'badge-green' : cat === 'sospechoso' ? 'badge-yellow' : 'badge-red';
      leyendaHTML.push(`<span class="badge ${badgeCls}" style="background:${color}22;color:${color};border:1px solid ${color}55">${pac.paciente?.nombre || id}</span>`);
    });

    const canvas = document.getElementById('chart-general');
    if (!canvas || !window.Chart) return;
    if (_dashCharts.general) { try { _dashCharts.general.destroy(); } catch(e) {} }

    // Build shared labels (union of all dates)
    const allLabels = [...new Set(datasets.flatMap(ds => ds.labels || []))].sort();

    _dashCharts.general = new Chart(canvas, {
      type: 'line',
      data: {
        labels: allLabels,
        datasets: datasets.map(ds => ({
          ...ds,
          data: allLabels.map(lbl => {
            const idx = (ds.labels || []).indexOf(lbl);
            return idx >= 0 ? ds.data[idx] : null;
          }),
          spanGaps: true
        }))
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y} / 32`
            }
          }
        },
        scales: {
          x: { ticks: { color: '#a89f97', maxRotation: 30 }, grid: { color: 'rgba(255,255,255,0.06)' } },
          y: { min: 0, max: 32, ticks: { color: '#a89f97' }, grid: { color: 'rgba(255,255,255,0.06)' },
               title: { display: true, text: 'Score total (0–32)', color: '#a89f97', font: { size: 11 } } }
        }
      }
    });

  },

  /* ---- VISTA: Por dominio (5 líneas para un paciente) ---- */
  _poblarSelectorPaciente() {
    const db  = obtenerTodosLosPacientes();
    const sel = document.getElementById('selector-paciente');
    if (!sel) return;
    sel.innerHTML = '';
    Object.entries(db).forEach(([id, pac]) => {
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = pac.paciente?.nombre || id;
      sel.appendChild(opt);
    });
  },

  renderDominios() {
    const db  = obtenerTodosLosPacientes();
    const sel = document.getElementById('selector-paciente');
    const id  = sel?.value;

    if (!id || !db[id]) {
      return;
    }

    const pac = db[id];
    const historial = pac.historial || [];

    if (historial.length === 0) {
      return;
    }

    const labels = historial.map(h => h.fecha ? new Date(h.fecha).toLocaleDateString('es-AR') : '?');

    // 5 domain series (0–5) + total normalizado (÷6.4 → 0–5 aprox)
    const DOMINIOS = [
      { key: 'memoria',   label: 'Memoria',   color: '#7ab894' },
      { key: 'atencion',  label: 'Atención',  color: '#c17f5a' },
      { key: 'lenguaje',  label: 'Lenguaje',  color: '#d4a85a' },
      { key: 'ejecutivo', label: 'Ejecutivo', color: '#8b9dc3' },
      { key: 'velocidad', label: 'Velocidad', color: '#b07ab8' }
    ];

    const datasets = DOMINIOS.map(d => ({
      label: d.label,
      data: historial.map(h => h.scoring?.dominios?.[d.key] ?? null),
      borderColor: d.color,
      backgroundColor: d.color + '22',
      tension: 0.35,
      fill: false,
      pointRadius: 5,
      pointHoverRadius: 7
    }));

    // Score total normalizado al eje 0-5 (dividir por 6.4 que es 32/5)
    datasets.push({
      label: 'Score total (÷6.4)',
      data: historial.map(h => h.scoring?.scoreFinal != null ? Math.round((h.scoring.scoreFinal / 6.4) * 10) / 10 : null),
      borderColor: '#ffffff',
      backgroundColor: 'rgba(255,255,255,0.08)',
      borderWidth: 2.5,
      borderDash: [6, 4],
      tension: 0.35,
      fill: false,
      pointRadius: 4,
      pointHoverRadius: 6
    });

    const canvas = document.getElementById('chart-general');
    if (!canvas || !window.Chart) return;
    if (_dashCharts.general) { try { _dashCharts.general.destroy(); } catch(e) {} }

    _dashCharts.general = new Chart(canvas, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => {
                const isTotal = ctx.dataset.label.includes('total');
                const val = ctx.parsed.y;
                return isTotal
                  ? ` Score total: ${Math.round(val * 6.4 * 10) / 10} / 32`
                  : ` ${ctx.dataset.label}: ${val} / 5`;
              }
            }
          }
        },
        scales: {
          x: { ticks: { color: '#a89f97', maxRotation: 30 }, grid: { color: 'rgba(255,255,255,0.06)' } },
          y: {
            min: 0, max: 5.5,
            ticks: {
              color: '#a89f97',
              stepSize: 1,
              callback: v => v <= 5 ? v : ''
            },
            grid: { color: 'rgba(255,255,255,0.06)' },
            title: { display: true, text: 'Puntaje por dominio (0–5)', color: '#a89f97', font: { size: 11 } }
          }
        }
      }
    });
  },

  filtrarCategoria() {
    if (Dashboard._vista === 'total') Dashboard.renderScoreTotal();
  },

  /* ---- TAB PACIENTES (legacy, no utilizado actualmente) ---- */
  renderPacientes() {
    const db = obtenerTodosLosPacientes();
    const tbody = document.getElementById('pacientes-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    Object.entries(db).forEach(([id, pac]) => {
      if (!pac.historial || pac.historial.length === 0) return;
      const last       = pac.historial[pac.historial.length - 1];
      const cat        = last?.scoring?.categoria || '—';
      const score      = last?.scoring?.scoreFinal ?? '—';
      const fecha      = last?.fecha ? new Date(last.fecha).toLocaleDateString('es-AR') : '—';
      const badgeClass = cat === 'normal' ? 'badge-green' : cat === 'sospechoso' ? 'badge-yellow' : 'badge-red';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${pac.paciente?.nombre || id}</td>
        <td>${pac.paciente?.edad || '—'}</td>
        <td>${score}</td>
        <td><span class="badge ${badgeClass}">${cat}</span></td>
        <td>${fecha}</td>
        <td></td>
      `;
      const btnCell = tr.querySelector('td:last-child');
      const btn = document.createElement('button');
      btn.className = 'btn-ghost btn-sm';
      btn.textContent = 'Ver evolución';
      btn.addEventListener('click', () => Dashboard.setVista('dominios', id));
      btnCell.appendChild(btn);
      tbody.appendChild(tr);
    });
  },

  _renderStats() {
    const db   = obtenerTodosLosPacientes();
    const ids  = Object.keys(db);
    let totalEvals = 0, totalAlertas = 0, sumaScores = 0, nScores = 0;
    ids.forEach(id => {
      const pac = db[id];
      (pac.historial || []).forEach(h => {
        totalEvals++;
        if (h.scoring?.alerta) totalAlertas++;
        if (h.scoring?.scoreFinal != null) { sumaScores += h.scoring.scoreFinal; nScores++; }
      });
    });
    const avg = nScores > 0 ? (sumaScores / nScores).toFixed(1) : '—';
    const el  = document.getElementById('dash-stats-row');
    if (!el) return;
    el.innerHTML = `
      <div class="dash-stat"><span class="dash-stat-val">${ids.length}</span><span class="dash-stat-lbl">Pacientes</span></div>
      <div class="dash-stat"><span class="dash-stat-val">${totalEvals}</span><span class="dash-stat-lbl">Evaluaciones</span></div>
      <div class="dash-stat dash-stat-warn"><span class="dash-stat-val">${totalAlertas}</span><span class="dash-stat-lbl">Alertas</span></div>
      <div class="dash-stat"><span class="dash-stat-val">${avg}</span><span class="dash-stat-lbl">Score prom.</span></div>
    `;
  },

  /* ---- ALERTAS compactas (strip bajo stats) ---- */
  renderAlertas() {
    const db = obtenerTodosLosPacientes();
    const strip = document.getElementById('alertas-strip');
    if (!strip) return;

    strip.innerHTML = '';

    const ALERTA_SHORT = {
      memoria_baja:     'Mem. baja',
      ejecutivo_bajo:   'Ejec. bajo',
      caida_progresiva: 'Caída prog.',
      tiempo_aumentado: 'T° alto'
    };

    Object.entries(db).forEach(([id, pac]) => {
      if (!pac.historial || pac.historial.length === 0) return;
      const last  = pac.historial[pac.historial.length - 1];
      const alerta = last?.scoring?.alerta;
      if (!alerta) return;

      const nombre = pac.paciente?.nombre || id;
      const tags = alerta.split('+')
        .map(a => ALERTA_SHORT[a] || a)
        .join(' · ');

      const chip = document.createElement('div');
      chip.className = 'dash-alert-chip';
      chip.innerHTML = `<span class="chip-dot"></span><span class="chip-name">${nombre}</span><span class="chip-tag">${tags}</span>`;
      chip.onclick = () => {
        // Abrir detalle de la última evaluación del paciente
        const db2 = obtenerTodosLosPacientes();
        const lastIdx2 = (db2[id]?.historial?.length || 1) - 1;
        Dashboard.verDetalleEvaluacion(id, lastIdx2);
      };
      strip.appendChild(chip);
    });

    // Actualizar badge en stats (ya está contabilizado en _renderStats)
    const badge = document.getElementById('alertas-badge');
    if (badge) badge.textContent = strip.children.length > 0 ? strip.children.length : '';
  },

  /* ---- TAB IMPORTAR ---- */
  importarArchivos() {
    const files = document.getElementById('json-import')?.files;
    if (!files || files.length === 0) {
      document.getElementById('import-log').textContent = '⚠️ Seleccioná al menos un archivo.';
      return;
    }

    const results = [];
    let loaded = 0;

    [...files].forEach(f => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);

          // Detect DB-format (exportarTodos): plain object whose values have .historial[]
          const isDBFormat = !Array.isArray(data) &&
            typeof data === 'object' && data !== null &&
            Object.values(data).some(v => v && Array.isArray(v.historial));

          if (isDBFormat) {
            // Convert each historial entry to AppState-compatible object
            Object.values(data).forEach(entry => {
              if (!entry || !Array.isArray(entry.historial)) return;
              entry.historial.forEach(ev => {
                if (!ev.paciente && entry.paciente) ev.paciente = entry.paciente;
                results.push(ev);
              });
            });
          } else {
            const arr = Array.isArray(data) ? data : [data];
            results.push(...arr);
          }
        } catch (err) {
          AdminConsole.log('Error parsing ' + f.name);
        }
        loaded++;
        if (loaded === files.length) {
          importarLoteJSON(results);
          document.getElementById('import-log').textContent =
            `✅ ${results.length} registro(s) importado(s) exitosamente`;
          Dashboard.render();
        }
      };
      reader.readAsText(f);
    });
  },

  /* ---- TAB MÉTRICAS ---- */
  renderMetricas() {
    const db = obtenerTodosLosPacientes();
    const todos = [];

    Object.values(db).forEach(pac => {
      pac.historial?.forEach(h => todos.push(h));
    });

    const total = todos.length;
    const iniciados = todos.filter(h => h.meta?.iniciado).length;
    const completitud = total > 0 ? Math.round((iniciados / total) * 100) : 0;

    const tiempos = todos.filter(h => h.meta?.duracionSeg > 0).map(h => h.meta.duracionSeg);
    const promedioTiempo = tiempos.length > 0
      ? Math.round(tiempos.reduce((a, b) => a + b, 0) / tiempos.length)
      : 0;

    const dist = { normal: 0, sospechoso: 0, alto_riesgo: 0 };
    todos.forEach(h => {
      const cat = h.scoring?.categoria;
      if (dist[cat] !== undefined) dist[cat]++;
    });

    // Update UI
    const elComp = document.getElementById('met-completitud');
    if (elComp) elComp.textContent = `${completitud}% (${total} registros totales)`;

    const elTiempo = document.getElementById('met-tiempo');
    if (elTiempo) elTiempo.textContent = promedioTiempo > 0 ? `${promedioTiempo}s (${Math.round(promedioTiempo / 60)}m ${promedioTiempo % 60}s)` : '—';

    const canvas = document.getElementById('chart-dist');
    if (!canvas || !window.Chart) return;
    _dashCharts.dist = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: ['Normal', 'Sospechoso', 'Alto riesgo'],
        datasets: [{
          label: 'Pacientes',
          data: [dist.normal, dist.sospechoso, dist.alto_riesgo],
          backgroundColor: ['rgba(122,184,148,0.6)', 'rgba(212,168,90,0.6)', 'rgba(196,92,92,0.6)'],
          borderColor: ['#7ab894', '#d4a85a', '#c45c5c'],
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#a89f97' }, grid: { color: 'rgba(255,255,255,0.06)' } },
          y: { beginAtZero: true, ticks: { color: '#a89f97', stepSize: 1 }, grid: { color: 'rgba(255,255,255,0.06)' } }
        }
      }
    });
  },

  /* ============================================================
     TAB ANÁLISIS CLÍNICO
     ============================================================ */

  _filtros: { localidad: '', categoria: 'todos', edadMin: 0, edadMax: 110, soloAlertas: false },
  _evalSeleccionada: null,   // { id, evalIdx }

  renderAnalisis() {
    Dashboard._filtros = {
      localidad:   '',
      categoria:   'todos',
      edadMin:     0,
      edadMax:     110,
      soloAlertas: false
    };
    Dashboard.aplicarFiltros();
  },

  limpiarFiltros() {
    const ids = ['filtro-nombre','filtro-localidad','filtro-edad-min','filtro-edad-max'];
    ids.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    const cat = document.getElementById('filtro-cat-analisis');
    if (cat) cat.value = 'todos';
    const chk = document.getElementById('filtro-solo-alertas');
    if (chk) chk.checked = false;
    Dashboard.aplicarFiltros();
  },

  aplicarFiltros() {
    const nombre      = (document.getElementById('filtro-nombre')?.value || '').trim().toLowerCase();
    const localidad   = (document.getElementById('filtro-localidad')?.value || '').trim().toLowerCase();
    const categoria   = document.getElementById('filtro-cat-analisis')?.value || 'todos';
    const edadMinRaw  = parseInt(document.getElementById('filtro-edad-min')?.value) || 0;
    const edadMaxRaw  = parseInt(document.getElementById('filtro-edad-max')?.value) || 110;
    const soloAlertas = document.getElementById('filtro-solo-alertas')?.checked || false;

    Dashboard._filtros = { nombre, localidad, categoria, edadMin: edadMinRaw, edadMax: edadMaxRaw, soloAlertas };

    const db             = obtenerTodosLosPacientes();
    const pacientesLista = [];

    Object.entries(db).forEach(([id, pac]) => {
      const p    = pac.paciente || {};
      const edad = parseInt(p.edad) || 0;
      const loc  = (p.localidad || '').toLowerCase();

      // Filtros a nivel paciente
      if (nombre && !(p.nombre || '').toLowerCase().includes(nombre)) return;
      if (localidad && !loc.includes(localidad)) return;
      if (edad < edadMinRaw || edad > edadMaxRaw) return;

      // El paciente pasa si al menos una de sus evaluaciones cumple los filtros de categoría/alertas
      const tieneEvals = (pac.historial || []).some(h => {
        const cat = h.scoring?.categoria || 'normal';
        if (categoria !== 'todos' && cat !== categoria) return false;
        if (soloAlertas && !h.scoring?.alerta) return false;
        return true;
      });
      if (!tieneEvals) return;

      pacientesLista.push({ id, pac });
    });

    // Ordenar por evaluación más reciente
    pacientesLista.sort((a, b) => {
      const fA = a.pac.historial?.slice(-1)[0]?.fecha || '';
      const fB = b.pac.historial?.slice(-1)[0]?.fecha || '';
      return fB.localeCompare(fA);
    });

    const countEl = document.getElementById('analisis-count');
    if (countEl) countEl.textContent = `${pacientesLista.length} paciente(s)`;

    Dashboard._renderPacienteCards(pacientesLista);
  },

  _renderPacienteCards(pacientesLista) {
    const contenedor = document.getElementById('analisis-lista');
    if (!contenedor) return;

    if (pacientesLista.length === 0) {
      contenedor.innerHTML = '<p class="analisis-empty">Sin pacientes para los filtros aplicados.</p>';
      return;
    }

    contenedor.innerHTML = '';
    pacientesLista.forEach(({ id, pac }) => {
      const p         = pac.paciente || {};
      const historial = pac.historial || [];
      const last      = historial[historial.length - 1];
      const cat       = last?.scoring?.categoria || '—';
      const score     = last?.scoring?.scoreFinal ?? '—';
      const alerta    = last?.scoring?.alerta;
      const catCls    = cat === 'normal' ? 'badge-green' : cat === 'sospechoso' ? 'badge-yellow' : 'badge-red';
      const isActive  = Dashboard._evalSeleccionada?.id === id;
      const lastIdx   = historial.length - 1;

      // Mini-barra de evolución de scores
      const scores    = historial.map(h => h.scoring?.scoreFinal ?? 0);
      const miniBar   = scores.map((s, i) => {
        const pct = Math.round((s / 32) * 100);
        const c   = (historial[i].scoring?.categoria || '') === 'normal' ? '#7ab894'
                  : (historial[i].scoring?.categoria || '') === 'sospechoso' ? '#d4a85a' : '#c45c5c';
        return `<span class="pac-mini-bar-seg" style="height:${Math.max(pct, 8)}%;background:${c}"></span>`;
      }).join('');

      const card = document.createElement('div');
      card.className = `pac-card${isActive ? ' active' : ''}`;
      card.dataset.id = id;
      card.innerHTML = `
        <div class="pac-card-top">
          <span class="pac-nombre">${p.nombre || id}</span>
          <span class="badge ${catCls}">${score}/32</span>
        </div>
        <div class="pac-card-meta">${p.localidad || '—'} · ${p.edad || '?'} a · ${historial.length} eval.</div>
        <div class="pac-mini-bar">${miniBar}</div>
        ${alerta ? `<div class="eval-alertas" style="margin-top:4px;">${alerta.split('+').map(a => `<span class="badge badge-red alerta-sm">${_alertaLabel(a)}</span>`).join('')}</div>` : ''}
      `;
      card.addEventListener('click', () => Dashboard.verDetalleEvaluacion(id, lastIdx));
      contenedor.appendChild(card);
    });
  },

  verDetalleEvaluacion(id, evalIdx) {
    const db  = obtenerTodosLosPacientes();
    const pac = db[id];
    if (!pac) return;

    const h = pac.historial[evalIdx];
    if (!h) return;

    const prevId = Dashboard._evalSeleccionada?.id;
    Dashboard._evalSeleccionada = { id, evalIdx };

    // Resaltar pac-card activa (agrupada por paciente)
    document.querySelectorAll('.pac-card').forEach(c => {
      c.classList.toggle('active', c.dataset.id === id);
    });

    // ── Actualizar gráfico al dominio del paciente seleccionado ──
    // Solo re-renderizar si cambió el paciente (evitar re-render al navegar entre fechas)
    if (prevId !== id) {
      Dashboard.setVista('dominios', id);
    }

    // ── Timeline de evaluaciones del paciente ──
    const timelineEl = document.getElementById('det-timeline');
    if (timelineEl) {
      if (pac.historial.length > 1) {
        timelineEl.innerHTML = '';
        const label = document.createElement('div');
        label.className = 'tl-label';
        label.textContent = 'Historial del paciente';
        timelineEl.appendChild(label);

        const pillsWrap = document.createElement('div');
        pillsWrap.className = 'tl-pills';

        pac.historial.forEach((ev, i) => {
          const d     = ev.fecha
            ? new Date(ev.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })
            : `Eval ${i + 1}`;
          const score = ev.scoring?.scoreFinal != null ? String(ev.scoring.scoreFinal) : '';
          const cat   = ev.scoring?.categoria || '';
          const dot   = cat === 'normal' ? 'tl-dot-ok' : cat === 'sospechoso' ? 'tl-dot-warn' : cat === 'alto_riesgo' ? 'tl-dot-err' : '';

          const btn = document.createElement('button');
          btn.className = `det-tl-pill${i === evalIdx ? ' active' : ''}`;
          btn.title = `Evaluación ${i + 1}${ev.fecha ? ' — ' + new Date(ev.fecha).toLocaleDateString('es-AR') : ''}`;
          btn.innerHTML = `<span class="tl-dot ${dot}"></span><span class="tl-date">${d}</span>${score ? `<span class="tl-score">${score}</span>` : ''}`;
          btn.addEventListener('click', () => Dashboard.verDetalleEvaluacion(id, i));
          pillsWrap.appendChild(btn);
        });

        timelineEl.appendChild(pillsWrap);
        timelineEl.classList.remove('hidden');
      } else {
        timelineEl.classList.add('hidden');
      }
    }

    const p     = pac.paciente || {};
    const sc    = h.scoring   || {};
    const tests = h.tests     || {};
    const detalle = document.getElementById('analisis-detalle');
    if (!detalle) return;
    detalle.classList.remove('hidden');

    // Scroll suave al panel de detalle (especialmente en mobile donde queda debajo)
    requestAnimationFrame(() => {
      detalle.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    // Header
    document.getElementById('det-nombre').textContent = p.nombre || id;
    const eduLabels = { primario: 'Primario', secundario: 'Secundario', universitario: 'Universitario' };
    const edu = eduLabels[p.educacionCategoria] || `Nivel ${p.educacion}`;
    document.getElementById('det-meta').textContent =
      `${p.edad} años · ${p.genero || '—'} · ${edu} · ${p.localidad || '—'}, ${p.provincia || '—'}`;

    // Score
    const catInfo = TEXTOS_CATEGORIA[sc.categoria] || { titulo: sc.categoria, color: sc.color };
    document.getElementById('det-score').textContent = `${sc.scoreFinal ?? '—'} / 32`;
    document.getElementById('det-score').style.color = sc.color || 'var(--text)';
    const catEl = document.getElementById('det-cat');
    catEl.textContent = catInfo.titulo;
    catEl.style.color = sc.color || 'var(--text)';

    const alertaEl = document.getElementById('det-alerta');
    alertaEl.innerHTML = sc.alerta
      ? sc.alerta.split('+').map(a => `<span class="badge badge-red" style="font-size:11px;">${_alertaLabel(a)}</span>`).join(' ')
      : '<span class="badge badge-green" style="font-size:11px;">Sin alertas clínicas</span>';

    // Tabla de tests
    const testsEl = document.getElementById('det-tests');
    testsEl.innerHTML = '';
    const analisis = _analizarTests(tests);
    analisis.forEach(t => {
      const row = document.createElement('div');
      row.className = 'det-test-row';
      const barra = Math.round((t.dominio / 5) * 100);
      const barColor = t.dominio >= 4 ? '#7ab894' : t.dominio >= 3 ? '#d4a85a' : '#c45c5c';
      const icono   = t.dominio >= 4 ? '✓' : t.dominio >= 3 ? '⚠' : '✕';
      const iconoCls = t.dominio >= 4 ? 'ic-ok' : t.dominio >= 3 ? 'ic-warn' : 'ic-err';

      row.innerHTML = `
        <div class="det-test-header">
          <span class="det-test-nombre">${t.nombre}</span>
          <span class="det-test-icono ${iconoCls}">${icono}</span>
          <span class="det-test-dom" style="color:${barColor}">${t.dominio} / 5</span>
        </div>
        <div class="det-test-barra-wrap">
          <div class="det-test-barra-fill" style="width:${barra}%;background:${barColor}"></div>
        </div>
        <ul class="det-test-notas">
          ${t.notas.map(n => `<li class="${n.tipo}">${n.texto}</li>`).join('')}
        </ul>
      `;
      testsEl.appendChild(row);
    });

    // Ajustes de scoring
    const ajustesEl = document.getElementById('det-ajustes');
    const fecha = h.fecha ? new Date(h.fecha).toLocaleDateString('es-AR', { day:'2-digit', month:'long', year:'numeric' }) : '—';
    ajustesEl.innerHTML = `
      <div class="ajuste-row">
        <span>Score ponderado bruto</span>
        <span><strong>${sc.scorePonderado ?? '—'}</strong> / 30</span>
      </div>
      <div class="ajuste-row">
        <span>Ajuste por edad (${p.edad} años)</span>
        <span class="${sc.ajusteEdad > 0 ? 'aj-pos' : sc.ajusteEdad < 0 ? 'aj-neg' : 'aj-neu'}">${sc.ajusteEdad >= 0 ? '+' : ''}${sc.ajusteEdad ?? 0}</span>
      </div>
      <div class="ajuste-row">
        <span>Ajuste por educación (${eduLabels[p.educacionCategoria] || '—'})</span>
        <span class="${sc.ajusteEdu > 0 ? 'aj-pos' : sc.ajusteEdu < 0 ? 'aj-neg' : 'aj-neu'}">${sc.ajusteEdu >= 0 ? '+' : ''}${sc.ajusteEdu ?? 0}</span>
      </div>
      <div class="ajuste-row ajuste-total">
        <span>Score final</span>
        <span style="color:${sc.color || 'var(--text)'}"><strong>${sc.scoreFinal ?? '—'}</strong></span>
      </div>
      <div class="ajuste-row" style="margin-top:6px;border-top:none;padding-top:0;">
        <span style="color:var(--text-s);">Duración del test</span>
        <span style="color:var(--text-s);">${sc.tiempoTotal ? `${sc.tiempoTotal}s (${Math.round(sc.tiempoTotal/60)}m ${sc.tiempoTotal%60}s)` : '—'}</span>
      </div>
      <div class="ajuste-row" style="border-top:none;padding-top:0;">
        <span style="color:var(--text-s);">Fecha de evaluación</span>
        <span style="color:var(--text-s);">${fecha}</span>
      </div>
    `;

    // Comparación con evaluación anterior
    const compEl     = document.getElementById('det-comparacion');
    const compBodyEl = document.getElementById('det-comparacion-body');
    const previo     = evalIdx > 0 ? pac.historial[evalIdx - 1] : null;

    if (previo && previo.scoring) {
      compEl.classList.remove('hidden');
      const diff        = (sc.scoreFinal ?? 0) - (previo.scoring.scoreFinal ?? 0);
      const diffCls     = diff > 0 ? 'aj-pos' : diff < 0 ? 'aj-neg' : 'aj-neu';
      const diffStr     = diff > 0 ? `↑ +${diff.toFixed(1)}` : diff < 0 ? `↓ ${diff.toFixed(1)}` : '→ Sin cambio';
      const prevFecha   = previo.fecha ? new Date(previo.fecha).toLocaleDateString('es-AR') : '—';
      const prevDoms    = previo.scoring.dominios || {};
      const currDoms    = sc.dominios || {};
      const DOMS        = ['memoria','ejecutivo','atencion','lenguaje','velocidad'];
      const DOM_LABELS  = { memoria:'Memoria', ejecutivo:'Ejecutivo', atencion:'Atención', lenguaje:'Lenguaje', velocidad:'Velocidad' };

      compBodyEl.innerHTML = `
        <div class="comp-resumen">
          <div>Score anterior (${prevFecha}): <strong>${previo.scoring.scoreFinal ?? '—'}</strong></div>
          <div>Score actual: <strong style="color:${sc.color}">${sc.scoreFinal ?? '—'}</strong></div>
          <div class="${diffCls}" style="font-weight:500;">${diffStr} pts</div>
        </div>
        <div class="comp-dominios">
          ${DOMS.map(d => {
            const prev = prevDoms[d] ?? 0;
            const curr = currDoms[d] ?? 0;
            const delta = curr - prev;
            const cls   = delta > 0 ? 'aj-pos' : delta < 0 ? 'aj-neg' : 'aj-neu';
            const sym   = delta > 0 ? '↑' : delta < 0 ? '↓' : '→';
            return `<div class="comp-dom-row">
              <span>${DOM_LABELS[d]}</span>
              <span>${prev}/5 → <strong>${curr}/5</strong></span>
              <span class="${cls}">${sym} ${delta > 0 ? '+' : ''}${delta}</span>
            </div>`;
          }).join('')}
        </div>
      `;
    } else {
      compEl.classList.add('hidden');
    }
  },

  cerrarDetalle() {
    document.getElementById('analisis-detalle')?.classList.add('hidden');
    const tl = document.getElementById('det-timeline');
    if (tl) { tl.innerHTML = ''; tl.classList.add('hidden'); }
    document.querySelectorAll('.eval-card').forEach(c => c.classList.remove('active'));
    Dashboard._evalSeleccionada = null;
  },

  /* ---- EXPORTACIONES ---- */
  exportarTodos() {
    const db = obtenerTodosLosPacientes();
    const fecha = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    descargarArchivo(JSON.stringify(db, null, 2), `sinapsis_export_${fecha}.json`, 'application/json');
    AdminConsole.log('Exportación JSON completa');
  },

  exportarZIP() {
    if (typeof JSZip === 'undefined') {
      alert('JSZip no disponible. Verificá la conexión a internet y recargá la página.');
      return;
    }

    const db   = obtenerTodosLosPacientes();
    const zip  = new JSZip();
    const fechaHoy = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    let totalArchivos = 0;

    Object.values(db).forEach(pac => {
      const nombreSlug = (pac.paciente?.nombre || 'paciente')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // strip accents
        .replace(/[^a-z0-9]/gi, '_').toLowerCase();

      pac.historial?.forEach((h, idx) => {
        // Reconstruct an AppState-compatible object for each evaluation
        const evalData = {
          meta:     { ...(h.meta || {}), version: '3.0.0' },
          paciente: pac.paciente,
          tests:    h.tests    || {},
          scoring:  h.scoring  || {},
          palabrasMemorizadas: []
        };

        const fechaEval = h.fecha
          ? new Date(h.fecha).toISOString().slice(0, 10).replace(/-/g, '')
          : `eval${String(idx + 1).padStart(2, '0')}`;

        // Avoid collisions: append index if same patient has two evals on same day
        const filename = `${nombreSlug}_${fechaEval}_${String(idx + 1).padStart(2, '0')}.json`;
        zip.file(filename, JSON.stringify(evalData, null, 2));
        totalArchivos++;
      });
    });

    if (totalArchivos === 0) {
      alert('No hay evaluaciones registradas para exportar.');
      return;
    }

    const logEl = document.getElementById('export-zip-log');
    if (logEl) logEl.textContent = `Generando ZIP con ${totalArchivos} archivo(s)…`;

    zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } })
      .then(blob => {
        const url = URL.createObjectURL(blob);
        const a   = document.createElement('a');
        a.href     = url;
        a.download = `sinapsis_zip_${fechaHoy}.zip`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 3000);
        if (logEl) logEl.textContent = `✅ ZIP generado — ${totalArchivos} archivo(s) exportado(s)`;
        AdminConsole.log(`ZIP exportado: ${totalArchivos} archivos`);
      })
      .catch(err => {
        if (logEl) logEl.textContent = `❌ Error: ${err.message}`;
        AdminConsole.log('Error generando ZIP: ' + err.message);
      });
  },

  limpiarBaseDatos() {
    if (!confirm('¿Eliminar todos los datos guardados? Esta acción no se puede deshacer.')) return;
    localStorage.removeItem(DB_KEY);
    document.getElementById('import-log').textContent = '✅ Base de datos limpiada. Podés reimportar el JSON.';
    Dashboard.render();
  },

  exportarCSV() {
    const db = obtenerTodosLosPacientes();
    const rows = [['nombre','edad','educacion','fecha','score_final','categoria','alerta']];
    Object.values(db).forEach(p => {
      p.historial?.forEach(h => {
        rows.push([
          p.paciente?.nombre    || '',
          p.paciente?.edad      || '',
          p.paciente?.educacionCategoria || p.paciente?.educacion || '',
          h.fecha               || '',
          h.scoring?.scoreFinal ?? '',
          h.scoring?.categoria  || '',
          h.scoring?.alerta     || ''
        ]);
      });
    });
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    descargarArchivo(csv, `sinapsis_${Date.now()}.csv`, 'text/csv');
    AdminConsole.log('Exportación CSV completa');
  }
};

/* ============================================================
   HELPERS DE ANÁLISIS CLÍNICO
   ============================================================ */

function _alertaLabel(a) {
  const MAP = {
    memoria_baja:     'Memoria baja',
    ejecutivo_bajo:   'Ejecutivo bajo',
    caida_progresiva: 'Caída progresiva',
    tiempo_aumentado: 'Tiempo aumentado'
  };
  return MAP[a] || a;
}

// Devuelve array de { nombre, dominio, notas:[{texto, tipo}] } para cada test
function _analizarTests(tests) {
  const t = tests || {};

  /* ---- Atención ---- */
  const at    = t.atencion || {};
  const atErr = (at.total || 10) - (at.aciertos || 0);
  const atNot = [];
  if (atErr === 0)  atNot.push({ texto: 'Detectó todas las figuras sin errores', tipo: 'nota-ok' });
  else              atNot.push({ texto: `${atErr} figura(s) no detectada(s) de 10`, tipo: atErr >= 4 ? 'nota-err' : 'nota-warn' });
  if (at.reaccionMs > 0) {
    if (at.reaccionMs > 4000)      atNot.push({ texto: `Tiempo de reacción lento: ${at.reaccionMs}ms promedio (umbral: 4000ms)`, tipo: 'nota-err' });
    else if (at.reaccionMs > 2500) atNot.push({ texto: `Tiempo de reacción moderado: ${at.reaccionMs}ms promedio`, tipo: 'nota-warn' });
    else                           atNot.push({ texto: `Tiempo de reacción normal: ${at.reaccionMs}ms promedio`, tipo: 'nota-ok' });
  }

  /* ---- Asociación / Lenguaje ---- */
  const as    = t.asociacion || {};
  const asErr = (as.total || 4) - (as.aciertos || 0);
  const asNot = [];
  if (asErr === 0)  asNot.push({ texto: 'Todos los pares correctamente asociados', tipo: 'nota-ok' });
  else              asNot.push({ texto: `${asErr} par(es) sin asociar correctamente de 4`, tipo: asErr >= 2 ? 'nota-err' : 'nota-warn' });
  if ((as.aciertos || 0) < 4) {
    const detalle = [
      '', 'Solo 1/4 pares correctos', '2/4 pares correctos', '3/4 pares correctos'
    ];
    const d = detalle[as.aciertos];
    if (d) asNot.push({ texto: d, tipo: 'nota-warn' });
  }

  /* ---- Memoria diferida ---- */
  const me    = t.memoria || {};
  const meOlv = (me.total || 3) - (me.aciertos || 0);
  const meFal = me.falsos || 0;
  const meNot = [];
  if (meOlv === 0 && meFal === 0) {
    meNot.push({ texto: 'Recordó todas las palabras sin falsos positivos', tipo: 'nota-ok' });
  } else {
    if (meOlv > 0) meNot.push({ texto: `${meOlv} palabra(s) olvidada(s) de 3`, tipo: meOlv >= 2 ? 'nota-err' : 'nota-warn' });
    if (meFal > 0) meNot.push({ texto: `${meFal} falso(s) positivo(s) — palabras recordadas que no estaban en la lista`, tipo: 'nota-warn' });
  }
  if ((me.aciertos || 0) === 0) meNot.push({ texto: '⚠ No recordó ninguna palabra objetivo', tipo: 'nota-err' });

  /* ---- Secuencia / Ejecutivo ---- */
  const se    = t.secuencia || {};
  const seNot = [];
  if (se.correcta) {
    seNot.push({ texto: 'Secuencia completada sin errores', tipo: 'nota-ok' });
  } else {
    seNot.push({ texto: 'Cometió errores en el orden de la secuencia', tipo: 'nota-err' });
  }
  if (se.tiempoSeg > 0) {
    if (se.tiempoSeg > 60)      seNot.push({ texto: `Tiempo elevado: ${se.tiempoSeg}s (> 60s esperado)`, tipo: 'nota-err' });
    else if (se.tiempoSeg > 35) seNot.push({ texto: `Tiempo moderado: ${se.tiempoSeg}s`, tipo: 'nota-warn' });
    else                        seNot.push({ texto: `Tiempo normal: ${se.tiempoSeg}s`, tipo: 'nota-ok' });
  }

  /* ---- Correlación / Velocidad ---- */
  const co    = t.correlacion || {};
  const coErr = (co.total || 5) - (co.aciertos || 0);
  const coNot = [];
  if (coErr === 0)  coNot.push({ texto: 'Todos los símbolos correctamente asignados', tipo: 'nota-ok' });
  else              coNot.push({ texto: `${coErr} símbolo(s) incorrecto(s) de 5`, tipo: coErr >= 3 ? 'nota-err' : 'nota-warn' });
  if (co.tiempoSeg > 0) {
    if (co.tiempoSeg > 120)     coNot.push({ texto: `Tiempo muy elevado: ${co.tiempoSeg}s (umbral 90s)`, tipo: 'nota-err' });
    else if (co.tiempoSeg > 90) coNot.push({ texto: `Tiempo elevado: ${co.tiempoSeg}s`, tipo: 'nota-warn' });
    else                        coNot.push({ texto: `Tiempo normal: ${co.tiempoSeg}s`, tipo: 'nota-ok' });
  }

  return [
    { nombre: 'Atención',           dominio: at.atencion   ?? 0, notas: atNot },
    { nombre: 'Lenguaje / Asoc.',   dominio: as.lenguaje   ?? 0, notas: asNot },
    { nombre: 'Memoria diferida',   dominio: me.memoria    ?? 0, notas: meNot },
    { nombre: 'Secuencia (Ejec.)',  dominio: se.ejecutivo  ?? 0, notas: seNot },
    { nombre: 'Correlación (Vel.)', dominio: co.velocidad  ?? 0, notas: coNot }
  ];
}

/* ============================================================
   DASHBOARD MODELO — Gestión de coeficientes β P(DCL)
   ============================================================ */
const DashboardModelo = {

  init() {
    const cfg = ScoringCuantitativo.cargarConfig();
    this._aplicarConfig(cfg);
  },

  _aplicarConfig(cfg) {
    // Checkbox modo auto
    const chk = document.getElementById('beta-modo-auto');
    if (chk) chk.checked = !!cfg.modoAuto;

    // Inputs β (usa betaAuto si modoAuto, si no usa beta manual)
    const beta = (cfg.modoAuto && cfg.betaAuto) ? cfg.betaAuto : cfg.beta;
    this._setInputs(beta);
    this._toggleInputs(!!cfg.modoAuto);

    // Mostrar info auto
    const infoEl = document.getElementById('beta-auto-info');
    if (infoEl) infoEl.style.display = cfg.modoAuto ? 'block' : 'none';

    // Mostrar β calibrados
    this._mostrarCalibrados(cfg);
  },

  _setInputs(beta) {
    const fields = { 'beta-b0': 'b0', 'beta-b1': 'b1', 'beta-b2': 'b2', 'beta-b3': 'b3' };
    Object.entries(fields).forEach(([id, key]) => {
      const el = document.getElementById(id);
      if (el) el.value = beta[key] !== undefined ? beta[key] : ScoringCuantitativo.getBetaDefault()[key];
    });
  },

  _toggleInputs(disabled) {
    const wrap = document.getElementById('beta-inputs-wrap');
    if (!wrap) return;
    wrap.querySelectorAll('input').forEach(inp => {
      inp.disabled = disabled;
      inp.style.opacity = disabled ? '0.5' : '1';
    });
    const btnGuardar = document.getElementById('btn-beta-guardar');
    if (btnGuardar) btnGuardar.disabled = disabled;
  },

  _mostrarCalibrados(cfg) {
    const wrap = document.getElementById('beta-calibrado-wrap');
    const vals = document.getElementById('beta-calibrado-vals');
    if (!wrap || !vals) return;

    if (cfg.modoAuto && cfg.betaAuto) {
      wrap.style.display = 'block';
      const b = cfg.betaAuto;
      vals.innerHTML = `β₀ = ${b.b0} &nbsp;|&nbsp; β₁ = ${b.b1} &nbsp;|&nbsp; β₂ = ${b.b2} &nbsp;|&nbsp; β₃ = ${b.b3}
        ${cfg.nPacientes ? `<br><span style="color:#7ab894">Calibrado con ${cfg.nPacientes} registros</span>` : ''}`;
    } else {
      wrap.style.display = 'none';
    }
  },

  toggleModoAuto(enabled) {
    const cfg = ScoringCuantitativo.cargarConfig();
    cfg.modoAuto = enabled;

    if (enabled && !cfg.betaAuto) {
      // Intentar calibrar al activar
      this._mostrarStatus('Calibrando con datos del sistema…', '#d4a85a');
      const res = ScoringCuantitativo.calibrar();
      if (res.ok) {
        cfg.betaAuto   = res.beta;
        cfg.calibrado  = true;
        cfg.nPacientes = res.n;
        ScoringCuantitativo.guardarConfig(cfg);
        this._mostrarStatus(`✓ Calibración exitosa con ${res.n} registros.`, '#7ab894');
      } else {
        this._mostrarStatus(`⚠️ ${res.msg}`, '#d4a85a');
        cfg.modoAuto = false;
        const chk = document.getElementById('beta-modo-auto');
        if (chk) chk.checked = false;
      }
    } else {
      ScoringCuantitativo.guardarConfig(cfg);
    }

    this._aplicarConfig(cfg);
  },

  onBetaChange() {
    // Solo acción visual — guardar al presionar el botón
  },

  guardar() {
    const cfg = ScoringCuantitativo.cargarConfig();
    cfg.beta = {
      b0: parseFloat(document.getElementById('beta-b0')?.value) || 0,
      b1: parseFloat(document.getElementById('beta-b1')?.value) || 0,
      b2: parseFloat(document.getElementById('beta-b2')?.value) || 0,
      b3: parseFloat(document.getElementById('beta-b3')?.value) || 0
    };
    ScoringCuantitativo.guardarConfig(cfg);
    this._mostrarStatus('✓ Coeficientes β guardados correctamente.', '#7ab894');
    AdminConsole.log(`β guardados: ${JSON.stringify(cfg.beta)}`);
  },

  calibrar() {
    this._mostrarStatus('Calibrando…', '#d4a85a');
    const res = ScoringCuantitativo.calibrar();
    if (res.ok) {
      const cfg = ScoringCuantitativo.cargarConfig();
      this._mostrarStatus(`✓ Calibración exitosa con ${res.n} registros. β=[${res.beta.b0}, ${res.beta.b1}, ${res.beta.b2}, ${res.beta.b3}]`, '#7ab894');
      this._aplicarConfig(cfg);
    } else {
      this._mostrarStatus(`⚠️ ${res.msg || 'No se pudo calibrar'}`, '#d4a85a');
    }
  },

  resetDefaults() {
    const defaults = ScoringCuantitativo.getBetaDefault();
    this._setInputs(defaults);
    const cfg = ScoringCuantitativo.cargarConfig();
    cfg.beta = { ...defaults };
    ScoringCuantitativo.guardarConfig(cfg);
    this._mostrarStatus('Valores por defecto restaurados.', '#7ab894');
  },

  _mostrarStatus(msg, color) {
    const el = document.getElementById('beta-status');
    if (!el) return;
    el.style.display = 'block';
    el.style.color   = color || 'var(--text)';
    el.textContent   = msg;
  }
};

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  AdminConsole.init();
  DashboardModelo.init();

  // Restaurar tema guardado
  try {
    if (localStorage.getItem('sinapsis-theme') === 'light') {
      document.body.classList.add('light');
      const btn = document.getElementById('theme-toggle-btn');
      if (btn) { btn.textContent = '🌙'; btn.title = 'Cambiar a modo oscuro'; }
    }
  } catch(e) {}

  const p0 = document.getElementById('paso-0');
  if (p0) p0.classList.add('active');

  AdminConsole.log('App iniciada v3.0.0');
});
