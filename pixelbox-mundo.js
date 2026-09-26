/* PixelBox — el mundo: terreno, criaturas, pueblos, facciones y sus reglas.
   El dibujo y la interfaz viven en pixelbox-juego.js */

/* ============================================================
   1. Utilidades
   ============================================================ */
function randi(n) { return (Math.random() * n) | 0; }
function chance(p) { return Math.random() < p; }
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function pick(a) { return a[(Math.random() * a.length) | 0]; }
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function d2(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; }
function suave(t) { return t * t * (3 - 2 * t); }

const S1 = ["ka", "tor", "mir", "val", "zan", "bel", "nor", "ras", "tul", "ede", "sar", "mok",
  "lir", "dun", "fen", "gor", "ish", "yal", "ain", "urd", "vel", "kor", "sil", "tan"];
const S2 = ["dan", "ria", "mok", "tir", "sel", "dor", "nia", "lak", "vim", "ros", "tha", "gan",
  "wen", "dir", "zul", "mae", "kar", "non", "beth", "rim"];
const S3 = ["", "", "a", "o", "en", "is", "ar", "ek"];
function nombrePersona() { return cap(pick(S1) + pick(S2) + pick(S3)); }
function nombrePueblo() { return cap(pick(S1) + pick(["burgo", "dal", "heim", "var", "mora", "stad", "kar", "tepec", "ria", "gard", "wick"])); }
function nombreFaccion() { return pick(["Clan", "Tribu", "Casa", "Hijos de", "Pueblo"]) + " " + cap(pick(S1) + pick(S2)); }

/* ============================================================
   2. Constantes del mundo
   ============================================================ */
const COLS = 150, ROWS = 90, TILE = 24;
const U = TILE / 12;                       // escala: las distancias en píxeles se miden en esta unidad
const W_PX = COLS * TILE, H_PX = ROWS * TILE, NT = COLS * ROWS;
const TICKS_DIA = 100;
const MAX_HUM = 900, MAX_ANI = 340;

const T = { DEEP: 0, WATER: 1, SAND: 2, GRASS: 3, DRY: 4, MOUNT: 5, SNOW: 6, ASH: 7, LAVA: 8, ICE: 9, FARM: 10, PLAZA: 11 };
const NOMBRE_TILE = ["Océano", "Agua", "Arena", "Pradera", "Estepa seca", "Montaña", "Nieve",
  "Ceniza", "Lava", "Hielo", "Cultivo", "Plaza"];

/* cuánto arde cada terreno: la hierba prende mal, los árboles bien.
   Mantener estos valores bajos es lo que evita que un rayo queme el mundo entero. */
const COMBUSTIBLE = [0, 0, 0, 0.14, 0.26, 0, 0, 0, 0, 0, 0.18, 0];

const ARB = { PINO: 1, ROBLE: 2, PALMA: 3 };
const NOMBRE_ARB = ["", "Pino", "Roble", "Palmera"];
const ED = { CHOZA: 1, CASA: 2, GRANERO: 3, TEMPLO: 4, TORRE: 5, RUINA: 6 };
const NOMBRE_ED = ["", "Choza", "Casa", "Granero", "Templo", "Torre", "Ruinas"];
const NIVEL_PUEBLO = ["", "Caserío", "Aldea", "Pueblo", "Ciudad"];

const ESPECIES = {
  oveja: { n: "Oveja", tipo: "herb", vel: 0.55, vida: 16, repro: 0.0013, max: 85, col: "#f1f5f9", col2: "#cbd5e1" },
  conejo: { n: "Conejo", tipo: "herb", vel: 0.85, vida: 8, repro: 0.0024, max: 80, col: "#d8ccb8", col2: "#a3937a" },
  ciervo: { n: "Ciervo", tipo: "herb", vel: 0.95, vida: 22, repro: 0.0009, max: 65, col: "#b0784e", col2: "#6f4a2f" },
  lobo: { n: "Lobo", tipo: "carn", vel: 1.05, vida: 28, atk: 6, repro: 0.0005, max: 32, col: "#808b99", col2: "#4b5563", presas: ["oveja", "conejo", "ciervo"] },
  oso: { n: "Oso", tipo: "carn", vel: 0.8, vida: 54, atk: 12, repro: 0.00026, max: 12, col: "#5f4a38", col2: "#3a2c21", presas: ["oveja", "ciervo", "lobo", "conejo"] },
};

const RASGOS = ["devoto", "escéptico", "temerario", "pacífico", "ambicioso", "temeroso"];
const ROLES = ["aldeano", "cazador", "constructor"];

const PALETA_FAC = [
  { col: "#60a5fa", col2: "#1d4ed8" },
  { col: "#f87171", col2: "#b91c1c" },
  { col: "#4ade80", col2: "#15803d" },
  { col: "#fbbf24", col2: "#b45309" },
  { col: "#c084fc", col2: "#7e22ce" },
  { col: "#22d3ee", col2: "#0e7490" },
];

/* ============================================================
   3. Estado del mundo
   ============================================================ */
let tiles, arboles, edadArb, fuego, cenizaT, lavaT, edif, edifFac, edifHp, territorio, varia;
let fuegos, cenizas, lavas, volcanes;
let humanos = [], animales = [], pueblos = [], facciones = [];
let rel = null;
let tick = 0, dia = 0;
let sucios = new Set();
let idH = 1, idA = 1, idP = 1;
let censoEspecies = {};

function ti(x, y) { return y * COLS + x; }
function dentro(x, y) { return x >= 0 && y >= 0 && x < COLS && y < ROWS; }
function idxDe(px, py) {
  const x = clamp(Math.floor(px / TILE), 0, COLS - 1), y = clamp(Math.floor(py / TILE), 0, ROWS - 1);
  return y * COLS + x;
}
function esAgua(t) { return t === T.DEEP || t === T.WATER; }
function caminable(t) { return t !== T.DEEP && t !== T.WATER && t !== T.LAVA; }
function caminableEn(px, py) {
  if (px < 4 || py < 4 || px > W_PX - 4 || py > H_PX - 4) return false;
  return caminable(tiles[idxDe(px, py)]);
}
function marcarSucio(i) { sucios.add(i); }

/* ============================================================
   4. Generación del mundo
   ============================================================ */
function capaRuido(cx, cy) {
  const gw = cx + 1, gh = cy + 1;
  const g = new Float32Array(gw * gh);
  for (let i = 0; i < g.length; i++) g[i] = Math.random();
  const out = new Float32Array(NT);
  for (let y = 0; y < ROWS; y++) {
    const fy = (y / ROWS) * cy, y0 = Math.floor(fy), y1 = Math.min(y0 + 1, cy), ty = suave(fy - y0);
    for (let x = 0; x < COLS; x++) {
      const fx = (x / COLS) * cx, x0 = Math.floor(fx), x1 = Math.min(x0 + 1, cx), tx = suave(fx - x0);
      const a = g[y0 * gw + x0] + (g[y0 * gw + x1] - g[y0 * gw + x0]) * tx;
      const b = g[y1 * gw + x0] + (g[y1 * gw + x1] - g[y1 * gw + x0]) * tx;
      out[y * COLS + x] = a + (b - a) * ty;
    }
  }
  return out;
}

