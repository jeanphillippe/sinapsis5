/* scoring.js — Score calculation for Sinapsis 5 v3 */

const PESOS = { memoria: 1.5, ejecutivo: 1.3, atencion: 1.0, lenguaje: 1.0, velocidad: 1.2 };

const TEXTOS_CATEGORIA = {
  normal:      { titulo: 'Resultado dentro de lo esperado', color: '#7ab894' },
  sospechoso:  { titulo: 'Se detectaron cambios leves',     color: '#d4a85a' },
  alto_riesgo: { titulo: 'Se recomienda evaluación médica', color: '#c45c5c' }
};

function mapearEducacion(eduVal) {
  const v = parseInt(eduVal);
  if (isNaN(v)) return 'primario';
  if (v <= 3) return 'primario';
  if (v <= 5) return 'secundario';
  return 'universitario';
}

const AJUSTE_EDAD = (edad) => {
  if (edad >= 60 && edad <= 69) return 1;
  if (edad >= 70 && edad <= 79) return 0;
  if (edad >= 80) return -1;
  return 0; // menores de 60: sin ajuste
};

const AJUSTE_EDU = (edu) => {
  if (edu === 'universitario') return 0;
  if (edu === 'secundario') return -1;
  if (edu === 'primario') return -2;
  return 0;
};

function extraerDominios(state) {
  return {
    memoria:   (state.tests.memoria    && state.tests.memoria.memoria    !== undefined) ? state.tests.memoria.memoria    : 0,
    ejecutivo: (state.tests.secuencia  && state.tests.secuencia.ejecutivo !== undefined) ? state.tests.secuencia.ejecutivo : 0,
    atencion:  (state.tests.atencion   && state.tests.atencion.atencion   !== undefined) ? state.tests.atencion.atencion   : 0,
    lenguaje:  (state.tests.asociacion && state.tests.asociacion.lenguaje  !== undefined) ? state.tests.asociacion.lenguaje  : 0,
    velocidad: (state.tests.correlacion && state.tests.correlacion.velocidad !== undefined) ? state.tests.correlacion.velocidad : 0
  };
}

function calcularErroresTotal(state) {
  return (state.tests.memoria.falsos || 0) +
         (state.tests.secuencia.correcta === false ? 2 : 0);
}

