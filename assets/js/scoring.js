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