function generarMundo() {
  tiles = new Uint8Array(NT); arboles = new Uint8Array(NT); edadArb = new Uint8Array(NT);
  fuego = new Uint8Array(NT); cenizaT = new Uint16Array(NT); lavaT = new Uint16Array(NT);
  edif = new Uint8Array(NT); edifFac = new Uint8Array(NT); edifHp = new Uint8Array(NT);
  territorio = new Uint8Array(NT); varia = new Uint8Array(NT);
  fuegos = new Set(); cenizas = new Set(); lavas = new Set(); volcanes = [];
  humanos = []; animales = []; pueblos = []; facciones = [];
  idH = 1; idA = 1; idP = 1; tick = 0; dia = 0;
  sucios = new Set();

  const a1 = capaRuido(8, 5), a2 = capaRuido(19, 12), a3 = capaRuido(38, 23);
  const m1 = capaRuido(7, 4), m2 = capaRuido(17, 10);

  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const i = ti(x, y);
      let e = a1[i] * 0.55 + a2[i] * 0.31 + a3[i] * 0.14;
      const bx = Math.min(x, COLS - 1 - x) / 16, by = Math.min(y, ROWS - 1 - y) / 11;
      e *= 0.3 + 0.7 * clamp(Math.min(bx, by), 0, 1);
      const hum = m1[i] * 0.65 + m2[i] * 0.35;
      const lat = Math.abs(y / (ROWS - 1) - 0.5) * 2;
      const temp = 1.08 - lat * 1.25 - Math.max(0, e - 0.6) * 1.1 + (m2[i] - 0.5) * 0.3;

      let t;
      if (e < 0.3) t = T.DEEP;
      else if (e < 0.38) t = T.WATER;
      else if (e < 0.41) t = temp < 0.12 ? T.ICE : T.SAND;
      else if (e > 0.83) t = T.SNOW;
      else if (e > 0.71) t = T.MOUNT;
      else if (temp < 0.14) t = T.SNOW;
      else if (temp > 0.78 && hum < 0.42) t = T.SAND;
      else if (hum < 0.36) t = T.DRY;
      else t = T.GRASS;
      tiles[i] = t;
      varia[i] = randi(3);

      let arbol = 0;
      if (t === T.GRASS) {
        const p = clamp((hum - 0.34) * 1.5, 0, 0.72);
        if (chance(p)) arbol = temp < 0.4 ? ARB.PINO : (hum > 0.62 ? ARB.ROBLE : (chance(0.5) ? ARB.ROBLE : ARB.PINO));
      } else if (t === T.DRY) {
        if (chance(0.05)) arbol = ARB.PINO;
      } else if (t === T.SNOW && e < 0.8) {
        if (chance(0.09)) arbol = ARB.PINO;
      } else if (t === T.SAND) {
        if (chance(0.04)) arbol = ARB.PALMA;
      }
      arboles[i] = arbol;
      edadArb[i] = arbol ? 120 + randi(135) : 0;
    }
  }

  crearFacciones(4);
  sembrarAnimales();
  recalcularTerritorio();
}

function buenSitioInicio(i) {
  const t = tiles[i];
  if (t !== T.GRASS && t !== T.DRY) return false;
  const x = i % COLS, y = (i / COLS) | 0;
  if (x < 6 || y < 5 || x > COLS - 7 || y > ROWS - 6) return false;
  let tierra = 0;
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
    const j = ti(clamp(x + dx, 0, COLS - 1), clamp(y + dy, 0, ROWS - 1));
    if (caminable(tiles[j])) tierra++;
  }
  return tierra > 38;
}

function crearFacciones(n) {
  rel = new Float32Array(PALETA_FAC.length * PALETA_FAC.length);
  const inicios = [];
  for (let f = 0; f < n; f++) {
    let sitio = -1;
    for (let intento = 0; intento < 3000 && sitio < 0; intento++) {
      const i = randi(NT);
      if (!buenSitioInicio(i)) continue;
      const x = i % COLS, y = (i / COLS) | 0;
      let lejos = true;
      for (const o of inicios) if (d2(x, y, o % COLS, (o / COLS) | 0) < 34 * 34) lejos = false;
      if (lejos) sitio = i;
    }
    if (sitio < 0) continue;
    inicios.push(sitio);
    const pal = PALETA_FAC[facciones.length];
    facciones.push({
      id: facciones.length, nombre: nombreFaccion(), col: pal.col, col2: pal.col2,
      guerras: new Set(), fe: 0, pop: 0, vivo: true,
    });
    const fid = facciones.length - 1;
    const cx = (sitio % COLS) * TILE, cy = ((sitio / COLS) | 0) * TILE;
    for (let k = 0; k < 7; k++) {
      const px = cx + (Math.random() - 0.5) * 60 * U, py = cy + (Math.random() - 0.5) * 60 * U;
      if (caminableEn(px, py)) crearHumano(px, py, fid);
    }
  }
}

function sembrarAnimales() {
  censoEspecies = {};
  for (const k in ESPECIES) censoEspecies[k] = 0;
  for (let intento = 0; intento < 6000 && animales.length < 190; intento++) {
    const i = randi(NT), t = tiles[i];
    if (!caminable(t)) continue;
    let esp = null;
    if (t === T.GRASS) esp = arboles[i] ? pick(["ciervo", "lobo", "conejo"]) : pick(["oveja", "oveja", "conejo", "ciervo"]);
    else if (t === T.DRY) esp = pick(["conejo", "oveja", "lobo"]);
    else if (t === T.MOUNT || t === T.SNOW) esp = chance(0.5) ? "oso" : "lobo";
    if (!esp) continue;
    if (censoEspecies[esp] >= ESPECIES[esp].max * 0.55) continue;
    crearAnimal((i % COLS) * TILE + TILE / 2, ((i / COLS) | 0) * TILE + TILE / 2, esp);
  }
}

/* ============================================================
   5. Criaturas
   ============================================================ */
function crearHumano(px, py, faccion, pueblo) {
  const h = {
    id: idH++, x: px, y: py, px: px, py: py, dx: 0, dy: 0, anim: Math.random() * 4,
    faccion: faccion, pueblo: pueblo === undefined ? -1 : pueblo,
    nombre: nombrePersona(), rasgo: pick(RASGOS), rol: pick(ROLES), look: randi(3),
    edad: randi(400), hp: 34, hpMax: 34, hambre: 20 + randi(25),
    fe: 0, miedo: 0, profeta: false, conocido: false, enfermo: 0,
    estado: "vagar", destino: null, orden: null, obra: -1,
    golpe: 0, testigo: -1, ultimaFrase: "",
  };
  humanos.push(h);
  if (facciones[faccion]) facciones[faccion].pop++;
  return h;
}