function calcularScoring(state) {
  const { memoria, ejecutivo, atencion, lenguaje, velocidad } = extraerDominios(state);
  const edad = parseInt(state.paciente.edad);
  const eduCategoria = state.paciente.educacionCategoria || mapearEducacion(state.paciente.educacion);

  // Score ponderado: rango aprox 0–30
  const scorePonderado =
    (memoria   * PESOS.memoria)   +
    (ejecutivo * PESOS.ejecutivo) +
    (atencion  * PESOS.atencion)  +
    (lenguaje  * PESOS.lenguaje)  +
    (velocidad * PESOS.velocidad);

  const ajusteEdad = AJUSTE_EDAD(edad);
  const ajusteEdu  = AJUSTE_EDU(eduCategoria);
  const scoreFinal = Math.round((scorePonderado + ajusteEdad + ajusteEdu) * 10) / 10;

  // Clasificación
  let categoria, color;
  if (scoreFinal >= 26)      { categoria = 'normal';      color = '#7ab894'; }
  else if (scoreFinal >= 22) { categoria = 'sospechoso';  color = '#d4a85a'; }
  else                       { categoria = 'alto_riesgo'; color = '#c45c5c'; }

  // Alertas clínicas (override independiente de categoria)
  let alerta = null;
  if (memoria <= 2)   alerta = 'memoria_baja';
  if (ejecutivo <= 2) alerta = alerta ? alerta + '+ejecutivo_bajo' : 'ejecutivo_bajo';

  // Comparación longitudinal (test previo en localStorage)
  const idPaciente = state.paciente.telefono || state.paciente.nombre;
  const previo = _obtenerTestPrevioById(idPaciente);
  let caida = null;
  if (previo && previo.scoring) {
    caida = Math.round(((previo.scoring.scoreFinal || 0) - scoreFinal) * 10) / 10;
    if (caida >= 3) alerta = alerta ? alerta + '+caida_progresiva' : 'caida_progresiva';
  }

  // Índice compuesto
  const tiempoTotal  = state.meta.duracionSeg || 0;
  const erroresTotal = calcularErroresTotal(state);
  const scoreNorm    = scoreFinal / 32;
  const velInversa   = velocidad > 0 ? (1 / (velocidad + 1)) : 1;
  const indiceCognitivo = Math.round(((scoreNorm - velInversa - erroresTotal * 0.05) * 100) / 100 * 10) / 10;

  // Alerta por tiempo (mismo score pero más lento que test previo)
  if (previo && previo.meta && caida !== null && caida === 0 && tiempoTotal > previo.meta.duracionSeg * 1.5) {
    alerta = alerta ? alerta + '+tiempo_aumentado' : 'tiempo_aumentado';
    if (categoria === 'normal') categoria = 'sospechoso';
  }

  return {
    dominios:        { memoria, ejecutivo, atencion, lenguaje, velocidad },
    scorePonderado:  Math.round(scorePonderado * 10) / 10,
    ajusteEdad,
    ajusteEdu,
    scoreFinal,
    max: 32,
    categoria,
    color,
    alerta,
    caida,
    indiceCognitivo,
    tiempoTotal,
    erroresTotal,
    // Legacy compatibility fields
    final:    scoreFinal,
    base:     Math.round(scorePonderado * 100) / 100,
    multEdad: 1,
    multEdu:  1,
    bonusTiempo: 0
  };
}

// Internal helper (uses localStorage directly to avoid circular dep with app.js)
function _obtenerTestPrevioById(id) {
  try {
    const db = JSON.parse(localStorage.getItem('sinapsis_pacientes') || '{}');
    const historial = db[id]?.historial;
    if (!historial || historial.length < 2) return null;
    return historial[historial.length - 2];
  } catch (e) {
    return null;
  }
}

const Scoring = {
  calcAll() {
    const S = AppState;
    const result = calcularScoring(S);
    Object.assign(S.scoring, result);

    if (typeof AdminConsole !== 'undefined') {
      AdminConsole.log(
        `Scoring v3: pond=${result.scorePonderado} edad=${result.ajusteEdad} edu=${result.ajusteEdu} = ${result.scoreFinal} [${result.categoria}]`
      );
      AdminConsole.refresh();
    }

    return S.scoring;
  }
};

/* ============================================================
   MODELO CUANTITATIVO COGNITIVO — v1
   Normalización por dominio + Score ponderado normalizado +
   Riesgo logístico P(DCL) + Componente longitudinal +
   Modelo digital extendido (opcional)
   ============================================================ */

// Máximos por dominio (0–5 según tests.js)
const MAX_DOMINIOS_NORM = { memoria: 5, ejecutivo: 5, atencion: 5, lenguaje: 5, velocidad: 5 };

// Pesos para SC_norm (suma = 1.0)
// Memoria=0.30, Ejecutivo=0.25, Atención=0.20, Lenguaje=0.15, Orientación/Velocidad=0.10
const PESOS_NORM = { memoria: 0.30, ejecutivo: 0.25, atencion: 0.20, lenguaje: 0.15, velocidad: 0.10 };

// Coeficientes β por defecto (literatura)
const BETA_DEFAULT = { b0: 1.5, b1: -3.2, b2: 0.04, b3: -0.10 };

// Coeficientes digitales por defecto (α, β_e, γ)
const COEF_DIGITAL_DEFAULT = { alpha: 0.15, beta_e: 0.20, gamma: 0.10 };

// Clave localStorage para config β
const BETA_STORAGE_KEY = 'sinapsis_beta_config';

