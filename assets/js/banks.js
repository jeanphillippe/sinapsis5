/* banks.js — Content banks for Sinapsis 5 */

const BANK_PALABRAS = [
  "CASA","PERRO","ÁRBOL","LUNA","MESA","LIBRO","AGUA","FUEGO","CIELO","PUERTA",
  "RELOJ","FLOR","PAN","SOL","VELA","LLAVE","SILLA","PÁJARO","CARTA","PIEDRA",
  "TREN","NUBE","FRUTA","COCHE","BOTE","PATO","MANO","GATO","ROCA","CAMA",
  "VINO","PALO","LAGO","HOJA","VASO","COPA","FARO","TUBO","DADO","HACHA",
  "POZO","MAPA","CODO","RAMO","FILO","BOCA","TEJA","PINO","TAZA","NIDO"
];

const BANK_FORMAS = ["circle","star","square","triangle"];

const BANK_PARES = [
  {w:"PERRO",   e:"🐶"}, {w:"SOL",    e:"☀️"}, {w:"ÁRBOL",  e:"🌳"}, {w:"CASA",   e:"🏠"},
  {w:"LUNA",    e:"🌙"}, {w:"LIBRO",  e:"📚"}, {w:"FLOR",   e:"🌸"}, {w:"FUEGO",  e:"🔥"},
  {w:"AGUA",    e:"💧"}, {w:"PÁJARO", e:"🐦"}, {w:"MONTAÑA",e:"⛰️"}, {w:"NIEVE",  e:"❄️"},
  {w:"BARCO",   e:"⛵"}, {w:"TREN",   e:"🚂"}, {w:"AVIÓN",  e:"✈️"}, {w:"RELOJ",  e:"⏰"},
  {w:"ESTRELLA",e:"⭐"}, {w:"CORAZÓN",e:"❤️"}, {w:"GUITARRA",e:"🎸"},{w:"FÚTBOL", e:"⚽"},
  {w:"CONEJO",  e:"🐰"}, {w:"MANZANA",e:"🍎"}, {w:"PESCADO",e:"🐟"}, {w:"MARIPOSA",e:"🦋"},
  {w:"TAZA",    e:"☕"}, {w:"LÁPIZ",  e:"✏️"}, {w:"LLAVE",  e:"🔑"}, {w:"CORONA", e:"👑"}
];

const BANK_SETS = [
  { m: {"★":1, "♦":2, "●":3, "▲":4, "✿":5} },
  { m: {"◆":1, "♥":2, "☾":3, "✚":4, "⬟":5} },
  { m: {"⚡":1, "♞":2, "⬡":3, "✦":4, "❋":5} },
  { m: {"⬤":1, "⊕":2, "◉":3, "⬦":4, "☆":5} },
  { m: {"⊗":1, "⬠":2, "◈":3, "✧":4, "⬢":5} },
  { m: {"♠":1, "⊞":2, "⬭":3, "✡":4, "⬪":5} },
  { m: {"⚫":1, "✤":2, "⬕":3, "◇":4, "⬘":5} },
  { m: {"☗":1, "✦":2, "◰":3, "⬱":4, "⊛":5} }
];