function crearAnimal(px, py, especie) {
  const E = ESPECIES[especie];
  const a = {
    id: idA++, x: px, y: py, px: px, py: py, dx: 0, dy: 0, anim: Math.random() * 4, esp: especie,
    edad: randi(300), hp: E.vida, hpMax: E.vida, hambre: 20 + randi(30),
    estado: "pastar", destino: null, objetivo: null, golpe: 0,
  };
  animales.push(a);
  censoEspecies[especie] = (censoEspecies[especie] || 0) + 1;
  return a;
}

function matarHumano(k, causa) {
  const h = humanos[k];
  if (facciones[h.faccion]) facciones[h.faccion].pop--;
  if (h.profeta) registrar(`Ha muerto <b>${h.nombre}</b>, profeta de ${facciones[h.faccion].nombre}.`, "fe");
  else if (causa) registrarRaro(`<b>${h.nombre}</b> ${causa}`, "muerte", 0.07);
  humanos.splice(k, 1);
  if (typeof alMorirCriatura === "function") alMorirCriatura(h);
}

function matarAnimal(k) {
  const a = animales[k];
  censoEspecies[a.esp]--;
  animales.splice(k, 1);
  if (typeof alMorirCriatura === "function") alMorirCriatura(a);
}

/* ---------- rejilla espacial ---------- */
const hashH = { c: 64 * U, m: new Map() }, hashA = { c: 64 * U, m: new Map() };
function construirHash() {
  hashH.m.clear(); hashA.m.clear();
  for (const h of humanos) hashPush(hashH, h);
  for (const a of animales) hashPush(hashA, a);
}
function hashPush(H, e) {
  const k = ((e.x / H.c) | 0) + "," + ((e.y / H.c) | 0);
  let arr = H.m.get(k);
  if (!arr) { arr = []; H.m.set(k, arr); }
  arr.push(e);
}
function hashConsulta(H, x, y, r, fn) {
  const c = H.c, r2 = r * r;
  const x0 = ((x - r) / c) | 0, x1 = ((x + r) / c) | 0, y0 = ((y - r) / c) | 0, y1 = ((y + r) / c) | 0;
  for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
    const arr = H.m.get(cx + "," + cy);
    if (!arr) continue;
    for (const e of arr) if (d2(e.x, e.y, x, y) <= r2) fn(e);
  }
}
function hashCercano(H, x, y, r, filtro) {
  let mejor = null, mejorD = Infinity;
  hashConsulta(H, x, y, r, e => {
    if (!filtro(e)) return;
    const d = d2(e.x, e.y, x, y);
    if (d < mejorD) { mejorD = d; mejor = e; }
  });
  return mejor;
}

/* ---------- movimiento ---------- */
function mover(e, vel) {
  if (e.destino) {
    const dx = e.destino.x - e.x, dy = e.destino.y - e.y;
    const d = Math.hypot(dx, dy);
    if (d < 6 * U) { e.destino = null; }
    else { e.dx = dx / d; e.dy = dy / d; }
  }
  if (!e.destino && chance(0.04)) {
    const a = Math.random() * Math.PI * 2;
    e.dx = Math.cos(a); e.dy = Math.sin(a);
  }
  if (e.dx === 0 && e.dy === 0) { e.dx = Math.random() - 0.5; e.dy = Math.random() - 0.5; }
  const t = tiles[idxDe(e.x, e.y)];
  const factor = (t === T.MOUNT || t === T.SNOW) ? 0.55 : 1;
  const paso = vel * U * factor;
  const nx = e.x + e.dx * paso, ny = e.y + e.dy * paso;
  const ax = e.x, ay = e.y;
  if (caminableEn(nx, e.y)) e.x = nx; else { e.dx = -e.dx; e.destino = null; }
  if (caminableEn(e.x, ny)) e.y = ny; else { e.dy = -e.dy; e.destino = null; }
  e.anim += (Math.abs(e.x - ax) + Math.abs(e.y - ay)) * 0.22;
}

function irA(e, px, py) { e.destino = { x: clamp(px, 4, W_PX - 4), y: clamp(py, 4, H_PX - 4) }; }
function irATile(e, i) { irA(e, (i % COLS) * TILE + TILE / 2, ((i / COLS) | 0) * TILE + TILE / 2); }

/* ============================================================
   6. Fuego, lava y vegetación
   ============================================================ */
function prendeCon(i) {
  if (arboles[i]) return 0.65;
  if (edif[i] && edif[i] !== ED.RUINA) return 0.35;
  return COMBUSTIBLE[tiles[i]] || 0;
}
function encender(i, dur) {
  if (fuego[i] > 0 || prendeCon(i) <= 0) return;
  fuego[i] = dur || (24 + randi(14));
  fuegos.add(i);
  marcarSucio(i);
}
function apagar(i) {
  if (fuego[i] > 0) { fuego[i] = 0; fuegos.delete(i); marcarSucio(i); }
}
function vecinoAzar(i) {
  const x = i % COLS, y = (i / COLS) | 0;
  const nx = x + randi(3) - 1, ny = y + randi(3) - 1;
  return dentro(nx, ny) ? ti(nx, ny) : -1;
}

function tickFuego() {
  if (fuegos.size) {
    for (const i of Array.from(fuegos)) {
      fuego[i]--;
      marcarSucio(i);
      // el fuego salta poco y solo si el vecino tiene con qué arder
      if (chance(0.07)) {
        const j = vecinoAzar(i);
        if (j >= 0 && fuego[j] === 0 && chance(prendeCon(j))) encender(j);
      }
      if (fuego[i] <= 0) {
        fuegos.delete(i);
        if (arboles[i]) { arboles[i] = 0; edadArb[i] = 0; }
        if (edif[i]) destruirEdificio(i);
        if (COMBUSTIBLE[tiles[i]] > 0) { tiles[i] = T.ASH; cenizaT[i] = 170 + randi(140); cenizas.add(i); }
        marcarSucio(i);
      }
    }
  }
  if (cenizas.size && tick % 4 === 0) {
    for (const i of Array.from(cenizas)) {
      if (--cenizaT[i] <= 0) { cenizas.delete(i); tiles[i] = T.GRASS; marcarSucio(i); }
    }
  }
  if (lavas.size && tick % 3 === 0) {
    for (const i of Array.from(lavas)) {
      if (--lavaT[i] <= 0) { lavas.delete(i); tiles[i] = T.MOUNT; marcarSucio(i); }
    }
  }
  for (const i of volcanes) if (chance(0.0025)) erupcion(i);
}