// Educación → años estimados (para modelo logístico)
const EDU_ANIOS = { primario: 6, secundario: 12, universitario: 17 };

/* ── Normalización ── */
function normalizarDominios(dominios) {
  return {
    memoria:   dominios.memoria   / MAX_DOMINIOS_NORM.memoria,
    ejecutivo: dominios.ejecutivo / MAX_DOMINIOS_NORM.ejecutivo,
    atencion:  dominios.atencion  / MAX_DOMINIOS_NORM.atencion,
    lenguaje:  dominios.lenguaje  / MAX_DOMINIOS_NORM.lenguaje,
    velocidad: dominios.velocidad / MAX_DOMINIOS_NORM.velocidad
  };
}

/* ── SC_norm ponderado ── */
function calcularSCNorm(dominiosNorm) {
  return (
    PESOS_NORM.memoria   * dominiosNorm.memoria   +
    PESOS_NORM.ejecutivo * dominiosNorm.ejecutivo +
    PESOS_NORM.atencion  * dominiosNorm.atencion  +
    PESOS_NORM.lenguaje  * dominiosNorm.lenguaje  +
    PESOS_NORM.velocidad * dominiosNorm.velocidad
  );
}

/* ── Modelo logístico P(DCL) ── */
function calcularPDCL(scNorm, edad, eduCategoria, beta) {
  const eduAnios = EDU_ANIOS[eduCategoria] || 12;
  const z = beta.b0 + beta.b1 * scNorm + beta.b2 * edad + beta.b3 * eduAnios;
  const pDCL = 1 / (1 + Math.exp(-z));
  let riesgo;
  if (pDCL < 0.20)      riesgo = 'bajo';
  else if (pDCL <= 0.50) riesgo = 'intermedio';
  else                   riesgo = 'alto';
  return { pDCL: Math.round(pDCL * 1000) / 1000, riesgo };
}

/* ── Componente longitudinal ── */
function calcularLongitudinal(scNorm, idPaciente) {
  try {
    const db      = JSON.parse(localStorage.getItem('sinapsis_pacientes') || '{}');
    const historial = db[idPaciente]?.historial;
    if (!historial || historial.length < 2) return null;

    // SC_norm de sesiones anteriores
    const sesiones = historial
      .filter(h => h.scoring && h.fecha)
      .map(h => ({
        fecha:  new Date(h.fecha),
        scNorm: (h.scoring.scNorm !== undefined)
          ? h.scoring.scNorm
          : _recalcSCNorm(h.scoring)
      }))
      .sort((a, b) => a.fecha - b.fecha);

    if (sesiones.length < 1) return null;

    const primera  = sesiones[0];
    const anterior = sesiones[sesiones.length - 1];
    const ahora    = new Date();

    // ΔSC entre sesión actual y anterior
    const deltaSC = Math.round((scNorm - anterior.scNorm) * 1000) / 1000;

    // ID = (SC_actual − SC_0) / Δmeses
    const mesesDesde0 = Math.max(0.1,
      (ahora - primera.fecha) / (1000 * 60 * 60 * 24 * 30.44)
    );
    const indiceDeclive = Math.round(((scNorm - primera.scNorm) / mesesDesde0) * 10000) / 10000;

    const alertaLong = indiceDeclive <= -0.05 ? true : false;

    return { deltaSC, indiceDeclive, alertaLong, sesionesCount: sesiones.length + 1 };
  } catch (e) {
    return null;
  }
}

// Re-calcula SC_norm desde un resultado previo (puede no tener scNorm guardado)
function _recalcSCNorm(scoring) {
  if (!scoring || !scoring.dominios) return 0;
  const d = scoring.dominios;
  const dn = {
    memoria:   (d.memoria   || 0) / 5,
    ejecutivo: (d.ejecutivo || 0) / 5,
    atencion:  (d.atencion  || 0) / 5,
    lenguaje:  (d.lenguaje  || 0) / 5,
    velocidad: (d.velocidad || 0) / 5
  };
  return calcularSCNorm(dn);
}

