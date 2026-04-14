/* tts.js — Text-to-Speech con Web Speech API para Sinapsis 5
   Sin librerías externas. Voz femenina, preferencia latinoamericana. */
'use strict';

const TTS = (() => {
  let muted = false;
  let selectedVoice = null;

  /* ── Estilos del botón mute ── */
  (function injectStyles() {
    const s = document.createElement('style');
    s.textContent = `
      .tts-mute-btn {
        background: none;
        border: 1.5px solid rgba(255,255,255,0.12);
        border-radius: 8px;
        color: var(--text-s, #aaa);
        cursor: pointer;
        font-size: 16px;
        height: 36px;
        line-height: 1;
        padding: 0 10px;
        transition: background 0.18s, color 0.18s, border-color 0.18s;
        margin-right: -4px;
        user-select: none;
      }
      .tts-mute-btn:hover {
        background: rgba(255,255,255,0.06);
        color: var(--text, #fff);
        border-color: rgba(255,255,255,0.22);
      }
      .tts-mute-btn:active {
        background: rgba(255,255,255,0.12);
      }
      .tts-mute-btn.muted {
        color: rgba(255,255,255,0.3);
        border-color: rgba(255,255,255,0.06);
      }
    `;
    document.head.appendChild(s);
  })();

  /* ── Selección de voz: femenina, latinoamericana primero ── */
  function loadVoice() {
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return;

    // Códigos de español latinoamericano (sin España)
    const latinLangs = [
      'es-MX','es-AR','es-US','es-CO','es-CL','es-PE','es-VE',
      'es-419','es-UY','es-EC','es-BO','es-PY','es-CR','es-GT',
      'es-HN','es-NI','es-PA','es-PR','es-SV','es-DO','es-CU'
    ];
    // Nombres comunes en voces femeninas (macOS: Paulina, Luciana; Windows: Sabina, etc.)
    const femaleKeywords = [
      'paulina','luciana','lupe','sabina','marisol','valentina',
      'gabriela','isabel','camila','sofia','maria','ana','rosa',
      'female','woman','mujer'
    ];

    const isFemale = v => femaleKeywords.some(k => v.name.toLowerCase().includes(k));
    const isLatam  = v => latinLangs.includes(v.lang);

    // Prioridad 1: femenina latinoamericana
    selectedVoice = voices.find(v => isLatam(v) && isFemale(v));
    // Prioridad 2: cualquier latinoamericana
    if (!selectedVoice) selectedVoice = voices.find(isLatam);
    // Prioridad 3: femenina en español (cualquier variante)
    if (!selectedVoice) selectedVoice = voices.find(v => v.lang.startsWith('es') && isFemale(v));
    // Prioridad 4: cualquier español
    if (!selectedVoice) selectedVoice = voices.find(v => v.lang.startsWith('es'));

    console.log('[TTS] Voz seleccionada:', selectedVoice?.name, selectedVoice?.lang);
  }

  /* ── Hablar ── */
  function speak(text) {
    if (muted || !text || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    // Usar el lang de la voz elegida; si no hay, hint a es-MX (más neutro)
    u.lang   = selectedVoice ? selectedVoice.lang : 'es-MX';
    u.pitch  = 1;
    u.rate   = 0.95;
    u.volume = 1;
    if (selectedVoice) u.voice = selectedVoice;
    window.speechSynthesis.speak(u);
  }

  /* ── Toggle mute ── */
  function toggleMute() {
    muted = !muted;
    const btn = document.getElementById('tts-mute-btn');
    if (btn) {
      btn.textContent = muted ? '🔇' : '🔊';
      btn.title       = muted ? 'Activar voz' : 'Silenciar voz';
      btn.classList.toggle('muted', muted);
    }
    if (muted) window.speechSynthesis.cancel();
  }

  /* ── Botón en el header ── */
  function addMuteButton() {
    const header = document.getElementById('app-header');
    if (!header || document.getElementById('tts-mute-btn')) return;
    const btn = document.createElement('button');
    btn.id          = 'tts-mute-btn';
    btn.className   = 'tts-mute-btn';
    btn.textContent = '🔊';
    btn.title       = 'Silenciar voz';
    btn.onclick     = toggleMute;
    header.appendChild(btn);
  }

  /* ── Patches ── */
  function patchApp() {
    if (typeof App === 'undefined') return;

    /* PASO 2 — Memorización: leer palabras en cuanto están disponibles.
       El display aparece ~300ms después (fade-in en paso2Init),
       así que hablar de inmediato sincroniza audio con visión. */
    const origPaso2 = App.paso2Init.bind(App);
    App.paso2Init = function () {
      origPaso2();
      // AppState.palabrasMemorizadas ya está cargado al salir de origPaso2
      const words = AppState.palabrasMemorizadas;
      if (words && words.length) {
        speak('Recordá estas palabras: ' + words.join('… '));
      }
    };

    /* TEST 1 — Atención: solo la instrucción */
    const origT1 = T1.init.bind(T1);
    T1.init = function () {
      origT1();
      speak('Tocá la figura cada vez que aparezca.');
    };

    /* TEST 2 — Asociación: instrucción + leer palabras al seleccionarlas */
    const origT2 = T2.init.bind(T2);
    T2.init = function () {
      origT2();
      speak('Uní cada palabra con su imagen.');
    };

    // Leer la palabra cuando el usuario la toca (no los emojis)
    const origT2SelectWord = T2.selectWord.bind(T2);
    T2.selectWord = function (el, val) {
      origT2SelectWord(el, val);
      if (!el.classList.contains('matched-correct')) {
        speak(val);
      }
    };

    /* TEST 3 — Memoria diferida: instrucción + leer palabra al seleccionarla */
    const origT3 = T3.init.bind(T3);
    T3.init = function () {
      origT3();
      speak('Seleccioná las palabras que viste al principio.');
    };

    // Leer la palabra cuando se toca (solo al agregar, no al deseleccionar)
    const origT3Toggle = T3.toggle.bind(T3);
    T3.toggle = function (el, word) {
      const wasSelected = T3.selected.has(word);
      origT3Toggle(el, word);
      // Solo hablar si la acción fue seleccionar (no deseleccionar)
      if (!wasSelected && T3.selected.has(word)) {
        speak(word);
      }
    };

    /* TEST 4 — Secuencia: instrucción dinámica (variant A o B),
       ya seteada en el DOM al terminar origT4() */
    const origT4 = T4.init.bind(T4);
    T4.init = function () {
      origT4();
      const instruc = document.getElementById('t4-instruccion')?.textContent || '';
      speak(instruc);
    };

    /* TEST 5 — Correlación */
    const origT5 = T5.init.bind(T5);
    T5.init = function () {
      origT5();
      speak('Según la tabla, indicá qué número corresponde a cada símbolo.');
    };
  }

  /* ── Init ── */
  function init() {
    if (!window.speechSynthesis) return;

    // Las voces pueden llegar async (especialmente en Chrome)
    if (window.speechSynthesis.getVoices().length) {
      loadVoice();
    } else {
      window.speechSynthesis.addEventListener('voiceschanged', loadVoice);
    }

    addMuteButton();
    patchApp();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { speak, toggleMute, isMuted: () => muted };
})();