function ponerLava(i, dur) {
  tiles[i] = T.LAVA; lavaT[i] = dur || (70 + randi(60));
  lavas.add(i); arboles[i] = 0;
  if (edif[i]) destruirEdificio(i);
  marcarSucio(i);
}

function erupcion(i) {
  const x = i % COLS, y = (i / COLS) | 0;
  ponerLava(i, 150);
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    if (!dentro(x + dx, y + dy) || chance(0.55)) continue;
    const j = ti(x + dx, y + dy);
    if (chance(0.4)) ponerLava(j); else encender(j, 40);
  }
  registrarRaro(`Un volcán entra en erupción.`, "desastre", 0.6);
}

function tickVegetacion() {
  for (let k = 0; k < 240; k++) {
    const i = randi(NT);
    if (!arboles[i]) continue;
    if (edadArb[i] < 255) {
      edadArb[i] = Math.min(255, edadArb[i] + 3);
      if (edadArb[i] % 30 < 3) marcarSucio(i);
    }
    if (edadArb[i] > 150 && chance(0.02)) {
      const j = vecinoAzar(i);
      if (j >= 0 && !arboles[j] && !edif[j] && (tiles[j] === T.GRASS || tiles[j] === T.DRY)) {
        arboles[j] = arboles[i]; edadArb[j] = 25; marcarSucio(j);
      }
    }
  }
}

/* ============================================================
   7. Pueblos
   ============================================================ */
function buenSitioPueblo(i) {
  const t = tiles[i];
  if (t !== T.GRASS && t !== T.DRY) return false;
  if (edif[i] || arboles[i]) return false;
  const x = i % COLS, y = (i / COLS) | 0;
  if (x < 4 || y < 4 || x > COLS - 5 || y > ROWS - 5) return false;
  for (const p of pueblos) if (d2(x, y, p.cx, p.cy) < 12 * 12) return false;
  return true;
}

function fundarPueblo(i, fid) {
  const x = i % COLS, y = (i / COLS) | 0;
  const p = {
    id: idP++, faccion: fid, cx: x, cy: y, nombre: nombrePueblo(),
    nivel: 1, pop: 0, comida: 12, fe: 0, edificios: 0,
    granjas: [], obra: null, mandato: null, templo: false, dia: dia,
  };
  pueblos.push(p);
  tiles[i] = T.PLAZA; arboles[i] = 0; marcarSucio(i);
  colocarEdificio(sitioLibre(p) || i, ED.CHOZA, p);
  hashConsulta(hashH, x * TILE, y * TILE, 90 * U, h => {
    if (h.faccion === fid && h.pueblo < 0) h.pueblo = pueblos.length - 1;
  });
  registrar(`Nace el caserío de <b>${p.nombre}</b> (${facciones[fid].nombre}).`, "pueblo");
  return p;
}

function sitioLibre(p) {
  for (let r = 1; r <= 7; r++) {
    const cand = [];
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const x = p.cx + dx, y = p.cy + dy;
      if (!dentro(x, y)) continue;
      const j = ti(x, y);
      if (edif[j] || !caminable(tiles[j]) || tiles[j] === T.PLAZA || tiles[j] === T.FARM) continue;
      cand.push(j);
    }
    if (cand.length) return pick(cand);
  }
  return null;
}

function colocarEdificio(i, tipo, p) {
  if (i == null) return;
  edif[i] = tipo; edifFac[i] = p.faccion + 1; edifHp[i] = 70;
  arboles[i] = 0;
  if (tiles[i] === T.ASH) { tiles[i] = T.DRY; cenizas.delete(i); }
  p.edificios++;
  marcarSucio(i);
  if (tipo === ED.GRANERO) crearGranjas(p, i);
  if (tipo === ED.TEMPLO) {
    p.templo = true;
    registrar(`<b>${p.nombre}</b> levanta un templo a la Voz.`, "fe");
  }
}

function crearGranjas(p, i) {
  const x = i % COLS, y = (i / COLS) | 0;
  let n = 0;
  for (let dy = -2; dy <= 2 && n < 5; dy++) for (let dx = -2; dx <= 2 && n < 5; dx++) {
    if (!dentro(x + dx, y + dy)) continue;
    const j = ti(x + dx, y + dy);
    if (edif[j] || arboles[j]) continue;
    if (tiles[j] !== T.GRASS && tiles[j] !== T.DRY) continue;
    tiles[j] = T.FARM; p.granjas.push(j); marcarSucio(j); n++;
  }
}

function destruirEdificio(i) {
  const p = puebloEn(i);
  if (p) p.edificios = Math.max(0, p.edificios - 1);
  edif[i] = ED.RUINA; edifHp[i] = 0;
  marcarSucio(i);
}

function puebloEn(i) {
  const x = i % COLS, y = (i / COLS) | 0;
  let mejor = null, md = 100;
  for (const p of pueblos) {
    const d = d2(x, y, p.cx, p.cy);
    if (d < md) { md = d; mejor = p; }
  }
  return mejor;
}

function tickPueblos() {
  for (const p of pueblos) { p.pop = 0; p.feSuma = 0; }
  for (const f of facciones) { f.pop = 0; f.feSuma = 0; }
  for (const h of humanos) {
    if (facciones[h.faccion]) { facciones[h.faccion].pop++; facciones[h.faccion].feSuma += h.fe; }
    const p = pueblos[h.pueblo];
    if (p && p.faccion === h.faccion) { p.pop++; p.feSuma += h.fe; }
    else if (h.pueblo >= 0 && !p) h.pueblo = -1;
  }
  for (const f of facciones) { f.fe = f.pop ? f.feSuma / f.pop : 0; f.vivo = f.pop > 0; }

  for (let k = pueblos.length - 1; k >= 0; k--) {
    const p = pueblos[k];
    p.fe = p.pop ? p.feSuma / p.pop : 0;
    if (p.pop === 0 && p.edificios === 0) {
      registrar(`<b>${p.nombre}</b> queda abandonado y se lo traga la maleza.`, "pueblo");
      pueblos.splice(k, 1);
      for (const h of humanos) if (h.pueblo > k) h.pueblo--; else if (h.pueblo === k) h.pueblo = -1;
      continue;
    }
    p.comida += p.granjas.length * 0.55 + Math.min(p.pop, 12) * 0.05 + 0.2;
    p.comida = Math.min(p.comida, 140);

    const nivel = p.pop >= 42 ? 4 : p.pop >= 24 ? 3 : p.pop >= 11 ? 2 : 1;
    if (nivel > p.nivel) {
      p.nivel = nivel;
      registrar(`<b>${p.nombre}</b> crece hasta ser ${NIVEL_PUEBLO[nivel].toLowerCase()} (${p.pop} almas).`, "pueblo");
    }

    if (!p.obra && p.pop > p.edificios * 2.5 && p.comida > 6) {
      const sitio = sitioLibre(p);
      if (sitio != null) {
        let tipo = ED.CHOZA;
        if (p.edificios >= 2 && (p.granjas.length === 0 || p.edificios % 5 === 0)) tipo = ED.GRANERO;
        else if (p.fe >= 45 && !p.templo) tipo = ED.TEMPLO;
        else if (p.nivel >= 4 && chance(0.3)) tipo = ED.TORRE;
        else if (p.nivel >= 3) tipo = ED.CASA;
        p.obra = { i: sitio, tipo: tipo, avance: 0 };
        p.comida -= 4;
      }
    }
    if (p.pop >= 16 && p.comida > 25 && chance(0.03)) colonizar(p);
    if (p.mandato && --p.mandato.t <= 0) p.mandato = null;
  }
}