/* ── Modelo digital extendido (complementario) ── */
function calcularSCDigital(scNorm, tiempoTotal, erroresTotal, variabilidadMs, coefs) {
  const c = coefs || COEF_DIGITAL_DEFAULT;
  // Normalizar entradas al rango [0,1]
  const T = Math.min(1, tiempoTotal / 600);                         // ref: 600s máx
  const E = Math.min(1, erroresTotal / 10);                         // ref: 10 errores máx
  const V = Math.min(1, (variabilidadMs || 0) / 3000);              // ref: 3000ms máx
  const scDigital = Math.max(0, scNorm - c.alpha * T - c.beta_e * E - c.gamma * V);
  return Math.round(scDigital * 1000) / 1000;
}

/* ── Cargar β desde localStorage ── */
function cargarBetaConfig() {
  try {
    const raw = localStorage.getItem(BETA_STORAGE_KEY);
    if (!raw) return { beta: { ...BETA_DEFAULT }, modoAuto: false, calibrado: false };
    const cfg = JSON.parse(raw);
    return {
      beta:      cfg.beta      || { ...BETA_DEFAULT },
      modoAuto:  cfg.modoAuto  || false,
      calibrado: cfg.calibrado || false,
      betaAuto:  cfg.betaAuto  || null,
      nPacientes:cfg.nPacientes|| 0
    };
  } catch (e) {
    return { beta: { ...BETA_DEFAULT }, modoAuto: false, calibrado: false };
  }
}

/* ── Guardar β en localStorage ── */
function guardarBetaConfig(cfg) {
  try {
    localStorage.setItem(BETA_STORAGE_KEY, JSON.stringify(cfg));
  } catch (e) { /* silencioso */ }
}

/* ── Calibración automática por regresión logística ── */
function calibrarBetaLogistico() {
  try {
    const db = JSON.parse(localStorage.getItem('sinapsis_pacientes') || '{}');
    // Recolectar registros con diagnóstico confirmado
    const muestras = [];
    Object.values(db).forEach(pac => {
      (pac.historial || []).forEach(h => {
        if (h.scoring && h.meta && h.meta.diagnosticoConfirmado !== undefined) {
          const y     = h.meta.diagnosticoConfirmado ? 1 : 0;
          const sc    = (h.scoring.scNorm !== undefined) ? h.scoring.scNorm : _recalcSCNorm(h.scoring);
          const edad  = parseInt(pac.paciente?.edad || 65);
          const edu   = EDU_ANIOS[pac.paciente?.educacionCategoria || 'secundario'] || 12;
          muestras.push({ y, sc, edad, edu });
        }
      });
    });

    const MIN_MUESTRAS = 30;
    if (muestras.length < MIN_MUESTRAS) {
      return {
        ok:      false,
        msg:     `Dataset insuficiente: ${muestras.length} registros con diagnóstico (mínimo ${MIN_MUESTRAS})`,
        n:       muestras.length
      };
    }

    // Descenso de gradiente para regresión logística
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0;
    const lr   = 0.05;
    const iter = 2000;

    for (let i = 0; i < iter; i++) {
      let g0 = 0, g1 = 0, g2 = 0, g3 = 0;
      muestras.forEach(({ y, sc, edad, edu }) => {
        const z    = b0 + b1 * sc + b2 * edad + b3 * edu;
        const pred = 1 / (1 + Math.exp(-z));
        const err  = pred - y;
        g0 += err;
        g1 += err * sc;
        g2 += err * edad;
        g3 += err * edu;
      });
      const n = muestras.length;
      b0 -= lr * g0 / n;
      b1 -= lr * g1 / n;
      b2 -= lr * g2 / n;
      b3 -= lr * g3 / n;
    }

    const betaCalibrado = {
      b0: Math.round(b0 * 10000) / 10000,
      b1: Math.round(b1 * 10000) / 10000,
      b2: Math.round(b2 * 10000) / 10000,
      b3: Math.round(b3 * 10000) / 10000
    };

    return { ok: true, beta: betaCalibrado, n: muestras.length };
  } catch (e) {
    return { ok: false, msg: 'Error en calibración: ' + e.message };
  }
}