function colonizar(p) {
  const idx = pueblos.indexOf(p);
  const colonos = humanos.filter(h => h.pueblo === idx && h.edad > 250 && !h.profeta).slice(0, 4);
  if (colonos.length < 3) return;
  const a = Math.random() * Math.PI * 2;
  const destX = clamp(p.cx * TILE + Math.cos(a) * 420 * U, 20, W_PX - 20);
  const destY = clamp(p.cy * TILE + Math.sin(a) * 420 * U, 20, H_PX - 20);
  for (const h of colonos) {
    h.pueblo = -1;
    darOrden(h, "fundar", null, 2500);
    irA(h, destX + (Math.random() - 0.5) * 60 * U, destY + (Math.random() - 0.5) * 60 * U);
  }
  p.comida -= 20;
  registrar(`Una expedición parte de <b>${p.nombre}</b> en busca de tierra nueva.`, "pueblo");
}

function tickFundaciones() {
  for (const h of humanos) {
    if (h.pueblo >= 0 || !chance(0.02)) continue;
    const forzado = h.orden && h.orden.tipo === "fundar";
    const i = idxDe(h.x, h.y);
    if (!buenSitioPueblo(i)) continue;
    let n = 0;
    hashConsulta(hashH, h.x, h.y, 80 * U, o => { if (o.faccion === h.faccion && o.pueblo < 0) n++; });
    if (n < (forzado ? 2 : 5)) continue;
    const p = fundarPueblo(i, h.faccion);
    if (forzado) {
      h.orden = null;
      registrar(`<b>${h.nombre}</b> funda ${p.nombre} siguiendo la palabra de la Voz.`, "fe");
    }
  }
}

/* ============================================================
   8. Facciones, territorio y guerra
   ============================================================ */
function relIdx(a, b) { return a * PALETA_FAC.length + b; }
function relGet(a, b) { return rel[relIdx(a, b)]; }
function relSet(a, b, v) { rel[relIdx(a, b)] = v; rel[relIdx(b, a)] = v; }
function relAdd(a, b, v) { if (a === b) return; relSet(a, b, clamp(relGet(a, b) + v, -100, 100)); }
function enGuerra(a, b) { return facciones[a] && facciones[a].guerras.has(b); }

function recalcularTerritorio() {
  territorio.fill(0);
  for (const p of pueblos) {
    const r = 5 + p.nivel * 3;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy > r * r) continue;
      const x = p.cx + dx, y = p.cy + dy;
      if (!dentro(x, y)) continue;
      const i = ti(x, y);
      if (!caminable(tiles[i])) continue;
      territorio[i] = p.faccion + 1;
    }
  }
  if (typeof pintarTerritorio === "function") pintarTerritorio();
}

function tickFacciones() {
  const F = facciones.length;
  const roce = new Float32Array(F * F);
  for (let y = 0; y < ROWS - 1; y++) for (let x = 0; x < COLS - 1; x++) {
    const a = territorio[ti(x, y)];
    if (!a) continue;
    const b = territorio[ti(x + 1, y)], c = territorio[ti(x, y + 1)];
    if (b && b !== a) roce[(a - 1) * F + (b - 1)]++;
    if (c && c !== a) roce[(a - 1) * F + (c - 1)]++;
  }
  for (let a = 0; a < F; a++) for (let b = a + 1; b < F; b++) {
    if (!facciones[a].vivo || !facciones[b].vivo) { if (enGuerra(a, b)) firmarPaz(a, b, true); continue; }
    let r = relGet(a, b);
    const fr = roce[a * F + b] + roce[b * F + a];
    r += -0.8 - fr * 0.09 + (Math.random() - 0.5) * 4;
    if (enGuerra(a, b)) r += 2.5;
    relSet(a, b, clamp(r, -100, 100));
    if (r <= -60 && !enGuerra(a, b)) declararGuerra(a, b);
    else if (r > -22 && enGuerra(a, b)) firmarPaz(a, b);
  }
}

function declararGuerra(a, b) {
  facciones[a].guerras.add(b); facciones[b].guerras.add(a);
  registrar(`⚔ <b>${facciones[a].nombre}</b> declara la guerra a <b>${facciones[b].nombre}</b>.`, "guerra");
  reclutar(a); reclutar(b);
}

function firmarPaz(a, b, silencio) {
  facciones[a].guerras.delete(b); facciones[b].guerras.delete(a);
  relSet(a, b, Math.max(relGet(a, b), -15));
  if (!silencio) registrar(`🕊 <b>${facciones[a].nombre}</b> y <b>${facciones[b].nombre}</b> firman la paz.`, "guerra");
  for (const h of humanos) if ((h.faccion === a || h.faccion === b) && h.rol === "guerrero" && !enGuerraFaccion(h.faccion)) h.rol = pick(ROLES);
}

function enGuerraFaccion(f) { return facciones[f] && facciones[f].guerras.size > 0; }

function reclutar(f) {
  let n = 0;
  for (const h of humanos) {
    if (h.faccion !== f || h.edad < 250) continue;
    if (h.profeta) continue;
    if (h.rol !== "guerrero" && chance(0.32)) { h.rol = "guerrero"; h.orden = null; n++; }
  }
  if (n) registrarRaro(`${facciones[f].nombre} arma a ${n} guerreros.`, "guerra", 0.8);
}

/* ============================================================
   9. Inteligencia de los humanos
   ============================================================ */
function comidaCercana(h) {
  const p = pueblos[h.pueblo];
  if (p && p.granjas.length) {
    let mejor = null, md = Infinity;
    for (const g of p.granjas) {
      if (tiles[g] !== T.FARM) continue;
      const d = d2(h.x, h.y, (g % COLS) * TILE, ((g / COLS) | 0) * TILE);
      if (d < md) { md = d; mejor = g; }
    }
    if (mejor != null) return mejor;
  }
  const cx = (h.x / TILE) | 0, cy = (h.y / TILE) | 0;
  for (let r = 1; r <= 7; r++) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const x = cx + dx, y = cy + dy;
      if (!dentro(x, y)) continue;
      const i = ti(x, y);
      if (tiles[i] === T.FARM || (arboles[i] && edadArb[i] > 120) || tiles[i] === T.GRASS) return i;
    }
  }
  return -1;
}

function enemigoCerca(h, r) {
  return hashCercano(hashH, h.x, h.y, r, o => o.faccion !== h.faccion && enGuerra(h.faccion, o.faccion));
}

function pensarHumano(h) {
  if (h.hp < h.hpMax * 0.33) {
    const am = hashCercano(hashA, h.x, h.y, 90 * U, a => ESPECIES[a.esp].tipo === "carn");
    if (am) { h.estado = "huir"; irA(h, h.x - (am.x - h.x) * 2, h.y - (am.y - h.y) * 2); return; }
  }

  if (h.orden) {
    h.orden.t--;
    if (h.orden.t <= 0) h.orden = null;
    else if (ejecutarOrden(h)) return;
  }

  if (h.rol === "guerrero" && enGuerraFaccion(h.faccion)) {
    const e = enemigoCerca(h, 260 * U);
    if (e) { h.estado = "luchar"; irA(h, e.x, e.y); return; }
    const obj = puebloEnemigoCercano(h);
    if (obj) { h.estado = "marchar"; irA(h, obj.cx * TILE, obj.cy * TILE); return; }
  }

  if (h.hambre > 65) {
    if (h.rol === "cazador") {
      const presa = hashCercano(hashA, h.x, h.y, 150 * U, a => ESPECIES[a.esp].tipo === "herb");
      if (presa) { h.estado = "cazar"; h.objetivo = presa; irA(h, presa.x, presa.y); return; }
    }
    const f = comidaCercana(h);
    if (f >= 0) { h.estado = "comer"; irATile(h, f); return; }
  }

  const p = pueblos[h.pueblo];
  if (p) {
    if (h.obra >= 0) {
      if (p.obra && p.obra.i === h.obra) {
        h.estado = "construir";
        if (!h.destino) irATile(h, h.obra);
        return;
      }
      h.obra = -1;
    }
    if (p.obra && h.rol === "constructor") {
      h.obra = p.obra.i; h.estado = "construir"; irATile(h, p.obra.i); return;
    }
    if (p.mandato && !h.orden && chance(0.02 + h.fe * 0.004)) {
      darOrden(h, p.mandato.tipo, p.mandato.datos, 500);
      return;
    }
    if (p.templo && h.fe > 55 && chance(0.15)) {
      h.estado = "rezar"; irA(h, p.cx * TILE + TILE / 2, p.cy * TILE + TILE / 2); return;
    }
    if (!h.destino && chance(0.5)) {
      h.estado = "vagar";
      irA(h, p.cx * TILE + (Math.random() - 0.5) * 140 * U, p.cy * TILE + (Math.random() - 0.5) * 140 * U);
      return;
    }
  }
  h.estado = "vagar";
}

function puebloEnemigoCercano(h) {
  let mejor = null, md = Infinity;
  for (const p of pueblos) {
    if (!enGuerra(h.faccion, p.faccion)) continue;
    const d = d2(h.x, h.y, p.cx * TILE, p.cy * TILE);
    if (d < md) { md = d; mejor = p; }
  }
  return mejor;
}

function ejecutarOrden(h) {
  const o = h.orden;
  switch (o.tipo) {
    case "migrar": {
      if (!h.destino) {
        const d = o.datos;
        irA(h, h.x + d.x * 420 * U, h.y + d.y * 420 * U);
        h.pueblo = -1;
      }
      h.estado = "migrar";
      return true;
    }
    case "fundar": {
      if (h.pueblo >= 0) { h.orden = null; return false; }
      if (!h.destino) {
        const i = idxDe(h.x, h.y);
        if (!buenSitioPueblo(i)) irA(h, h.x + (Math.random() - 0.5) * 300 * U, h.y + (Math.random() - 0.5) * 300 * U);
      }
      h.estado = "buscar sitio";
      return true;
    }
    case "cazar": {
      const presa = hashCercano(hashA, h.x, h.y, 220 * U, a => ESPECIES[a.esp].tipo === "herb");
      if (presa) { h.estado = "cazar"; h.objetivo = presa; irA(h, presa.x, presa.y); return true; }
      return false;
    }
    case "plantar": {
      const i = idxDe(h.x, h.y);
      if (!arboles[i] && (tiles[i] === T.GRASS || tiles[i] === T.DRY) && !edif[i]) {
        arboles[i] = chance(0.5) ? ARB.ROBLE : ARB.PINO; edadArb[i] = 30; marcarSucio(i);
        if (chance(0.12)) h.orden = null;
      } else if (!h.destino) irA(h, h.x + (Math.random() - 0.5) * 160 * U, h.y + (Math.random() - 0.5) * 160 * U);
      h.estado = "plantar";
      return true;
    }
    case "predicar": {
      h.estado = "predicar";
      if (!h.destino) {
        const p = pueblos[h.pueblo];
        if (p) irA(h, p.cx * TILE + (Math.random() - 0.5) * 120 * U, p.cy * TILE + (Math.random() - 0.5) * 120 * U);
      }
      return true;
    }
    case "atacar": {
      if (tick % 50 === 0) relAdd(h.faccion, o.datos, h.profeta ? -1.7 : -0.35);
      if (h.rol !== "guerrero" && enGuerra(h.faccion, o.datos)) h.rol = "guerrero";
      return false;
    }
    case "paz": {
      if (tick % 50 === 0) relAdd(h.faccion, o.datos, h.profeta ? 1.7 : 0.35);
      if (h.rol === "guerrero" && !enGuerra(h.faccion, o.datos)) h.rol = "aldeano";
      return false;
    }
    case "construir": {
      h.rol = "constructor";
      return false;
    }
    case "rezar": {
      const p = pueblos[h.pueblo];
      if (p) { h.estado = "rezar"; if (!h.destino) irA(h, p.cx * TILE + TILE / 2, p.cy * TILE + TILE / 2); }
      h.fe = Math.min(100, h.fe + 0.05);
      return true;
    }
  }
  return false;
}

function darOrden(h, tipo, datos, dur) {
  h.orden = { tipo: tipo, datos: datos, t: dur || 700 };
  h.destino = null;
}