/* ── Función principal del modelo cuantitativo ── */
function calcularScoringCuantitativo(state) {
  const dominios    = extraerDominios(state);
  const dominiosNorm = normalizarDominios(dominios);
  const scNorm      = Math.round(calcularSCNorm(dominiosNorm) * 10000) / 10000;

  const edad        = parseInt(state.paciente.edad) || 65;
  const eduCategoria= state.paciente.educacionCategoria || mapearEducacion(state.paciente.educacion);

  // Cargar β (manual o calibrado)
  const cfg  = cargarBetaConfig();
  const beta = (cfg.modoAuto && cfg.betaAuto) ? cfg.betaAuto : cfg.beta;

  // P(DCL) y clasificación de riesgo
  const { pDCL, riesgo } = calcularPDCL(scNorm, edad, eduCategoria, beta);

  // Componente longitudinal
  const idPaciente = state.paciente.telefono || state.paciente.nombre;
  const longitudinal = calcularLongitudinal(scNorm, idPaciente);

  // Alerta longitudinal
  let alertaLong = false;
  if (longitudinal) {
    alertaLong = longitudinal.alertaLong ||
      (longitudinal.deltaSC !== undefined && longitudinal.deltaSC <= -0.10);
  }

  // Modelo digital (si hay tiempos disponibles)
  const tiempoTotal  = state.meta.duracionSeg || 0;
  const erroresTotal = calcularErroresTotal(state);
  const variabilidadMs = state.tests.atencion?.reaccionMs || 0;
  const scDigital    = calcularSCDigital(scNorm, tiempoTotal, erroresTotal, variabilidadMs, null);

  // Desglose normalizado por dominio (para mostrar en pantalla)
  const dominiosNormRedondeados = {};
  Object.keys(dominiosNorm).forEach(k => {
    dominiosNormRedondeados[k] = Math.round(dominiosNorm[k] * 100) / 100;
  });

  return {
    scNorm,
    dominiosNorm: dominiosNormRedondeados,
    pDCL,
    riesgo,
    betaUsada: beta,
    modoAuto: cfg.modoAuto,
    longitudinal,
    alertaLong,
    scDigital
  };
}

const ScoringCuantitativo = {
  calcAll(state) {
    const S = state || AppState;
    const result = calcularScoringCuantitativo(S);
    // Merge into AppState.scoring
    Object.assign(S.scoring, result);

    if (typeof AdminConsole !== 'undefined') {
      AdminConsole.log(
        `Cuant: SC_norm=${result.scNorm} P(DCL)=${result.pDCL} riesgo=${result.riesgo} β=[${result.betaUsada.b0},${result.betaUsada.b1},${result.betaUsada.b2},${result.betaUsada.b3}]`
      );
    }
    return result;
  },

  calibrar() {
    const res = calibrarBetaLogistico();
    if (res.ok) {
      const cfg = cargarBetaConfig();
      cfg.betaAuto  = res.beta;
      cfg.calibrado = true;
      cfg.nPacientes= res.n;
      guardarBetaConfig(cfg);
      if (typeof AdminConsole !== 'undefined') {
        AdminConsole.log(`Calibración OK: n=${res.n} β=[${res.beta.b0},${res.beta.b1},${res.beta.b2},${res.beta.b3}]`);
      }
    } else {
      if (typeof AdminConsole !== 'undefined') {
        AdminConsole.log('Calibración: ' + (res.msg || 'error'));
      }
    }
    return res;
  },

  guardarConfig(cfg) {
    guardarBetaConfig(cfg);
  },

  cargarConfig() {
    return cargarBetaConfig();
  },

  getBetaDefault() {
    return { ...BETA_DEFAULT };
  }
};