function actuarHumano(h, i) {
  const t = tiles[i];

  if (h.estado === "comer" || h.hambre > 80) {
    if (t === T.FARM && chance(0.35)) {
      h.hambre = Math.max(0, h.hambre - 45);
      const p = pueblos[h.pueblo]; if (p) p.comida += 0.6;
    } else if (arboles[i] && chance(0.14)) h.hambre = Math.max(0, h.hambre - 18);
    else if (t === T.GRASS && chance(0.06)) h.hambre = Math.max(0, h.hambre - 7);
  }

  if (h.estado === "construir" && h.obra >= 0) {
    const p = pueblos[h.pueblo];
    if (!p || !p.obra || p.obra.i !== h.obra) { h.obra = -1; h.estado = "vagar"; }
    else if (d2(h.x, h.y, (h.obra % COLS) * TILE + TILE / 2, ((h.obra / COLS) | 0) * TILE + TILE / 2) < (16 * U) * (16 * U)) {
      p.obra.avance += 1;
      h.golpe = 6;
      if (p.obra.avance > 40) {
        colocarEdificio(p.obra.i, p.obra.tipo, p);
        p.obra = null; h.obra = -1; h.estado = "vagar";
      }
    }
  }

  if (h.golpe > 0) h.golpe--;
  if ((h.estado === "luchar" || h.estado === "marchar") && h.golpe === 0) {
    const e = hashCercano(hashH, h.x, h.y, 11 * U, o => o.faccion !== h.faccion && enGuerra(h.faccion, o.faccion));
    if (e) {
      e.hp -= 4 + randi(5); h.golpe = 8; e.miedo = Math.min(100, e.miedo + 4);
      if (e.hp <= 0) { e.causa = `cae en la guerra contra ${facciones[h.faccion].nombre}.`; relAdd(h.faccion, e.faccion, 0.5); }
    } else if (edif[i] && edifFac[i] && edifFac[i] - 1 !== h.faccion && enGuerra(h.faccion, edifFac[i] - 1)) {
      edifHp[i] -= 4; h.golpe = 10; marcarSucio(i);
      if (edifHp[i] <= 0) { destruirEdificio(i); registrarRaro(`Guerreros de ${facciones[h.faccion].nombre} arrasan un edificio enemigo.`, "guerra", 0.5); }
    }
  }

  if (h.estado === "cazar" && h.objetivo && h.golpe === 0) {
    const a = h.objetivo;
    if (a.hp <= 0) { h.objetivo = null; }
    else if (d2(h.x, h.y, a.x, a.y) < (12 * U) * (12 * U)) {
      a.hp -= 7; h.golpe = 10;
      a.estado = "huir"; irA(a, a.x + (a.x - h.x), a.y + (a.y - h.y));
      if (a.hp <= 0) { h.hambre = Math.max(0, h.hambre - 60); h.objetivo = null; }
    }
  }

  if (humanos.length < MAX_HUM && h.edad > 280 && h.hambre < 60 && chance(0.0009)) {
    const p = pueblos[h.pueblo];
    if (p && p.comida > 5) {
      const pareja = hashCercano(hashH, h.x, h.y, 30 * U, o => o !== h && o.faccion === h.faccion && o.hambre < 75 && o.edad > 280);
      if (pareja) {
        p.comida -= 5;
        const b = crearHumano(h.x + (Math.random() - 0.5) * 8 * U, h.y + (Math.random() - 0.5) * 8 * U, h.faccion, h.pueblo);
        b.fe = (h.fe + pareja.fe) * 0.25;
      }
    }
  }
}

function tickHumanos() {
  for (let k = humanos.length - 1; k >= 0; k--) {
    const h = humanos[k];
    h.px = h.x; h.py = h.y;
    h.edad++;
    h.hambre += 0.045;
    const i = idxDe(h.x, h.y);

    if (fuego[i] > 0 || tiles[i] === T.LAVA) {
      h.hp -= tiles[i] === T.LAVA ? 8 : 2.5;
      h.miedo = Math.min(100, h.miedo + 1.5);
      h.estado = "huir";
      if (!h.destino) irA(h, h.x + (Math.random() - 0.5) * 200 * U, h.y + (Math.random() - 0.5) * 200 * U);
    }
    if (h.hambre > 140) h.hp -= 0.22;
    else if (h.hambre < 50 && h.hp < h.hpMax && !h.enfermo && chance(0.05)) h.hp = Math.min(h.hpMax, h.hp + 1);
    if (h.miedo > 0) h.miedo -= 0.02;

    if (h.enfermo > 0) {
      h.enfermo--;
      h.hp -= 0.09;
      if (chance(0.006)) hashConsulta(hashH, h.x, h.y, 26 * U, o => { if (!o.enfermo && chance(0.25)) o.enfermo = 350 + randi(250); });
      if (h.enfermo === 0) h.hp = Math.max(h.hp, 4);
    }

    if ((tick + h.id) % 8 === 0) pensarHumano(h);
    mover(h, h.rol === "guerrero" ? 1.25 : 1.05);
    actuarHumano(h, i);

    if (h.hp <= 0) { matarHumano(k, h.causa || "muere."); continue; }
    if (h.hambre > 170 && chance(0.02)) { matarHumano(k, "muere de hambre."); continue; }
    if (h.edad > 7200 && chance(0.005)) { matarHumano(k, "muere de vejez."); continue; }
  }
}

/* ============================================================
   10. Animales
   ============================================================ */
function tickAnimales() {
  for (let k = animales.length - 1; k >= 0; k--) {
    const a = animales[k];
    const E = ESPECIES[a.esp];
    a.px = a.x; a.py = a.y;
    a.edad++;
    a.hambre += E.tipo === "carn" ? 0.05 : 0.035;
    const i = idxDe(a.x, a.y);

    if (fuego[i] > 0 || tiles[i] === T.LAVA) {
      a.hp -= tiles[i] === T.LAVA ? 10 : 3;
      a.estado = "huir";
      if (!a.destino) irA(a, a.x + (Math.random() - 0.5) * 200 * U, a.y + (Math.random() - 0.5) * 200 * U);
    }
    if (a.golpe > 0) a.golpe--;

    if ((tick + a.id) % 10 === 0) {
      if (E.tipo === "carn") {
        if (a.hambre > 45) {
          const presa = hashCercano(hashA, a.x, a.y, 140 * U, o => o !== a && E.presas.indexOf(o.esp) >= 0);
          if (presa) { a.estado = "cazar"; a.objetivo = presa; irA(a, presa.x, presa.y); }
          else if (a.hambre > (a.esp === "oso" ? 70 : 95)) {
            const h = hashCercano(hashH, a.x, a.y, 110 * U, o => true);
            if (h) { a.estado = "acechar"; a.objetivo = h; irA(a, h.x, h.y); }
          }
        } else if (!a.destino) { a.estado = "vagar"; }
      } else {
        const dep = hashCercano(hashA, a.x, a.y, 110 * U, o => ESPECIES[o.esp].tipo === "carn");
        const caz = hashCercano(hashH, a.x, a.y, 70 * U, o => o.rol === "cazador");
        const am = dep || caz;
        if (am) { a.estado = "huir"; irA(a, a.x + (a.x - am.x) * 3, a.y + (a.y - am.y) * 3); }
        else if (!a.destino) { a.estado = "pastar"; irA(a, a.x + (Math.random() - 0.5) * 120 * U, a.y + (Math.random() - 0.5) * 120 * U); }
      }
    }

    mover(a, a.estado === "huir" ? E.vel * 1.5 : E.vel);

    if (E.tipo === "herb") {
      if ((tiles[i] === T.GRASS || tiles[i] === T.FARM) && chance(0.1)) {
        a.hambre = Math.max(0, a.hambre - 12);
        if (tiles[i] === T.FARM && chance(0.02)) { tiles[i] = T.GRASS; marcarSucio(i); }
      }
    } else if (a.objetivo && a.golpe === 0 && d2(a.x, a.y, a.objetivo.x, a.objetivo.y) < (13 * U) * (13 * U)) {
      const o = a.objetivo;
      o.hp -= E.atk; a.golpe = 12;
      if (o.esp) {
        o.estado = "huir"; irA(o, o.x + (o.x - a.x) * 3, o.y + (o.y - a.y) * 3);
        if (o.hp <= 0) { a.hambre = Math.max(0, a.hambre - 70); a.objetivo = null; }
      } else {
        o.miedo = Math.min(100, o.miedo + 12);
        o.estado = "huir"; irA(o, o.x + (o.x - a.x) * 3, o.y + (o.y - a.y) * 3);
        if (o.hp <= 0) { o.causa = `es devorado por un ${E.n.toLowerCase()}.`; a.hambre = Math.max(0, a.hambre - 80); a.objetivo = null; }
      }
    }

    if (a.hambre > 150) a.hp -= 0.18;
    if (a.hp <= 0 || a.edad > 5200) { matarAnimal(k); continue; }

    if (animales.length < MAX_ANI && censoEspecies[a.esp] < E.max && a.edad > 320 && a.hambre < 60 && chance(E.repro)) {
      if (caminableEn(a.x + 6 * U, a.y + 6 * U)) crearAnimal(a.x + 6 * U, a.y + 6 * U, a.esp);
    }
  }
}

/* ============================================================
   11. Fe, profetas y milagros
   ============================================================ */
function volverProfeta(h, anunciar) {
  if (h.profeta) return;
  h.profeta = true;
  h.rol = "aldeano";
  darOrden(h, "predicar", null, 4000);
  if (anunciar !== false) {
    const p = pueblos[h.pueblo];
    registrar(`✨ <b>${h.nombre}</b> se proclama profeta de la Voz${p ? " en " + p.nombre : ""}.`, "fe");
  }
}

function tickFe() {
  if (tick % 5 !== 0) return;
  for (const h of humanos) {
    if (!h.profeta || !chance(0.3)) continue;
    hashConsulta(hashH, h.x, h.y, 95 * U, o => {
      if (o === h || o.faccion !== h.faccion) return;
      if (o.fe < h.fe - 4) {
        o.fe = Math.min(100, o.fe + 1.1);
        o.conocido = true;
        if (o.fe > 72 && !o.profeta && chance(0.003)) volverProfeta(o);
      }
    });
  }
}

function poderUsadoCerca(px, py, radio, clase) {
  hashConsulta(hashH, px, py, radio, h => {
    h.conocido = true;
    h.testigo = tick;
    if (clase === "milagro") {
      h.fe = Math.min(100, h.fe + 5 + randi(6));
      if (h.fe > 78 && !h.profeta && chance(0.05)) volverProfeta(h);
    } else if (clase === "castigo") {
      h.miedo = Math.min(100, h.miedo + 9 + randi(9));
      h.fe = Math.min(100, h.fe + 2 + randi(3));
      h.estado = "huir";
    }
  });
}

/* ============================================================
   12. Acciones de los poderes sobre el mundo
   ============================================================ */
function enCirculo(gx, gy, r, fn) {
  const r2 = r * r;
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (dx * dx + dy * dy > r2) continue;
    const x = gx + dx, y = gy + dy;
    if (dentro(x, y)) fn(x, y, ti(x, y));
  }
}

function pintarTile(i, t) {
  if (tiles[i] === t) return;
  if (tiles[i] === T.FARM) {
    for (const p of pueblos) { const k = p.granjas.indexOf(i); if (k >= 0) p.granjas.splice(k, 1); }
  }
  tiles[i] = t;
  cenizas.delete(i); lavas.delete(i);
  if (!caminable(t) || t === T.MOUNT) { if (arboles[i]) arboles[i] = 0; }
  if (!caminable(t) && edif[i]) destruirEdificio(i);
  apagar(i);
  marcarSucio(i);
  marcarVecinosSucios(i);
}

function marcarVecinosSucios(i) {
  const x = i % COLS, y = (i / COLS) | 0;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (dentro(x + dx, y + dy)) sucios.add(ti(x + dx, y + dy));
  }
}

function plantarArbol(i, tipo) {
  if (arboles[i] || edif[i]) return;
  const t = tiles[i];
  if (t !== T.GRASS && t !== T.DRY && t !== T.SAND && t !== T.SNOW) return;
  arboles[i] = tipo || (t === T.SAND ? ARB.PALMA : (t === T.SNOW ? ARB.PINO : (chance(0.55) ? ARB.ROBLE : ARB.PINO)));
  edadArb[i] = 40 + randi(60);
  marcarSucio(i);
}

function matarCriaturas(px, py, radio, prob, causa) {
  for (let k = humanos.length - 1; k >= 0; k--) {
    const h = humanos[k];
    if (d2(h.x, h.y, px, py) <= radio * radio && chance(prob)) matarHumano(k, causa);
  }
  for (let k = animales.length - 1; k >= 0; k--) {
    const a = animales[k];
    if (d2(a.x, a.y, px, py) <= radio * radio && chance(prob)) matarAnimal(k);
  }
}

function curarZona(px, py, radio) {
  let n = 0;
  hashConsulta(hashH, px, py, radio, h => {
    h.hp = h.hpMax; h.hambre = Math.max(0, h.hambre - 60); n++;
  });
  hashConsulta(hashA, px, py, radio, a => { a.hp = a.hpMax; a.hambre = Math.max(0, a.hambre - 50); });
  return n;
}

function fertilizar(gx, gy, r) {
  enCirculo(gx, gy, r, (x, y, i) => {
    if (tiles[i] === T.ASH || tiles[i] === T.DRY || tiles[i] === T.SAND) { pintarTile(i, T.GRASS); }
    if (tiles[i] === T.GRASS && !arboles[i] && !edif[i] && chance(0.25)) plantarArbol(i);
    if (arboles[i]) { edadArb[i] = 255; marcarSucio(i); }
  });
}

/* ============================================================
   13. Un paso de simulación
   ============================================================ */
function simTick() {
  tick++;
  if (tick % TICKS_DIA === 0) dia++;
  construirHash();
  tickFuego();
  tickVegetacion();
  tickHumanos();
  tickAnimales();
  if (tick % 10 === 0) { tickPueblos(); tickFundaciones(); }
  if (tick % 60 === 0) recalcularTerritorio();
  if (tick % TICKS_DIA === 0) tickFacciones();
  tickFe();
}
