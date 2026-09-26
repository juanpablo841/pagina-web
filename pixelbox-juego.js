/* PixelBox — dibujo, interfaz, poderes y la voz divina.
   Los datos y las reglas del mundo están en pixelbox-mundo.js */

/* ============================================================
   1. Lienzos
   ============================================================ */
const canvas = document.getElementById("stage");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

const terreno = document.createElement("canvas");
terreno.width = W_PX; terreno.height = H_PX;
const tctx = terreno.getContext("2d");
tctx.imageSmoothingEnabled = false;

const mapaTerr = document.createElement("canvas");
mapaTerr.width = COLS; mapaTerr.height = ROWS;
const mctx = mapaTerr.getContext("2d");

const camara = { x: 0, y: 0, zoom: 1 };
let mostrarTerr = false;
let efectos = [];
let sacudida = 0;

function lienzo(w, h) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const x = c.getContext("2d");
  x.imageSmoothingEnabled = false;
  return { c, x };
}

/* ruido determinista para que cada textura salga siempre igual */
let _s = 1;
function semilla(n) { _s = (n | 0) || 1; }
function rr() { _s = (_s * 1664525 + 1013904223) >>> 0; return _s / 4294967296; }
function ri(n) { return (rr() * n) | 0; }

/* ============================================================
   2. Paletas y texturas del terreno
   ============================================================ */
const TP = [
  { base: "#0d2f62", luz: "#17417f", som: "#07204a", det: "#2a5ea8" }, // océano
  { base: "#1a6fb5", luz: "#3d93d6", som: "#125a97", det: "#9adcf5" }, // agua
  { base: "#e0c179", luz: "#f1d89c", som: "#c3a260", det: "#cdb06d" }, // arena
  { base: "#4f9e45", luz: "#63b455", som: "#3c8036", det: "#7ac368" }, // pradera
  { base: "#9da75c", luz: "#b3bb72", som: "#7f8a49", det: "#c4cb8c" }, // estepa
  { base: "#8b9099", luz: "#aab0b9", som: "#63686f", det: "#c6ccd4" }, // montaña
  { base: "#eaf1f8", luz: "#ffffff", som: "#c3d3e6", det: "#dbe6f2" }, // nieve
  { base: "#4a4640", luz: "#5d574f", som: "#332f2b", det: "#6d6559" }, // ceniza
  { base: "#e2450f", luz: "#ffb703", som: "#95260a", det: "#ff8c2a" }, // lava
  { base: "#c2e7f7", luz: "#e8f8ff", som: "#8fc4dd", det: "#ffffff" }, // hielo
  { base: "#9c7338", luz: "#b88c48", som: "#7b592a", det: "#6fae3a" }, // cultivo
  { base: "#9a8d79", luz: "#b5a993", som: "#786d5e", det: "#6b5a45" }, // plaza
];

const atlasSuelo = lienzo(TILE * 3, TILE * 12);

function pintarSuelo(x, t, v) {
  const P = TP[t], ox = v * TILE, oy = t * TILE;
  x.fillStyle = P.base; x.fillRect(ox, oy, TILE, TILE);
  const p = (a, b, w, h, col) => { x.fillStyle = col; x.fillRect(ox + a, oy + b, w, h); };
  semilla(t * 97 + v * 31 + 7);

  switch (t) {
    case T.GRASS:
    case T.DRY: {
      for (let k = 0; k < 7; k++) p(ri(22), ri(23), 2 + ri(3), 1, k % 2 ? P.som : P.luz);
      for (let k = 0; k < 5; k++) {
        const a = 2 + ri(19), b = 4 + ri(16);
        p(a, b - 3, 1, 4, P.det); p(a - 1, b - 1, 1, 2, P.det); p(a + 1, b - 2, 1, 3, P.det);
      }
      if (t === T.GRASS && v === 2) { const a = 4 + ri(14), b = 5 + ri(13); p(a, b, 2, 2, "#f7e06a"); p(a, b + 2, 1, 1, "#3c8036"); }
      if (t === T.DRY && v === 1) { const a = 5 + ri(12); p(a, 14, 5, 1, "#8a7a45"); }
      break;
    }
    case T.SAND: {
      for (let k = 0; k < 4; k++) { const b = 3 + k * 6 + ri(2); p(2 + ri(6), b, 9 + ri(6), 1, P.som); }
      for (let k = 0; k < 8; k++) p(ri(23), ri(23), 1, 1, P.luz);
      break;
    }
    case T.WATER:
    case T.DEEP: {
      for (let k = 0; k < 3; k++) {
        const b = 3 + k * 7 + ri(3), a = 2 + ri(8);
        p(a, b, 7 + ri(5), 1, P.luz);
        p(a + 2, b + 1, 4, 1, P.som);
      }
      if (t === T.WATER) { p(6 + ri(8), 6 + ri(10), 3, 1, P.det); p(4 + ri(12), 16, 2, 1, P.det); }
      break;
    }
    case T.MOUNT: {
      p(0, 0, TILE, TILE, P.base);
      // facetas de roca: luz arriba-izquierda, sombra abajo-derecha
      for (let k = 0; k < 3; k++) {
        const a = ri(14), b = ri(14), w = 7 + ri(8), h = 6 + ri(8);
        p(a, b, w, h, k % 2 ? P.luz : P.base);
        p(a + w - 3, b + 2, 3, h - 2, P.som);
        p(a, b, w - 2, 1, P.det);
      }
      p(0, TILE - 3, TILE, 3, P.som);
      break;
    }
    case T.SNOW: {
      for (let k = 0; k < 4; k++) p(ri(18), ri(18), 5 + ri(6), 3 + ri(3), P.som);
      for (let k = 0; k < 6; k++) p(ri(23), ri(23), 1, 1, P.luz);
      p(0, 0, TILE, 2, P.luz);
      break;
    }
    case T.ICE: {
      p(0, 0, TILE, TILE, P.base);
      for (let k = 0; k < 3; k++) {
        const a = ri(18), b = ri(18);
        p(a, b, 6 + ri(6), 1, P.det); p(a + 2, b + 1, 1, 4 + ri(4), P.som);
      }
      p(3, 3, 5, 1, P.luz);
      break;
    }
    case T.ASH: {
      for (let k = 0; k < 8; k++) p(ri(23), ri(23), 2, 1, k % 3 ? P.som : P.luz);
      if (v === 0) p(8 + ri(6), 10 + ri(6), 2, 2, "#8a3a12");
      break;
    }
    case T.LAVA: {
      for (let k = 0; k < 4; k++) p(ri(18), ri(18), 5 + ri(7), 4 + ri(5), P.som);
      for (let k = 0; k < 5; k++) p(ri(22), ri(22), 3 + ri(4), 1, P.luz);
      p(9 + ri(5), 9 + ri(5), 3, 2, "#fff3b0");
      break;
    }
    case T.FARM: {
      p(0, 0, TILE, TILE, "#6b4f2a");
      for (let b = 1; b < TILE; b += 5) {
        p(0, b, TILE, 1, "#8a6a3a");
        p(0, b + 1, TILE, 3, "#5d4322");
        for (let k = 0; k < 3; k++) {
          const a = 2 + k * 8 + ri(3);
          p(a, b - 2, 1, 3, "#5f9e3a");
          p(a - 1, b - 2, 3, 1, "#77bd4e");
          p(a - 1, b - 3, 1, 1, "#77bd4e"); p(a + 1, b - 3, 1, 1, "#77bd4e");
        }
      }
      break;
    }
    case T.PLAZA: {
      p(0, 0, TILE, TILE, "#a89878");
      for (let k = 0; k < 10; k++) p(ri(22), ri(22), 2 + ri(3), 2, k % 2 ? "#96876a" : "#b8a888");
      for (const s of [[2, 3], [18, 5], [4, 18], [17, 17]]) { p(s[0], s[1], 3, 2, "#7d7059"); p(s[0], s[1], 3, 1, "#c4b596"); }
      p(7, 8, 10, 10, "#7d7059");
      p(8, 9, 8, 8, "#3a2f24");
      p(9, 10, 6, 6, "#c0392b");
      p(10, 11, 4, 4, "#f59e0b");
      p(11, 12, 2, 2, "#fde68a");
      p(10, 4, 4, 5, "#6b5a45");
      p(9, 2, 6, 3, "#8a6a3a");
      p(11, 0, 2, 3, "#facc15");
      break;
    }
  }
}

/* ---------- árboles ---------- */
const atlasArb = lienzo(TILE * 4, TILE * 4);   // 3 tipos x 4 etapas

function pintarArbol(x, tipo, etapa) {
  const ox = etapa * TILE, oy = (tipo - 1) * TILE;
  const p = (a, b, w, h, col) => { x.fillStyle = col; x.fillRect(ox + a, oy + b, w, h); };
  const g = 0.45 + etapa * 0.185;
  const base = TILE - 2;
  semilla(tipo * 71 + etapa * 13 + 3);

  // sombra en el suelo
  x.fillStyle = "rgba(0,0,0,0.20)";
  x.fillRect(ox + 6, oy + base, 12, 3);
  x.fillRect(ox + 8, oy + base + 3, 8, 1);

  if (tipo === ARB.PINO) {
    const h = Math.round(9 + 12 * g);
    p(11, base - 5, 3, 5, "#6b4a2a");
    p(11, base - 5, 1, 5, "#8a6238");
    const capas = 4;
    for (let k = 0; k < capas; k++) {
      const w = Math.max(4, Math.round((13 - k * 2.4) * g + 3));
      const yy = base - 5 - Math.round((k + 1) * h / capas) - 1;
      const hh = Math.round(h / capas) + 3;
      p(12 - (w >> 1), yy, w, hh, "#1f5f2a");
      p(12 - (w >> 1), yy, Math.max(2, w >> 1), hh - 1, "#2f7d37");
      p(12 - (w >> 1) + 1, yy, Math.max(1, (w >> 2)), 2, "#43a04a");
    }
  } else if (tipo === ARB.ROBLE) {
    const w = Math.round(9 + 11 * g), h = Math.round(7 + 9 * g);
    const cx = 12, top = base - 6 - h;
    p(11, base - 7, 3, 7, "#6b4a2a");
    p(11, base - 7, 1, 7, "#8a6238");
    p(13, base - 4, 2, 1, "#5a3d22");
    const filas = [0.55, 0.85, 1, 1, 0.92, 0.7];
    for (let k = 0; k < filas.length; k++) {
      const ww = Math.max(3, Math.round(w * filas[k]));
      const yy = top + Math.round(k * h / filas.length);
      const hh = Math.ceil(h / filas.length) + 1;
      p(cx - (ww >> 1), yy, ww, hh, "#2b7434");
    }
    // luz arriba-izquierda y sombra abajo-derecha
    p(cx - (w >> 1) + 1, top + 1, Math.max(2, w >> 1), Math.max(2, h >> 1), "#3d9440");
    p(cx - 1, top + (h >> 1), Math.max(2, w >> 1) - 1, Math.max(2, h >> 1), "#1f5a28");
    for (let k = 0; k < 3; k++) p(cx - (w >> 1) + 2 + ri(Math.max(1, w - 4)), top + 2 + ri(Math.max(1, h - 3)), 2, 1, "#17471f");
  } else {
    const h = Math.round(8 + 10 * g);
    for (let k = 0; k < h; k++) p(11 + Math.round(Math.sin(k / 5) * 2), base - 4 - k, 3, 1, k % 3 ? "#8a6a3a" : "#a07f48");
    const top = base - 4 - h;
    const fr = [[-9, 0], [-6, -3], [4, -3], [6, 0]];
    for (const f of fr) {
      for (let k = 0; k < 6; k++) {
        p(12 + f[0] + (f[0] < 0 ? k : -k) * 0.8 | 0, top + f[1] + Math.round(k * 0.7), 3, 2, k < 3 ? "#37a355" : "#2a7f42");
      }
    }
    p(10, top + 2, 3, 2, "#2a7f42");
    p(11, top + 4, 2, 2, "#c98b2e");
  }
}

/* ---------- edificios ---------- */
const atlasEd = lienzo(TILE * 7, TILE * (PALETA_FAC.length + 1));

function pintarEdificio(x, tipo, fid) {
  const f = PALETA_FAC[fid] || { col: "#9ca3af", col2: "#4b5563" };
  const ox = tipo * TILE, oy = fid * TILE;
  const p = (a, b, w, h, col) => { x.fillStyle = col; x.fillRect(ox + a, oy + b, w, h); };
  x.fillStyle = "rgba(0,0,0,0.22)";
  x.fillRect(ox + 3, oy + TILE - 4, TILE - 5, 3);

  switch (tipo) {
    case ED.CHOZA:
      p(4, 12, 16, 9, "#8a6239");
      for (let a = 5; a < 19; a += 3) p(a, 12, 1, 9, "#6f4d2c");
      p(4, 12, 16, 1, "#a2764a");
      for (let k = 0; k < 5; k++) { const w = 22 - k * 4; p(12 - (w >> 1), 11 - k * 2, w, 3, k % 2 ? "#c9a24a" : "#b08c3c"); }
      p(12 - 3, 15, 6, 6, "#3b2a1d");
      p(12 - 2, 16, 4, 5, "#54402c");
      p(6, 14, 3, 3, "#2b1f16");
      break;
    case ED.CASA:
      p(3, 11, 18, 10, "#e3d6ba");
      p(3, 18, 18, 3, "#c2b391");
      p(3, 11, 18, 1, "#f2e8d2");
      for (let k = 0; k < 5; k++) { const w = 22 - k * 3; p(12 - (w >> 1), 10 - k * 2, w, 3, k % 2 ? f.col : f.col2); }
      p(1, 9, 22, 1, f.col2);
      p(10, 15, 5, 6, "#5b3f28");
      p(11, 16, 3, 5, "#75502f");
      p(5, 13, 4, 4, "#8fd4f0"); p(5, 13, 4, 1, "#cbeaf8");
      p(16, 13, 4, 4, "#8fd4f0"); p(16, 13, 4, 1, "#cbeaf8");
      p(16, 1, 3, 5, "#8a8a8a"); p(16, 1, 3, 1, "#5c5c5c");
      break;
    case ED.GRANERO:
      p(2, 10, 20, 11, "#9b4a35");
      for (let a = 3; a < 21; a += 4) p(a, 10, 1, 11, "#7d3a28");
      for (let k = 0; k < 4; k++) { const w = 24 - k * 3; p(12 - (w >> 1), 9 - k * 2, w, 3, k % 2 ? "#5e3226" : "#48251c"); }
      p(8, 13, 8, 8, "#e8d9b5");
      p(11, 13, 2, 8, "#7a4a2f");
      p(8, 13, 8, 1, "#b9a887");
      p(3, 18, 3, 3, "#d8bf72");
      break;
    case ED.TEMPLO:
      p(2, 19, 20, 3, "#b8bec7");
      p(3, 9, 18, 10, "#d9dfe7");
      for (const a of [4, 9, 14, 18]) { p(a, 10, 2, 9, "#b3bac4"); p(a, 10, 1, 9, "#eef2f7"); }
      p(10, 13, 5, 6, "#3b3f46");
      for (let k = 0; k < 4; k++) { const w = 22 - k * 4; p(12 - (w >> 1), 8 - k * 2, w, 3, k % 2 ? "#cfd6de" : "#aeb6c0"); }
      p(11, 0, 2, 4, "#facc15"); p(9, 1, 6, 2, "#facc15");
      p(17, 10, 4, 7, f.col); p(17, 10, 4, 1, f.col2);
      break;
    case ED.TORRE:
      p(6, 3, 12, 19, "#9ba3ad");
      p(6, 3, 3, 19, "#b6bdc6");
      p(15, 3, 3, 19, "#7d848d");
      for (let a = 5; a < 19; a += 4) p(a, 1, 3, 3, "#8c939c");
      p(6, 4, 12, 1, "#c6ccd4");
      p(10, 9, 4, 6, "#2b3038");
      p(18, 4, 5, 4, f.col); p(18, 4, 5, 1, f.col2);
      p(9, 17, 6, 5, "#4a4038");
      break;
    default:
      p(4, 13, 7, 8, "#7d7a74"); p(4, 13, 7, 1, "#9b9891");
      p(13, 15, 6, 6, "#6b6862");
      p(9, 10, 4, 5, "#8a8780");
      p(3, 19, 17, 2, "#5c5a55");
      p(15, 12, 3, 2, "#4f7a3a");
      break;
  }
}

function construirAtlas() {
  for (let t = 0; t < TP.length; t++) for (let v = 0; v < 3; v++) pintarSuelo(atlasSuelo.x, t, v);
  for (let tipo = 1; tipo <= 3; tipo++) for (let e = 0; e < 4; e++) pintarArbol(atlasArb.x, tipo, e);
  for (let tipo = 1; tipo <= 6; tipo++) for (let f = 0; f < PALETA_FAC.length; f++) pintarEdificio(atlasEd.x, tipo, f);
}

/* ============================================================
   3. Pintado del terreno en caché
   ============================================================ */
function etapaArbol(e) { return e < 70 ? 0 : e < 140 ? 1 : e < 210 ? 2 : 3; }

function pintarTileEn(i) {
  const gx = i % COLS, gy = (i / COLS) | 0;
  const x = gx * TILE, y = gy * TILE;
  const t = tiles[i];
  tctx.drawImage(atlasSuelo.c, varia[i] * TILE, t * TILE, TILE, TILE, x, y, TILE, TILE);
  orillas(i, gx, gy, x, y, t);
  if (arboles[i]) {
    tctx.drawImage(atlasArb.c, etapaArbol(edadArb[i]) * TILE, (arboles[i] - 1) * TILE, TILE, TILE, x, y, TILE, TILE);
  }
  if (edif[i]) {
    const fid = clamp((edifFac[i] || 1) - 1, 0, PALETA_FAC.length - 1);
    tctx.drawImage(atlasEd.c, edif[i] * TILE, fid * TILE, TILE, TILE, x, y, TILE, TILE);
  }
}

/* bordes de costa y acantilados: es lo que hace que el mapa no parezca cuadriculado */
function orillas(i, gx, gy, x, y, t) {
  const agua = esAgua(t);
  const vec = [[0, -1, 0], [1, 0, 1], [0, 1, 2], [-1, 0, 3]];
  for (const [dx, dy, lado] of vec) {
    if (!dentro(gx + dx, gy + dy)) continue;
    const nt = tiles[ti(gx + dx, gy + dy)];
    const nAgua = esAgua(nt);
    if (agua === nAgua) {
      if (!agua && t !== T.MOUNT && nt === T.MOUNT) continue;
      if (!agua && t === T.MOUNT && nt !== T.MOUNT) {
        tctx.fillStyle = "rgba(0,0,0,0.18)";
        if (lado === 2) tctx.fillRect(x, y + TILE - 3, TILE, 3);
      }
      continue;
    }
    if (agua) {
      tctx.fillStyle = "rgba(255,255,255,0.30)";
    } else {
      tctx.fillStyle = "rgba(226,200,140,0.75)";
    }
    if (lado === 0) tctx.fillRect(x, y, TILE, 2);
    else if (lado === 1) tctx.fillRect(x + TILE - 2, y, 2, TILE);
    else if (lado === 2) tctx.fillRect(x, y + TILE - 2, TILE, 2);
    else tctx.fillRect(x, y, 2, TILE);
  }
}

function pintarTerrenoCompleto() {
  for (let i = 0; i < NT; i++) pintarTileEn(i);
  sucios.clear();
  pintarTerritorio();
}

function pintarTerritorio() {
  const img = mctx.createImageData(COLS, ROWS);
  for (let i = 0; i < NT; i++) {
    const f = territorio[i];
    if (!f || !facciones[f - 1]) continue;
    const col = facciones[f - 1].col;
    img.data[i * 4] = parseInt(col.slice(1, 3), 16);
    img.data[i * 4 + 1] = parseInt(col.slice(3, 5), 16);
    img.data[i * 4 + 2] = parseInt(col.slice(5, 7), 16);
    img.data[i * 4 + 3] = 150;
  }
  mctx.putImageData(img, 0, 0);
}

/* ============================================================
   4. Sprites de criaturas
   ============================================================ */
const HS = 22, HH = 30, HANC = 11, HPIE = 23;   // tamaño y anclaje del sprite humano
const PIELES = ["#f0c08a", "#d99b63", "#a86f43"];
const PELOS = ["#3b2a1d", "#63391a", "#141922"];
const cacheH = new Map(), cacheA = new Map();

function dibujarSpriteHumano(x, fid, rol, look, frame, mirar) {
  const f = PALETA_FAC[fid] || { col: "#9ca3af", col2: "#4b5563" };
  const piel = PIELES[look], pelo = PELOS[look];
  const pielSom = look === 0 ? "#d9a473" : look === 1 ? "#b87f4d" : "#8c5934";
  if (mirar) { x.translate(HS, 0); x.scale(-1, 1); }
  const p = (a, b, w, h, col) => { x.fillStyle = col; x.fillRect(a, b, w, h); };

  const paso = frame === 1 ? 1 : frame === 3 ? -1 : 0;
  const bob = (frame === 1 || frame === 3) ? 1 : 0;
  const atacando = frame === 4;

  x.fillStyle = "rgba(0,0,0,0.22)";
  x.fillRect(5, HPIE + 1, 12, 3);
  x.fillRect(7, HPIE + 4, 8, 1);

  // piernas
  p(8, 18 + bob, 3, 5 - bob, "#41331f");
  p(12, 18 + bob, 3, 5 - bob, "#41331f");
  if (paso) { p(8 - paso, 21, 4, 2, "#41331f"); p(12 + paso, 21, 4, 2, "#41331f"); }
  p(7, 22, 4, 2, "#2c2117"); p(12, 22, 4, 2, "#2c2117");

  // cuerpo
  p(6, 10 + bob, 11, 9 - bob, f.col);
  p(6, 10 + bob, 4, 9 - bob, "#ffffff22");
  p(13, 10 + bob, 4, 9 - bob, f.col2);
  p(6, 16 + bob, 11, 2, "#5b4327");
  p(6, 10 + bob, 11, 1, "#ffffff33");

  // brazos
  const brA = atacando ? 8 : 11 + bob, brB = atacando ? 6 : 8;
  p(3, brA, 3, brB, f.col2);
  p(17, 11 + bob, 3, 7, f.col2);
  p(3, brA + brB - 1, 3, 2, piel);
  p(17, 17 + bob, 3, 2, piel);

  // cabeza
  p(7, 2 + bob, 9, 9, piel);
  p(13, 2 + bob, 3, 9, pielSom);
  p(6, 1 + bob, 11, 4, pelo);
  p(6, 4 + bob, 2, 3, pelo);
  p(15, 4 + bob, 2, 3, pelo);
  p(9, 6 + bob, 2, 2, "#22272f");
  p(13, 6 + bob, 2, 2, "#22272f");
  p(10, 9 + bob, 4, 1, pielSom);

  // oficio
  if (rol === "guerrero") {
    p(6, 0 + bob, 11, 3, "#b9c0c9"); p(6, 0 + bob, 11, 1, "#e4e9ee");
    p(11, 2 + bob, 1, 3, "#8e959e");
    if (atacando) { p(0, 4, 3, 12, "#e2e8f0"); p(0, 3, 3, 2, "#94a3b8"); p(1, 15, 2, 3, "#6b4a2a"); }
    else { p(2, 8, 2, 12, "#e2e8f0"); p(1, 18, 4, 2, "#6b4a2a"); }
    p(17, 11 + bob, 6, 8, f.col2); p(18, 12 + bob, 4, 6, f.col); p(19, 14 + bob, 2, 2, "#e8e2c9");
  } else if (rol === "cazador") {
    p(19, 8, 2, 12, "#8a5a2b");
    p(18, 8, 1, 2, "#8a5a2b"); p(18, 18, 1, 2, "#8a5a2b");
    p(18, 10, 1, 8, "#d8cfae");
    p(4, 7 + bob, 8, 2, "#4a3520");
    p(3, 5 + bob, 3, 5, "#6d4f2c");
  } else if (rol === "constructor") {
    p(4, 0 + bob, 15, 2, "#c9a24a"); p(6, 1 + bob, 11, 2, "#ab883a");
    p(1, atacando ? 5 : 12, 4, 3, "#9aa1aa"); p(2, atacando ? 8 : 15, 2, 5, "#7a5a33");
  } else if (rol === "profeta") {
    p(6, 10 + bob, 11, 9 - bob, "#e7e3d6");
    p(13, 10 + bob, 4, 9 - bob, "#c9c3b2");
    p(6, 16 + bob, 11, 2, f.col);
    p(5, -2 + bob, 13, 2, "#facc15");
    p(5, -1 + bob, 2, 2, "#fde68a"); p(16, -1 + bob, 2, 2, "#fde68a");
    p(19, 6, 2, 15, "#8a6a3a"); p(18, 4, 4, 3, "#facc15");
  }
}

function spriteHumano(h, frame) {
  const rol = h.profeta ? "profeta" : h.rol;
  const mirar = h.dx < 0 ? 1 : 0;
  const k = h.faccion + "|" + rol + "|" + h.look + "|" + frame + "|" + mirar;
  let s = cacheH.get(k);
  if (!s) {
    const l = lienzo(HS, HH);
    l.x.save();
    dibujarSpriteHumano(l.x, h.faccion, rol, h.look, frame, mirar);
    l.x.restore();
    s = l.c;
    cacheH.set(k, s);
  }
  return s;
}

const FORMAS = {
  oveja: (p, fr) => {
    p(1, 14, 20, 3, "sombra");
    p(3, 4, 15, 9, "#f4f7fa");
    p(3, 4, 15, 3, "#ffffff");
    p(4, 11, 14, 2, "#cbd5e1");
    for (let k = 0; k < 5; k++) p(3 + k * 3, 3, 3, 3, k % 2 ? "#ffffff" : "#e6ebf1");
    p(16, 5, 6, 6, "#3f4a57");
    p(20, 8, 2, 2, "#2a323c");
    p(16, 4, 2, 2, "#2a323c"); p(20, 4, 2, 2, "#2a323c");
    p(17, 6, 1, 1, "#e8edf2");
    p(5, 13, 3, 4 + (fr === 1 ? -1 : 0), "#3f4a57");
    p(13, 13, 3, 4 + (fr === 3 ? -1 : 0), "#3f4a57");
    p(9, 13, 2, 3, "#3f4a57");
  },
  conejo: (p, fr) => {
    p(2, 12, 13, 2, "sombra");
    p(2, 6, 10, 7, "#d8ccb8");
    p(2, 6, 10, 2, "#eee5d4");
    p(10, 4, 6, 6, "#d8ccb8");
    p(10, 0, 2, 5, "#c2b49c"); p(13, 0, 2, 5, "#c2b49c");
    p(10, 1, 1, 3, "#f0d9d9"); p(13, 1, 1, 3, "#f0d9d9");
    p(14, 6, 2, 2, "#2a2420");
    p(0, 7, 3, 3, "#fdfbf7");
    p(4, 12, 2, 2 + (fr === 1 ? -1 : 0), "#b9ab94");
    p(9, 12, 2, 2 + (fr === 3 ? -1 : 0), "#b9ab94");
  },
  ciervo: (p, fr) => {
    p(2, 20, 18, 3, "sombra");
    p(3, 8, 14, 8, "#b0784e");
    p(3, 8, 14, 2, "#c98f60");
    p(4, 14, 13, 2, "#8a5c39");
    p(14, 3, 5, 7, "#b0784e");
    p(16, 5, 5, 4, "#c08a5c");
    p(20, 6, 2, 2, "#2a2018");
    p(15, 0, 2, 4, "#7a5636"); p(19, 0, 2, 4, "#7a5636");
    p(13, 0, 3, 2, "#7a5636"); p(20, 0, 3, 2, "#7a5636");
    p(4, 16, 3, 6 + (fr === 1 ? -1 : 0), "#8a5c39");
    p(8, 16, 2, 6, "#8a5c39");
    p(13, 16, 3, 6 + (fr === 3 ? -1 : 0), "#8a5c39");
    p(6, 9, 2, 2, "#d8b48a"); p(10, 11, 2, 2, "#d8b48a");
  },
  lobo: (p, fr) => {
    p(1, 15, 22, 3, "sombra");
    p(2, 6, 16, 8, "#808b99");
    p(2, 6, 16, 2, "#9aa4b1");
    p(3, 12, 15, 2, "#5b636f");
    p(15, 3, 7, 7, "#8d97a4");
    p(21, 6, 3, 3, "#4b5563");
    p(15, 1, 2, 3, "#5b636f"); p(19, 1, 2, 3, "#5b636f");
    p(20, 5, 2, 2, "#fde68a");
    p(0, 4, 4, 4, "#6d7683");
    p(3, 14, 3, 5 + (fr === 1 ? -1 : 0), "#5b636f");
    p(7, 14, 2, 5, "#5b636f");
    p(13, 14, 3, 5 + (fr === 3 ? -1 : 0), "#5b636f");
  },
  oso: (p, fr) => {
    p(1, 18, 25, 4, "sombra");
    p(2, 5, 19, 13, "#5f4a38");
    p(2, 5, 19, 3, "#735b45");
    p(3, 15, 18, 3, "#3f3128");
    p(17, 2, 9, 9, "#6b523d");
    p(24, 6, 3, 3, "#2a201a");
    p(17, 0, 3, 3, "#4a382a"); p(23, 0, 3, 3, "#4a382a");
    p(22, 4, 2, 2, "#1f1813");
    p(3, 17, 5, 4 + (fr === 1 ? -1 : 0), "#4a382a");
    p(10, 17, 4, 4, "#4a382a");
    p(16, 17, 5, 4 + (fr === 3 ? -1 : 0), "#4a382a");
  },
};
const TAM_A = { oveja: [22, 18], conejo: [16, 15], ciervo: [24, 24], lobo: [25, 20], oso: [28, 23] };

function spriteAnimal(a, frame) {
  const mirar = a.dx < 0 ? 1 : 0;
  const k = a.esp + "|" + frame + "|" + mirar;
  let s = cacheA.get(k);
  if (!s) {
    const [w, h] = TAM_A[a.esp];
    const l = lienzo(w, h);
    l.x.save();
    if (mirar) { l.x.translate(w, 0); l.x.scale(-1, 1); }
    const p = (x1, y1, w1, h1, col) => {
      l.x.fillStyle = col === "sombra" ? "rgba(0,0,0,0.22)" : col;
      l.x.fillRect(x1, y1, w1, h1);
    };
    FORMAS[a.esp](p, frame);
    l.x.restore();
    s = l.c;
    cacheA.set(k, s);
  }
  return s;
}

function cuadro(e) {
  const v = Math.abs(e.x - e.px) + Math.abs(e.y - e.py);
  if (v < 0.04) return 0;
  return (e.anim | 0) & 3;
}

function dibujarHumano(c, h, det, al) {
  const x = h.px + (h.x - h.px) * al, y = h.py + (h.y - h.py) * al;
  const f = facciones[h.faccion] || { col: "#9ca3af" };
  if (!det) {
    c.fillStyle = f.col;
    c.fillRect(Math.round(x) - 2, Math.round(y) - 3, 4, 6);
    if (h.profeta) { c.fillStyle = "#facc15"; c.fillRect(Math.round(x) - 2, Math.round(y) - 5, 4, 1); }
    return;
  }
  const frame = h.golpe > 4 ? 4 : cuadro(h);
  const s = spriteHumano(h, frame);
  const px = Math.round(x) - HANC, py = Math.round(y) - HPIE + 2;
  c.drawImage(s, px, py);
  if (h.enfermo > 0) { c.fillStyle = "#a3e635"; c.fillRect(px + 2, py + 2, 2, 2); }
  if (h.hp < h.hpMax * 0.45) {
    c.fillStyle = "#1f2937"; c.fillRect(px + 4, py - 3, 14, 3);
    c.fillStyle = "#ef4444"; c.fillRect(px + 5, py - 2, Math.round(12 * h.hp / h.hpMax), 1);
  }
  if (h === seleccion.ref || h === charlando) {
    c.strokeStyle = h === charlando ? "#facc15" : "#ffffff";
    c.lineWidth = 1;
    c.strokeRect(px + 2.5, py - 0.5, HS - 5, HPIE);
  }
}

function dibujarAnimal(c, a, det, al) {
  const x = a.px + (a.x - a.px) * al, y = a.py + (a.y - a.py) * al;
  const E = ESPECIES[a.esp];
  if (!det) {
    c.fillStyle = E.col;
    c.fillRect(Math.round(x) - 2, Math.round(y) - 2, 4, 4);
    return;
  }
  const s = spriteAnimal(a, cuadro(a));
  const [w, h] = TAM_A[a.esp];
  const px = Math.round(x) - (w >> 1), py = Math.round(y) - h + 6;
  c.drawImage(s, px, py);
  if (a === seleccion.ref) {
    c.strokeStyle = "#ffffff"; c.lineWidth = 1;
    c.strokeRect(px + 0.5, py + 0.5, w - 1, h - 1);
  }
}

/* ============================================================
   5. Cámara y render
   ============================================================ */
function ajustarLienzo() {
  const wrap = document.getElementById("stage-wrap");
  canvas.width = wrap.clientWidth;
  canvas.height = wrap.clientHeight;
  ctx.imageSmoothingEnabled = false;
}
function verTodo() {
  camara.zoom = Math.min(canvas.width / W_PX, canvas.height / H_PX) * 0.98;
  centrarEn(W_PX / 2, H_PX / 2);
}
function centrarEn(wx, wy) {
  camara.x = wx - canvas.width / (2 * camara.zoom);
  camara.y = wy - canvas.height / (2 * camara.zoom);
}
function pantallaAMundo(sx, sy) {
  return { x: camara.x + sx / camara.zoom, y: camara.y + sy / camara.zoom };
}

function dibujar(al) {
  if (sucios.size) { for (const i of sucios) pintarTileEn(i); sucios.clear(); }

  const w = canvas.width, h = canvas.height;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#060b16";
  ctx.fillRect(0, 0, w, h);

  let sx = 0, sy = 0;
  if (sacudida > 0) {
    sx = (Math.random() - 0.5) * sacudida * 2;
    sy = (Math.random() - 0.5) * sacudida * 2;
    sacudida -= 0.6;
  }
  const z = camara.zoom;
  ctx.setTransform(z, 0, 0, z, -camara.x * z + sx, -camara.y * z + sy);

  ctx.drawImage(terreno, 0, 0);
  if (mostrarTerr) {
    ctx.globalAlpha = 0.45;
    ctx.drawImage(mapaTerr, 0, 0, W_PX, H_PX);
    ctx.globalAlpha = 1;
  }

  const det = z >= 0.45;
  const x0 = camara.x - 40, y0 = camara.y - 40;
  const x1 = camara.x + w / z + 40, y1 = camara.y + h / z + 40;

  dibujarFuegos(x0, y0, x1, y1);

  for (const a of animales) {
    if (a.x < x0 || a.x > x1 || a.y < y0 || a.y > y1) continue;
    dibujarAnimal(ctx, a, det, al);
  }
  for (const hu of humanos) {
    if (hu.x < x0 || hu.x > x1 || hu.y < y0 || hu.y > y1) continue;
    dibujarHumano(ctx, hu, det, al);
  }

  dibujarEfectos();
  dibujarPincel();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

function dibujarFuegos(x0, y0, x1, y1) {
  if (!fuegos.size) return;
  const t = performance.now() * 0.012;
  for (const i of fuegos) {
    const x = (i % COLS) * TILE, y = ((i / COLS) | 0) * TILE;
    if (x < x0 || x > x1 || y < y0 || y > y1) continue;
    const o = Math.sin(t + i) * 2, o2 = Math.cos(t * 1.3 + i * 0.7) * 2;
    ctx.fillStyle = "rgba(255,120,20,0.85)";
    ctx.fillRect(x + 4, y + 10 + o, 7, 12 - o);
    ctx.fillRect(x + 13, y + 12 + o2, 6, 10 - o2);
    ctx.fillStyle = "rgba(255,190,40,0.95)";
    ctx.fillRect(x + 7, y + 14 + o, 4, 8);
    ctx.fillRect(x + 14, y + 15 + o2, 3, 7);
    ctx.fillStyle = "rgba(255,245,180,0.9)";
    ctx.fillRect(x + 9, y + 18, 3, 4);
    ctx.fillStyle = "rgba(40,30,30,0.28)";
    ctx.fillRect(x + 6 + o, y + 2, 5, 5);
  }
}

function dibujarEfectos() {
  for (let k = efectos.length - 1; k >= 0; k--) {
    const e = efectos[k];
    e.t--;
    if (e.t <= 0) { efectos.splice(k, 1); continue; }
    if (e.tipo === "rayo") {
      ctx.strokeStyle = e.t > 4 ? "#fef9c3" : "#fde047";
      ctx.lineWidth = 3;
      ctx.beginPath();
      let px = e.x, py = Math.max(0, e.y - 520);
      ctx.moveTo(px, py);
      while (py < e.y) { py += 52; px += (Math.random() - 0.5) * 40; ctx.lineTo(px, Math.min(py, e.y)); }
      ctx.stroke();
      ctx.fillStyle = "rgba(254,240,138,0.22)";
      ctx.fillRect(e.x - 44, e.y - 44, 88, 88);
    } else if (e.tipo === "boom") {
      const r = e.r * (1 - e.t / e.max);
      ctx.strokeStyle = `rgba(255,${120 + e.t * 4},40,${e.t / e.max})`;
      ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(e.x, e.y, r, 0, 7); ctx.stroke();
    } else if (e.tipo === "brillo") {
      ctx.fillStyle = `rgba(250,204,21,${e.t / e.max * 0.45})`;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r * (e.t / e.max), 0, 7); ctx.fill();
    }
  }
}

function dibujarPincel() {
  if (!raton.dentro || poder.id === "mano") return;
  const m = pantallaAMundo(raton.x, raton.y);
  const r = (poder.radioFijo || pincel) * TILE;
  ctx.strokeStyle = poder.clase === "castigo" ? "rgba(248,113,113,0.85)" : "rgba(250,204,21,0.8)";
  ctx.lineWidth = 2 / camara.zoom;
  ctx.beginPath();
  ctx.arc(Math.floor(m.x / TILE) * TILE + TILE / 2, Math.floor(m.y / TILE) * TILE + TILE / 2, r, 0, 7);
  ctx.stroke();
}

function efecto(tipo, x, y, r, dur) { efectos.push({ tipo, x, y, r: r || 40, t: dur || 14, max: dur || 14 }); }

/* ============================================================
   6. Poderes
   ============================================================ */
let pincel = 3;
let poder = null;

function centroTile(gx, gy) { return { x: gx * TILE + TILE / 2, y: gy * TILE + TILE / 2 }; }

const PODERES = [
  {
    grupo: "Herramientas", id: "mano", ic: "🖐", nm: "Mano", ky: null,
    ds: "Arrastra para mover la cámara. Haz clic sobre una criatura o una casa para abrir su ficha."
  },

  {
    grupo: "Terreno", id: "pasto", ic: "🟩", nm: "Pradera", ky: "1", pintar: true,
    ds: "Cubre la tierra de hierba fértil.",
    ap: (gx, gy, r) => enCirculo(gx, gy, r, (x, y, i) => { if (tiles[i] !== T.DEEP) pintarTile(i, T.GRASS); })
  },
  {
    grupo: "Terreno", id: "arena", ic: "🟨", nm: "Arena", ky: "2", pintar: true,
    ds: "Convierte la zona en arena seca.",
    ap: (gx, gy, r) => enCirculo(gx, gy, r, (x, y, i) => { if (tiles[i] !== T.DEEP) pintarTile(i, T.SAND); })
  },
  {
    grupo: "Terreno", id: "agua", ic: "💧", nm: "Mar", ky: "3", pintar: true,
    ds: "Inunda la tierra. Lo que no sepa nadar, se ahoga.",
    ap: (gx, gy, r, px, py) => {
      enCirculo(gx, gy, r, (x, y, i) => pintarTile(i, T.WATER));
      matarCriaturas(px, py, r * TILE * 0.8, 0.5, "se ahoga.");
    }
  },
  {
    grupo: "Terreno", id: "montana", ic: "⛰", nm: "Montaña", ky: "4", pintar: true,
    ds: "Levanta roca y montañas.",
    ap: (gx, gy, r) => enCirculo(gx, gy, r, (x, y, i) => { if (!esAgua(tiles[i])) pintarTile(i, T.MOUNT); })
  },
  {
    grupo: "Terreno", id: "nieve", ic: "🌨", nm: "Nieve", ky: "5", pintar: true,
    ds: "Trae el invierno: nieve y hielo sobre el agua.",
    ap: (gx, gy, r) => enCirculo(gx, gy, r, (x, y, i) => {
      if (esAgua(tiles[i])) pintarTile(i, T.ICE); else if (tiles[i] !== T.LAVA) pintarTile(i, T.SNOW);
      apagar(i);
    })
  },

  {
    grupo: "Naturaleza", id: "bosque", ic: "🌲", nm: "Bosque", ky: "6", pintar: true,
    ds: "Hace brotar árboles allí donde la tierra lo permite.",
    ap: (gx, gy, r) => enCirculo(gx, gy, r, (x, y, i) => { if (chance(0.7)) plantarArbol(i); })
  },
  {
    grupo: "Naturaleza", id: "lluvia", ic: "🌧", nm: "Lluvia", ky: "7", pintar: true, clase: "milagro",
    ds: "Apaga incendios, enfría la lava y reverdece la tierra. Los humanos lo viven como un milagro.",
    ap: (gx, gy, r, px, py) => {
      enCirculo(gx, gy, r, (x, y, i) => {
        apagar(i);
        if (tiles[i] === T.LAVA) pintarTile(i, T.MOUNT);
        if (tiles[i] === T.ASH && chance(0.3)) pintarTile(i, T.GRASS);
        if (tiles[i] === T.DRY && chance(0.12)) pintarTile(i, T.GRASS);
      });
      poderUsadoCerca(px, py, r * TILE, "milagro");
    }
  },
  {
    grupo: "Naturaleza", id: "fertilidad", ic: "🌱", nm: "Fertilidad", ky: "8", pintar: true, clase: "milagro",
    ds: "La tierra florece: la ceniza revive, los árboles crecen de golpe.",
    ap: (gx, gy, r, px, py) => {
      fertilizar(gx, gy, r);
      efecto("brillo", px, py, r * TILE, 20);
      poderUsadoCerca(px, py, r * TILE, "milagro");
    }
  },

  {
    grupo: "Desastres", id: "fuego", ic: "🔥", nm: "Fuego", ky: "9", pintar: true, clase: "castigo",
    ds: "Prende lo que tenga con qué arder. Los bosques arden despacio; la hierba apenas prende.",
    ap: (gx, gy, r, px, py) => {
      enCirculo(gx, gy, r, (x, y, i) => { if (chance(0.8)) encender(i); });
      poderUsadoCerca(px, py, r * TILE, "castigo");
    }
  },
  {
    grupo: "Desastres", id: "rayo", ic: "⚡", nm: "Rayo", ky: "0", clase: "castigo", radioFijo: 2,
    ds: "Un rayo cae del cielo. Quien lo ve de cerca, no lo olvida.",
    ap: (gx, gy, r, px, py) => {
      efecto("rayo", px, py, 0, 12);
      enCirculo(gx, gy, 1, (x, y, i) => { if (chance(0.55)) encender(i, 40); });
      matarCriaturas(px, py, 16 * U, 0.85, "muere fulminado por un rayo.");
      poderUsadoCerca(px, py, 130 * U, "castigo");
      sacudida = 5;
    }
  },
  {
    grupo: "Desastres", id: "meteorito", ic: "☄", nm: "Meteorito", ky: "q", clase: "castigo",
    ds: "Impacto devastador: cráter de lava, anillo de fuego y muerte alrededor.",
    ap: (gx, gy, r, px, py) => {
      const R = Math.max(r, 3);
      enCirculo(gx, gy, R, (x, y, i) => { if (chance(0.5)) ponerLava(i, 60 + randi(50)); else pintarTile(i, T.ASH); });
      enCirculo(gx, gy, R + 2, (x, y, i) => { if (chance(0.4)) encender(i); });
      matarCriaturas(px, py, (R + 2) * TILE, 0.92, "desaparece bajo el impacto.");
      efecto("boom", px, py, (R + 4) * TILE, 22);
      poderUsadoCerca(px, py, (R + 8) * TILE, "castigo");
      sacudida = 16;
      registrar("☄ Una roca ardiente cae del cielo.", "desastre");
    }
  },
  {
    grupo: "Desastres", id: "terremoto", ic: "〰", nm: "Terremoto", ky: "w", clase: "castigo",
    ds: "La tierra se parte: levanta roca y derrumba edificios.",
    ap: (gx, gy, r, px, py) => {
      const R = Math.max(r, 4);
      enCirculo(gx, gy, R, (x, y, i) => {
        if (edif[i] && chance(0.5)) destruirEdificio(i);
        if (chance(0.25) && caminable(tiles[i])) pintarTile(i, chance(0.6) ? T.MOUNT : T.ASH);
      });
      matarCriaturas(px, py, R * TILE, 0.12, "muere bajo los escombros.");
      poderUsadoCerca(px, py, R * TILE * 1.4, "castigo");
      sacudida = 14;
      registrar("〰 Un terremoto sacude la tierra.", "desastre");
    }
  },
  {
    grupo: "Desastres", id: "volcan", ic: "🌋", nm: "Volcán", ky: "e", clase: "castigo", radioFijo: 1,
    ds: "Crea un volcán permanente que entrará en erupción una y otra vez.",
    ap: (gx, gy, r, px, py) => {
      const i = ti(gx, gy);
      pintarTile(i, T.MOUNT);
      if (volcanes.indexOf(i) < 0) volcanes.push(i);
      erupcion(i);
      poderUsadoCerca(px, py, 200 * U, "castigo");
      sacudida = 10;
      registrar("🌋 Nace un volcán.", "desastre");
    }
  },
  {
    grupo: "Desastres", id: "peste", ic: "☣", nm: "Peste", ky: "r", pintar: true, clase: "castigo",
    ds: "Una enfermedad que se contagia sola y consume a quien la sufre.",
    ap: (gx, gy, r, px, py) => {
      let n = 0;
      hashConsulta(hashH, px, py, r * TILE, h => { h.enfermo = 400 + randi(300); n++; });
      poderUsadoCerca(px, py, r * TILE, "castigo");
      if (n) registrar(`☣ Una peste se desata sobre ${n} personas.`, "desastre");
    }
  },

  {
    grupo: "Vida", id: "humano", ic: "🧑", nm: "Humano", ky: "a", pintar: true,
    ds: "Aparecen humanos. Lejos de toda tribu conocida, nacerá una nueva.",
    ap: (gx, gy, r, px, py) => {
      if (humanos.length >= MAX_HUM) return;
      const fid = faccionPara(px, py);
      if (fid < 0) return;
      enCirculo(gx, gy, Math.min(r, 3), (x, y, i) => {
        if (caminable(tiles[i]) && chance(0.14) && humanos.length < MAX_HUM) {
          crearHumano(x * TILE + TILE / 2, y * TILE + TILE / 2, fid);
        }
      });
    }
  },
  { grupo: "Vida", id: "oveja", ic: "🐑", nm: "Oveja", ky: "s", pintar: true, ds: "Rebaños de ovejas, alimento de lobos y cazadores.", ap: spawnEsp("oveja") },
  { grupo: "Vida", id: "conejo", ic: "🐇", nm: "Conejo", ky: "d", pintar: true, ds: "Se reproducen rápido y huyen de todo.", ap: spawnEsp("conejo") },
  { grupo: "Vida", id: "ciervo", ic: "🦌", nm: "Ciervo", ky: "f", pintar: true, ds: "Habitan los bosques. Presa favorita de lobos y cazadores.", ap: spawnEsp("ciervo") },
  { grupo: "Vida", id: "lobo", ic: "🐺", nm: "Lobo", ky: "g", pintar: true, ds: "Cazan en la pradera. Si tienen mucha hambre, atacan personas.", ap: spawnEsp("lobo") },
  { grupo: "Vida", id: "oso", ic: "🐻", nm: "Oso", ky: null, pintar: true, ds: "Rey del bosque: mata lobos y humanos por igual.", ap: spawnEsp("oso") },

  {
    grupo: "Divino", id: "bendecir", ic: "✨", nm: "Bendecir", ky: null, pintar: true, clase: "milagro",
    ds: "Sana a todos, calma su hambre y hace crecer su fe en ti.",
    ap: (gx, gy, r, px, py) => {
      const n = curarZona(px, py, r * TILE);
      poderUsadoCerca(px, py, r * TILE, "milagro");
      efecto("brillo", px, py, r * TILE, 24);
      if (n > 3) registrar(`✨ Una luz cae sobre ${n} personas y sana sus heridas.`, "fe");
    }
  },
  {
    grupo: "Divino", id: "curar", ic: "💚", nm: "Curar", ky: null, pintar: true,
    ds: "Cura heridas y enfermedades sin revelarte.",
    ap: (gx, gy, r, px, py) => {
      curarZona(px, py, r * TILE);
      hashConsulta(hashH, px, py, r * TILE, h => h.enfermo = 0);
    }
  },
  {
    grupo: "Divino", id: "ira", ic: "☠", nm: "Ira divina", ky: null, clase: "castigo", radioFijo: 2,
    ds: "Castigo fulminante sobre un punto concreto. El resto lo verá y lo temerá.",
    ap: (gx, gy, r, px, py) => {
      efecto("rayo", px, py, 0, 10);
      efecto("boom", px, py, 40 * U, 16);
      matarCriaturas(px, py, 22 * U, 1, "es fulminado por la ira de la Voz.");
      poderUsadoCerca(px, py, 200 * U, "castigo");
      sacudida = 8;
    }
  },
  {
    grupo: "Divino", id: "borrar", ic: "🧹", nm: "Borrar", ky: null, pintar: true,
    ds: "Elimina criaturas y apaga el fuego, sin tocar la tierra.",
    ap: (gx, gy, r, px, py) => {
      matarCriaturas(px, py, r * TILE, 1);
      enCirculo(gx, gy, r, (x, y, i) => apagar(i));
    }
  },
];

function spawnEsp(esp) {
  return (gx, gy, r) => {
    enCirculo(gx, gy, Math.min(r, 3), (x, y, i) => {
      if (animales.length >= MAX_ANI) return;
      if (caminable(tiles[i]) && chance(0.13)) crearAnimal(x * TILE + TILE / 2, y * TILE + TILE / 2, esp);
    });
  };
}

function faccionPara(px, py) {
  const i = idxDe(px, py);
  if (territorio[i]) return territorio[i] - 1;
  const cerca = hashCercano(hashH, px, py, 260 * U, () => true);
  if (cerca) return cerca.faccion;
  if (facciones.length < PALETA_FAC.length) {
    const pal = PALETA_FAC[facciones.length];
    facciones.push({
      id: facciones.length, nombre: nombreFaccion(), col: pal.col, col2: pal.col2,
      guerras: new Set(), fe: 0, pop: 0, vivo: true,
    });
    registrar(`Una nueva tribu abre los ojos: <b>${facciones[facciones.length - 1].nombre}</b>.`, "pueblo");
    return facciones.length - 1;
  }
  return facciones.length ? randi(facciones.length) : -1;
}

/* ============================================================
   7. Interfaz de poderes
   ============================================================ */
const powersEl = document.getElementById("powers");
const teclaPoder = {};

function construirMenu() {
  const grupos = [];
  for (const p of PODERES) {
    let g = grupos.find(x => x.n === p.grupo);
    if (!g) { g = { n: p.grupo, ps: [] }; grupos.push(g); }
    g.ps.push(p);
    if (p.ky) teclaPoder[p.ky] = p;
  }
  powersEl.innerHTML = "";
  for (const g of grupos) {
    const div = document.createElement("div");
    div.className = "pw-group";
    div.innerHTML = `<h4>${g.n}</h4><div class="pw-grid"></div>`;
    const grid = div.querySelector(".pw-grid");
    for (const p of g.ps) {
      const b = document.createElement("button");
      b.className = "power-btn";
      b.dataset.id = p.id;
      b.innerHTML = `${p.ky ? `<span class="ky">${p.ky.toUpperCase()}</span>` : ""}
        <span class="ic">${p.ic}</span><span class="nm">${p.nm}</span>`;
      b.addEventListener("click", () => elegirPoder(p));
      grid.appendChild(b);
    }
    powersEl.appendChild(div);
  }
}

function elegirPoder(p) {
  poder = p;
  document.getElementById("piName").textContent = `${p.ic} ${p.nm}`;
  document.getElementById("piDesc").textContent = p.ds;
  document.querySelectorAll(".power-btn").forEach(el => el.classList.toggle("sel", el.dataset.id === p.id));
  canvas.style.cursor = p.id === "mano" ? "grab" : "crosshair";
}

/* ============================================================
   8. Ficha y selección
   ============================================================ */
let seleccion = { tipo: null, ref: null };

function barra(v, max, col) {
  return `<div class="bar"><i style="width:${clamp(v / max * 100, 0, 100)}%;background:${col}"></i></div>`;
}

function estadoTexto(e) {
  const m = {
    vagar: "deambula", comer: "busca comida", cazar: "está cazando", luchar: "combate",
    marchar: "marcha a la guerra", construir: "construye", huir: "huye", rezar: "reza",
    predicar: "predica", migrar: "migra", plantar: "planta árboles", "buscar sitio": "busca dónde asentarse",
    pastar: "pasta", acechar: "acecha a alguien",
  };
  return m[e.estado] || e.estado;
}

function seleccionar(tipo, ref) {
  seleccion = { tipo, ref };
  pintarFicha();
}

function pintarFicha() {
  const cont = document.getElementById("fichaBody");
  const s = seleccion;
  if (!s.ref) {
    cont.innerHTML = `<div class="empty">Selecciona la mano 🖐 y haz clic sobre un humano, un animal
      o una casa para ver quién es y qué está haciendo.</div>`;
    return;
  }

  if (s.tipo === "humano") {
    const h = s.ref;
    const f = facciones[h.faccion] || {};
    const p = pueblos[h.pueblo];
    cont.innerHTML = `
      <div class="ficha-head">
        <div class="av">${h.profeta ? "🙏" : h.rol === "guerrero" ? "⚔" : h.rol === "cazador" ? "🏹" : h.rol === "constructor" ? "🔨" : "🧑"}</div>
        <div>
          <div class="tt">${h.nombre}</div>
          <div class="st"><span class="chip-fac" style="background:${f.col}"></span>${f.nombre || "sin tribu"}</div>
        </div>
      </div>
      <div class="rows">
        <span>Oficio</span><span>${cap(h.rol)}${h.profeta ? " · profeta" : ""}</span>
        <span>Carácter</span><span>${cap(h.rasgo)}</span>
        <span>Pueblo</span><span>${p ? p.nombre : "sin pueblo"}</span>
        <span>Edad</span><span>${Math.floor(h.edad / TICKS_DIA)} días</span>
        <span>Hace</span><span>${estadoTexto(h)}${h.enfermo > 0 ? " · <b style='color:#a3e635'>enfermo</b>" : ""}</span>
      </div>
      <div style="margin-top:.45rem">
        <div style="font-size:.68rem;color:var(--muted)">Salud</div>${barra(h.hp, h.hpMax, "#4ade80")}
        <div style="font-size:.68rem;color:var(--muted);margin-top:.25rem">Hambre</div>${barra(h.hambre, 160, "#fb923c")}
        <div style="font-size:.68rem;color:var(--muted);margin-top:.25rem">Fe en ti</div>${barra(h.fe, 100, "#facc15")}
        <div style="font-size:.68rem;color:var(--muted);margin-top:.25rem">Miedo</div>${barra(h.miedo, 100, "#a855f7")}
      </div>
      ${h.orden ? `<div style="margin-top:.4rem;font-size:.7rem;color:var(--gold)">Sigue tu palabra: ${nombreOrden(h.orden)}</div>` : ""}
      <button class="btn-wide" id="btnHablar">🗣 Hablarle</button>`;
    document.getElementById("btnHablar").addEventListener("click", () => abrirChat(h));

  } else if (s.tipo === "animal") {
    const a = s.ref, E = ESPECIES[a.esp];
    cont.innerHTML = `
      <div class="ficha-head">
        <div class="av">${a.esp === "oveja" ? "🐑" : a.esp === "conejo" ? "🐇" : a.esp === "ciervo" ? "🦌" : a.esp === "lobo" ? "🐺" : "🐻"}</div>
        <div><div class="tt">${E.n}</div><div class="st">${E.tipo === "carn" ? "Depredador" : "Herbívoro"}</div></div>
      </div>
      <div class="rows">
        <span>Edad</span><span>${Math.floor(a.edad / TICKS_DIA)} días</span>
        <span>Hace</span><span>${estadoTexto(a)}</span>
        ${E.presas ? `<span>Caza</span><span>${E.presas.join(", ")}</span>` : ""}
      </div>
      <div style="margin-top:.45rem">
        <div style="font-size:.68rem;color:var(--muted)">Salud</div>${barra(a.hp, a.hpMax, "#4ade80")}
        <div style="font-size:.68rem;color:var(--muted);margin-top:.25rem">Hambre</div>${barra(a.hambre, 160, "#fb923c")}
      </div>`;

  } else if (s.tipo === "edificio") {
    const i = s.ref, p = puebloEn(i), f = facciones[edifFac[i] - 1] || {};
    cont.innerHTML = `
      <div class="ficha-head">
        <div class="av">🏠</div>
        <div><div class="tt">${NOMBRE_ED[edif[i]]}</div>
        <div class="st"><span class="chip-fac" style="background:${f.col || "#888"}"></span>${f.nombre || "sin dueño"}</div></div>
      </div>
      ${p ? `<div class="rows">
        <span>Pueblo</span><span>${p.nombre}</span>
        <span>Rango</span><span>${NIVEL_PUEBLO[p.nivel]}</span>
        <span>Habitantes</span><span>${p.pop}</span>
        <span>Fundado</span><span>día ${p.dia}</span>
        <span>Comida</span><span>${Math.round(p.comida)}</span>
        <span>Fe media</span><span>${Math.round(p.fe)} / 100</span>
      </div>` : ""}
      <div style="margin-top:.45rem"><div style="font-size:.68rem;color:var(--muted)">Estructura</div>
      ${barra(edifHp[i], 70, "#94a3b8")}</div>`;

  } else {
    const i = s.ref;
    const f = territorio[i] ? facciones[territorio[i] - 1] : null;
    cont.innerHTML = `
      <div class="ficha-head"><div class="av">🗺</div>
      <div><div class="tt">${NOMBRE_TILE[tiles[i]]}</div>
      <div class="st">${arboles[i] ? NOMBRE_ARB[arboles[i]] : "sin vegetación"}</div></div></div>
      <div class="rows">
        <span>Coordenadas</span><span>${i % COLS}, ${(i / COLS) | 0}</span>
        <span>Territorio</span><span>${f ? f.nombre : "tierra libre"}</span>
        <span>Estado</span><span>${fuego[i] > 0 ? "🔥 ardiendo" : "tranquilo"}</span>
      </div>`;
  }
}

function nombreOrden(o) {
  const m = {
    migrar: "migrar lejos", fundar: "fundar un pueblo", cazar: "cazar", plantar: "plantar árboles",
    predicar: "difundir tu palabra", atacar: "empujar a la guerra", paz: "buscar la paz", rezar: "rezar",
    construir: "construir",
  };
  let t = m[o.tipo] || o.tipo;
  if ((o.tipo === "atacar" || o.tipo === "paz") && facciones[o.datos]) t += ` con ${facciones[o.datos].nombre}`;
  return t;
}

function alMorirCriatura(e) {
  if (seleccion.ref === e) { seleccion = { tipo: null, ref: null }; pintarFicha(); }
  if (charlando === e) {
    mensaje("nar", `${e.nombre} ha muerto. La voz se queda sin oídos.`);
    charlando = null;
    document.getElementById("chatChips").innerHTML = "";
  }
}

/* ============================================================
   9. La voz divina
   ============================================================ */
let charlando = null;

const panelChat = document.getElementById("panelChat");
const chatLog = document.getElementById("chatLog");
const chatChips = document.getElementById("chatChips");

function norm(s) { return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); }

function abrirChat(h) {
  charlando = h;
  panelChat.hidden = false;
  document.getElementById("chatTitle").textContent = h.nombre;
  chatLog.innerHTML = "";
  h.conocido = true;
  if (h.fe < 10) mensaje("nar", `${h.nombre} se detiene en seco. Nadie más oye esta voz.`);
  else mensaje("nar", `${h.nombre} reconoce la voz y baja la cabeza.`);
  pintarChips();
  panelChat.scrollIntoView({ block: "nearest" });
  document.getElementById("chatInput").focus();
}

function cerrarChat() {
  charlando = null;
  panelChat.hidden = true;
}

function mensaje(clase, texto, quien) {
  const d = document.createElement("div");
  d.className = "msg " + clase;
  d.innerHTML = (quien ? `<span class="who">${quien}</span>` : "") + texto;
  chatLog.appendChild(d);
  chatLog.scrollTop = chatLog.scrollHeight;
}

const INTENCIONES = [
  { id: "presentar", claves: ["quien eres", "soy tu dios", "soy dios", "tu dios", "soy la voz", "escuchame", "escucha", "creador", "hola", "saludos", "me oyes", "quien habla"] },
  { id: "bendecir", claves: ["te bendigo", "bendicion", "bendito", "te protejo", "estare contigo", "te cuido"] },
  { id: "amenazar", claves: ["obedece", "te castigare", "castigo", "o si no", "muere", "teme", "arrodillate", "arrepientete", "ira"] },
  { id: "predicar", claves: ["predica", "difunde", "cuentales", "diles", "profeta", "habla de mi", "mi palabra", "anuncia", "convence"] },
  { id: "fundar", claves: ["funda", "fundar", "pueblo aqui", "asienta", "asentar", "establece", "quedate aqui", "tu hogar aqui"] },
  { id: "construir", claves: ["construye", "edifica", "levanta", "granero", "templo", "casas"] },
  { id: "migrar", claves: ["migra", "muevete", "vete", "viaja", "camina", "abandona", "explora", "marchate", "al norte", "al sur", "al este", "al oeste", "lejos"] },
  { id: "cazar", claves: ["caza", "cazar", "busca comida", "comida", "alimenta", "hambre", "come"] },
  { id: "plantar", claves: ["planta", "siembra", "arbol", "arboles", "bosque", "semilla"] },
  { id: "atacar", claves: ["guerra", "ataca", "atacad", "destruye", "mata a", "venganza", "invade", "pelea", "aniquila", "conquista", "enemigo", "enemigos", "acaba con", "expulsa", "no confies"] },
  { id: "paz", claves: ["paz", "perdona", "tregua", "amistad", "deja de pelear", "no luches", "reconcil", "hermanos"] },
  { id: "rezar", claves: ["reza", "ora", "adora", "ritual", "templo a mi", "fe"] },
  { id: "preguntar", claves: ["como estas", "que ves", "que pasa", "como te llamas", "que necesitas", "que haces", "donde estas", "cuentame", "quien eres tu"] },
  { id: "despedir", claves: ["adios", "hasta luego", "me voy", "suerte", "descansa", "hasta pronto"] },
];

function interpretar(txt) {
  const t = norm(txt);
  for (const it of INTENCIONES) for (const k of it.claves) if (t.indexOf(k) >= 0) return it.id;
  if (t.indexOf("?") >= 0) return "preguntar";
  return "confuso";
}

function faccionMencionada(txt, excepto) {
  const t = norm(txt);
  for (const f of facciones) {
    if (f.id === excepto || !f.vivo) continue;
    if (t.indexOf(norm(f.nombre)) >= 0) return f.id;
    const corto = norm(f.nombre.split(" ").pop());
    if (corto.length > 3 && t.indexOf(corto) >= 0) return f.id;
  }
  return -1;
}

function rivalDe(h) {
  let peor = -1, val = 999;
  for (const f of facciones) {
    if (f.id === h.faccion || !f.vivo) continue;
    const r = relGet(h.faccion, f.id);
    if (r < val) { val = r; peor = f.id; }
  }
  return peor;
}

function tono(h) {
  if (h.fe < 12) return 0;
  if (h.fe < 35) return 1;
  if (h.fe < 68) return 2;
  return 3;
}

function convencer(h, base, extra) {
  let p = base + h.fe * 0.0065 + h.miedo * 0.0022 + (extra || 0);
  if (h.rasgo === "devoto") p += 0.18;
  if (h.rasgo === "escéptico") p -= 0.17;
  if (h.rasgo === "temeroso") p += h.miedo * 0.003;
  if (h.profeta) p += 0.2;
  if (h.testigo >= 0 && tick - h.testigo < 400) p += 0.16;
  const pu = pueblos[h.pueblo];
  if (pu && pu.fe > 50) p += 0.1;
  return Math.random() < clamp(p, 0.02, 0.95);
}

const RESP = {
  presentar: [
    ["¿Quién anda ahí? No veo a nadie… debe ser el hambre.", "Hay una voz en mi cabeza y no hay nadie. No, no. No puede ser."],
    ["Oigo algo, sí. ¿Eres tú, Voz? Dame una señal, algo que pueda contar.", "Dicen que los viejos oían voces antes de morir. ¿Vienes por mí?"],
    ["Te oigo, Voz sin rostro. Te oigo desde hace días.", "Sabía que eras real. Nadie me creía, pero lo sabía."],
    ["Habla, señor. Tu siervo escucha.", "Que se aparten todos: la Voz me habla a mí."],
  ],
  confuso: [
    ["No entiendo nada de lo que oigo.", "Palabras sin sentido. Estoy perdiendo la cabeza."],
    ["No comprendo, Voz. Háblame claro.", "¿Qué quieres de mí? No te entiendo."],
    ["No sé qué me pides, señor. Dímelo con otras palabras.", "Tu palabra es oscura para mí."],
    ["Perdona, señor, mi mente es pequeña. Repítemelo.", "No alcanzo a entenderte, pero obedeceré si me lo aclaras."],
  ],
  amenazar: [
    ["¡Calla! ¡Sal de mi cabeza!", "No me das miedo… no eres nada."],
    ["No, por favor. Yo no he hecho nada.", "Si eres capaz de hacer daño, demuéstralo. Si no, déjame en paz."],
    ["Te temo, señor. No te enfades conmigo.", "Haré lo que pidas, pero no descargues tu ira sobre los míos."],
    ["Tu ira es justa. Dime cómo aplacarte.", "Que caiga sobre mí, no sobre mi gente."],
  ],
  despedir: [
    ["Silencio otra vez. Mejor.", "Se fue. Ojalá no vuelva."],
    ["¿Ya te vas? Espera…", "No me dejes hablando solo."],
    ["Vuelve pronto, señor.", "Contaré lo que me has dicho."],
    ["Estaré aquí cuando vuelvas, señor.", "Tu palabra queda conmigo."],
  ],
};

function frase(intent, h) {
  const arr = RESP[intent];
  if (!arr) return null;
  return pick(arr[tono(h)]);
}

function responder(h, intent, texto) {
  const t = tono(h);
  h.conocido = true;

  switch (intent) {
    case "presentar": {
      h.fe = Math.min(100, h.fe + (h.rasgo === "devoto" ? 12 : h.rasgo === "escéptico" ? 3 : 7));
      hablaHumano(h, frase("presentar", h));
      if (t === 0) mensaje("nar", "No te cree. Tendrás que demostrarle lo que eres: haz llover sobre él, sánalo… o parte el cielo con un rayo.");
      return;
    }
    case "bendecir": {
      h.fe = Math.min(100, h.fe + 4);
      h.hp = h.hpMax;
      hablaHumano(h, t < 1 ? "Palabras bonitas. Las palabras no llenan el estómago."
        : t < 3 ? "Siento… algo. Como si el frío se fuera." : "Gracias, señor. Tu luz me sostiene.");
      efecto("brillo", h.x, h.y, 26 * U, 18);
      return;
    }
    case "amenazar": {
      h.miedo = Math.min(100, h.miedo + 16);
      h.fe = Math.min(100, h.fe + 3);
      hablaHumano(h, frase("amenazar", h));
      return;
    }
    case "preguntar": return responderEstado(h);
    case "despedir": {
      hablaHumano(h, frase("despedir", h));
      return;
    }
    case "confuso": {
      const f = faccionMencionada(texto, h.faccion);
      if (f >= 0) hablaHumano(h, `¿${facciones[f].nombre}? ¿Qué quieres que haga con ellos, señor?`);
      else hablaHumano(h, frase("confuso", h));
      return;
    }
  }

  let base = 0.3, tipo = intent, datos = null;
  if (intent === "predicar") base = 0.18;
  else if (intent === "fundar") base = 0.34;
  else if (intent === "migrar") {
    base = 0.34;
    const n = norm(texto);
    datos = n.indexOf("norte") >= 0 ? { x: 0, y: -1 } : n.indexOf("sur") >= 0 ? { x: 0, y: 1 }
      : n.indexOf("este") >= 0 ? { x: 1, y: 0 } : n.indexOf("oeste") >= 0 ? { x: -1, y: 0 }
        : pick([{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }]);
  }
  else if (intent === "cazar") base = 0.5;
  else if (intent === "plantar") base = 0.45;
  else if (intent === "construir") { base = 0.45; tipo = h.pueblo >= 0 ? "construir" : "fundar"; }
  else if (intent === "rezar") base = 0.4;
  else if (intent === "atacar") {
    base = 0.1;
    datos = faccionMencionada(texto, h.faccion);
    if (datos < 0) datos = rivalDe(h);
    if (datos < 0) { hablaHumano(h, "¿Contra quién, señor? No conocemos a nadie más."); return; }
    if (h.rasgo === "pacífico") base -= 0.12;
    if (h.rasgo === "temerario") base += 0.14;
  }
  else if (intent === "paz") {
    base = 0.3;
    datos = faccionMencionada(texto, h.faccion);
    if (datos < 0) datos = rivalDe(h);
    if (datos < 0) { hablaHumano(h, "No hay guerra que apagar, señor."); return; }
    if (h.rasgo === "pacífico") base += 0.18;
  }

  const objetivo = datos !== null && typeof datos === "number" && facciones[datos] ? facciones[datos].nombre : "";
  const acepta = convencer(h, base);

  if (!acepta) {
    h.fe = Math.max(0, h.fe - 1);
    hablaHumano(h, rechazo(h, intent, objetivo));
    return;
  }

  h.fe = Math.min(100, h.fe + 3);
  if (intent === "predicar") {
    volverProfeta(h);
    hablaHumano(h, t >= 3 ? "Lo haré. Hablaré de ti hasta quedarme sin voz."
      : "Lo intentaré… aunque me tomen por loco.");
    mensaje("nar", `${h.nombre} es ahora profeta. Contagiará su fe a quien se le acerque.`);
  } else {
    darOrden(h, tipo, datos, 700);
    hablaHumano(h, aceptacion(h, intent, objetivo));
  }

  const pu = pueblos[h.pueblo];
  if (h.profeta && pu && pu.fe > 40 && intent !== "predicar") {
    pu.mandato = { tipo: tipo, datos: datos, t: 900 };
    mensaje("nar", `Su palabra pesa: ${pu.nombre} empieza a seguir la misma idea.`);
    registrar(`<b>${pu.nombre}</b> sigue la palabra de la Voz: ${nombreOrden({ tipo, datos })}.`, "fe");
  }
}

function aceptacion(h, intent, obj) {
  const t = tono(h);
  const frases = {
    fundar: ["Está bien… este sitio no es peor que otro.", "Aquí levantaremos nuestras casas, si tú lo dices.", "Que así sea: aquí echaremos raíces."],
    migrar: ["Recogeré lo poco que tengo y caminaré.", "Iré hacia allá. Espero que sepas lo que haces.", "Guíame, señor. Caminaré hasta donde digas."],
    cazar: ["Tengo hambre de todos modos.", "Buscaré comida, sí.", "Comeremos hoy gracias a ti."],
    plantar: ["Plantaré unos brotes, veremos si prenden.", "Sembraré. Que crezca algo bueno.", "Llenaré esta tierra de árboles en tu nombre."],
    rezar: ["Rezaré un poco. No pierdo nada.", "Rezaré por ti cada noche.", "Encenderé fuego en tu nombre en la plaza."],
    construir: ["Cogeré el martillo, pues.", "Levantaré lo que haga falta.", "Construiré en tu nombre."],
    atacar: ["No me gusta, pero llevaré tu palabra a los demás.", "Tienes razón: nos han quitado demasiado.", "Levantaré a los nuestros. Que caigan sobre ellos."],
    paz: ["Quizá tengas razón. Hablaré con ellos.", "Llevaré tu palabra: basta de sangre.", "Habrá paz aunque me cueste la vida."],
  };
  const a = frases[intent] || ["Lo haré.", "Como digas, señor.", "Tu palabra se cumplirá."];
  const base = a[Math.min(a.length - 1, Math.max(0, t - 1))];
  return obj ? base.replace("ellos", obj) : base;
}

function rechazo(h, intent, obj) {
  const t = tono(h);
  if (t === 0) return pick([
    "No pienso hacer caso a una voz que no existe.",
    "Estoy cansado y hay una voz dándome órdenes. Basta.",
    "¿Y por qué habría de hacerlo? Ni siquiera sé si eres real.",
  ]);
  if (t === 1) return pick([
    "No… todavía no. Demuéstrame que eres lo que dices.",
    "Pides mucho para ser solo una voz.",
    "Si de verdad estás ahí, haz algo que yo pueda ver.",
  ]);
  if (intent === "atacar") return pick([
    "No. Tengo hijos. No los llevaré a morir" + (obj ? " contra " + obj + "." : "."),
    "Eso no lo haré, señor. Ni por ti.",
    "Pídeme cualquier cosa menos sangre.",
  ]);
  return pick([
    "Ahora no puedo, señor. Perdóname.",
    "Lo intentaré… más adelante.",
    "Mi gente me necesita aquí. No puedo irme.",
  ]);
}

function responderEstado(h) {
  const p = pueblos[h.pueblo];
  const partes = [];
  partes.push(h.hambre > 90 ? "Tengo hambre, mucha hambre." : h.hambre > 50 ? "Me vendría bien comer." : "No me falta comida.");
  if (h.hp < h.hpMax * 0.5) partes.push("Estoy herido.");
  if (h.enfermo > 0) partes.push("Y algo me quema por dentro; creo que estoy enfermo.");
  partes.push(p ? `Vivo en ${p.nombre}; somos ${p.pop}.` : "No tengo pueblo. Vago por donde puedo.");
  const dep = hashCercano(hashA, h.x, h.y, 150 * U, a => ESPECIES[a.esp].tipo === "carn");
  if (dep) partes.push(`Hay ${ESPECIES[dep.esp].n.toLowerCase()}s rondando cerca.`);
  if (fuego[idxDe(h.x, h.y)] > 0) partes.push("¡Y todo arde a mi alrededor!");
  if (facciones[h.faccion] && facciones[h.faccion].guerras.size) {
    const e = facciones[h.faccion].guerras.values().next().value;
    partes.push(`Estamos en guerra con ${facciones[e].nombre}.`);
  }
  hablaHumano(h, partes.join(" "));
}

function hablaHumano(h, txt) {
  h.ultimaFrase = txt;
  setTimeout(() => {
    if (charlando === h) mensaje("hum", txt, `${h.nombre} · fe ${Math.round(h.fe)}`);
  }, 260);
}

function pintarChips() {
  const h = charlando;
  if (!h) { chatChips.innerHTML = ""; return; }
  const opciones = ["Soy la voz que hizo tu mundo", "¿Cómo estás?", "Te bendigo"];
  if (h.fe > 25) opciones.push("Difunde mi palabra");
  if (h.pueblo < 0) opciones.push("Funda un pueblo aquí");
  if (h.hambre > 60) opciones.push("Busca comida");
  opciones.push("Planta árboles");
  if (facciones.length > 1) {
    const r = rivalDe(h);
    if (r >= 0) {
      if (enGuerra(h.faccion, r)) opciones.push(`Haz la paz con ${facciones[r].nombre}`);
      else opciones.push(`${facciones[r].nombre} es tu enemigo`);
    }
  }
  opciones.push("Teme mi ira");
  chatChips.innerHTML = "";
  for (const o of opciones.slice(0, 7)) {
    const b = document.createElement("button");
    b.className = "chip"; b.type = "button"; b.textContent = o;
    b.addEventListener("click", () => enviarAlHumano(o));
    chatChips.appendChild(b);
  }
}

function enviarAlHumano(txt) {
  if (!charlando || !txt.trim()) return;
  mensaje("dios", txt, "La Voz");
  const intent = interpretar(txt);
  responder(charlando, intent, txt);
  setTimeout(pintarChips, 300);
}

document.getElementById("chatForm").addEventListener("submit", e => {
  e.preventDefault();
  const inp = document.getElementById("chatInput");
  enviarAlHumano(inp.value);
  inp.value = "";
});
document.getElementById("chatClose").addEventListener("click", cerrarChat);

/* ============================================================
   10. Crónica del mundo
   ============================================================ */
const eventos = [];
let logSucio = true;

function registrar(txt, tipo) {
  eventos.push({ d: dia, txt: txt, tipo: tipo || "info" });
  if (eventos.length > 160) eventos.shift();
  logSucio = true;
}
function registrarRaro(txt, tipo, p) { if (Math.random() < (p === undefined ? 0.3 : p)) registrar(txt, tipo); }

function pintarLog() {
  if (!logSucio) return;
  logSucio = false;
  const cont = document.getElementById("logBody");
  const ult = eventos.slice(-45);
  cont.innerHTML = ult.map(e => `<div class="ev ${e.tipo}"><span class="d">d${e.d}</span>${e.txt}</div>`).join("");
}

/* ============================================================
   11. Estadísticas y panel de facciones
   ============================================================ */
function actualizarStats() {
  let arb = 0;
  for (let i = 0; i < NT; i++) if (arboles[i]) arb++;
  let guerras = 0;
  for (const f of facciones) guerras += f.guerras.size;
  document.getElementById("stDay").textContent = dia;
  document.getElementById("stHum").textContent = humanos.length;
  document.getElementById("stAni").textContent = animales.length;
  document.getElementById("stTown").textContent = pueblos.length;
  document.getElementById("stTree").textContent = arb;
  document.getElementById("stFire").textContent = fuegos.size;
  document.getElementById("stWar").textContent = guerras / 2;

  const cont = document.getElementById("facBody");
  if (!facciones.length) { cont.innerHTML = `<div class="empty">Sin tribus.</div>`; return; }
  cont.innerHTML = facciones.map(f => {
    if (!f.vivo && f.pop === 0) return `<div class="fac-row"><span class="chip-fac" style="background:${f.col};opacity:.4"></span>
      <span class="nm" style="opacity:.45">${f.nombre}</span><span class="num">extinta</span></div>`;
    const pu = pueblos.filter(p => p.faccion === f.id).length;
    const g = f.guerras.size ? `<span class="war">⚔${f.guerras.size}</span>` : "";
    const fe = f.fe > 30 ? `<span class="fe">✨${Math.round(f.fe)}</span>` : "";
    return `<div class="fac-row"><span class="chip-fac" style="background:${f.col}"></span>
      <span class="nm">${f.nombre}</span>${fe}${g}<span class="num">${f.pop}👤 ${pu}🏠</span></div>`;
  }).join("");
}

/* ============================================================
   12. Entrada del usuario
   ============================================================ */
const raton = { x: 0, y: 0, dentro: false };
let arrastrando = false, pintando = false, ultimo = { x: 0, y: 0 }, movio = 0;

function posEnCanvas(e) {
  const r = canvas.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

function aplicarPoder(sx, sy) {
  const m = pantallaAMundo(sx, sy);
  const gx = clamp(Math.floor(m.x / TILE), 0, COLS - 1), gy = clamp(Math.floor(m.y / TILE), 0, ROWS - 1);
  if (!poder.ap) return;
  const c = centroTile(gx, gy);
  poder.ap(gx, gy, poder.radioFijo || pincel, c.x, c.y);
  if (charlando && d2(charlando.x, charlando.y, c.x, c.y) < (260 * U) * (260 * U)) narrarMilagro(poder);
}

function narrarMilagro(p) {
  if (!charlando) return;
  if (p.clase === "milagro") {
    mensaje("nar", pick([
      `${charlando.nombre} ve la señal y abre los ojos de par en par.`,
      `Algo bueno cae del cielo. ${charlando.nombre} cae de rodillas.`,
    ]));
  } else if (p.clase === "castigo") {
    mensaje("nar", pick([
      `${charlando.nombre} se cubre la cabeza, aterrado.`,
      `El mundo ruge. ${charlando.nombre} tiembla y mira al cielo.`,
    ]));
  }
}

function seleccionarEn(sx, sy) {
  const m = pantallaAMundo(sx, sy);
  const h = hashCercano(hashH, m.x, m.y, 16 * U, () => true);
  if (h) return seleccionar("humano", h);
  const a = hashCercano(hashA, m.x, m.y, 16 * U, () => true);
  if (a) return seleccionar("animal", a);
  const i = idxDe(m.x, m.y);
  if (edif[i]) return seleccionar("edificio", i);
  seleccionar("tile", i);
}

canvas.addEventListener("contextmenu", e => e.preventDefault());
canvas.addEventListener("mouseenter", () => raton.dentro = true);
canvas.addEventListener("mouseleave", () => { raton.dentro = false; arrastrando = false; pintando = false; });

canvas.addEventListener("mousedown", e => {
  const p = posEnCanvas(e);
  ultimo = p; movio = 0;
  if (e.button === 2 || poder.id === "mano") { arrastrando = true; canvas.style.cursor = "grabbing"; }
  else if (e.button === 0) { pintando = true; aplicarPoder(p.x, p.y); }
});

window.addEventListener("mouseup", e => {
  if (arrastrando && poder.id === "mano" && movio < 5 && e.button === 0) {
    const p = posEnCanvas(e);
    if (p.x >= 0 && p.y >= 0 && p.x <= canvas.width && p.y <= canvas.height) seleccionarEn(p.x, p.y);
  }
  arrastrando = false; pintando = false;
  canvas.style.cursor = poder.id === "mano" ? "grab" : "crosshair";
});

canvas.addEventListener("mousemove", e => {
  const p = posEnCanvas(e);
  raton.x = p.x; raton.y = p.y;
  const dx = p.x - ultimo.x, dy = p.y - ultimo.y;
  movio += Math.abs(dx) + Math.abs(dy);

  if (arrastrando) { camara.x -= dx / camara.zoom; camara.y -= dy / camara.zoom; }
  else if (pintando && poder.pintar) aplicarPoder(p.x, p.y);
  ultimo = p;

  const m = pantallaAMundo(p.x, p.y);
  const gx = Math.floor(m.x / TILE), gy = Math.floor(m.y / TILE);
  if (dentro(gx, gy)) {
    const i = ti(gx, gy);
    document.getElementById("hudTile").textContent =
      NOMBRE_TILE[tiles[i]] + (arboles[i] ? " · " + NOMBRE_ARB[arboles[i]] : "") + (edif[i] ? " · " + NOMBRE_ED[edif[i]] : "");
    document.getElementById("hudPos").textContent = `${gx}, ${gy}`;
    const f = territorio[i] ? facciones[territorio[i] - 1] : null;
    document.getElementById("hudExtra").textContent = f ? `Territorio de ${f.nombre}` : "Tierra libre";
  }
});

canvas.addEventListener("wheel", e => {
  e.preventDefault();
  const p = posEnCanvas(e);
  const antes = pantallaAMundo(p.x, p.y);
  camara.zoom = clamp(camara.zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15), 0.12, 3);
  camara.x = antes.x - p.x / camara.zoom;
  camara.y = antes.y - p.y / camara.zoom;
}, { passive: false });

window.addEventListener("keydown", e => {
  if (document.activeElement === document.getElementById("chatInput")) {
    if (e.key === "Escape") document.getElementById("chatInput").blur();
    return;
  }
  const k = e.key.toLowerCase();
  if (k === " ") { e.preventDefault(); pausa(); return; }
  if (k === "r") { nuevoMundo(); return; }
  if (k === "h") { ayuda(); return; }
  if (k === "v") { verTodo(); return; }
  if (k === "t") { alternarTerritorios(); return; }
  if (k === "escape") { elegirPoder(PODERES[0]); cerrarChat(); return; }
  if (k === "[") { setPincel(pincel - 1); return; }
  if (k === "]") { setPincel(pincel + 1); return; }
  if (teclaPoder[k]) elegirPoder(teclaPoder[k]);
});

function setPincel(v) {
  pincel = clamp(v, 1, 14);
  document.getElementById("brush").value = pincel;
  document.getElementById("brushVal").textContent = pincel;
}
document.getElementById("brush").addEventListener("input", e => setPincel(+e.target.value));

/* ============================================================
   13. Botones superiores
   ============================================================ */
let pausado = false, velocidad = 1;

function pausa() {
  pausado = !pausado;
  const b = document.getElementById("btnPause");
  b.textContent = pausado ? "▶" : "⏸";
  b.classList.toggle("active", pausado);
}
function setVel(v) {
  velocidad = v; pausado = false;
  document.getElementById("btnPause").textContent = "⏸";
  document.getElementById("btnPause").classList.remove("active");
  document.getElementById("spd1").classList.toggle("active", v === 1);
  document.getElementById("spd2").classList.toggle("active", v === 2);
  document.getElementById("spd3").classList.toggle("active", v === 4);
}
function alternarTerritorios() {
  mostrarTerr = !mostrarTerr;
  document.getElementById("btnTerr").classList.toggle("active", mostrarTerr);
}
function ayuda() { document.getElementById("helpOverlay").classList.toggle("open"); }

function nuevoMundo() {
  document.getElementById("loading").style.display = "flex";
  cerrarChat();
  seleccion = { tipo: null, ref: null };
  eventos.length = 0;
  setTimeout(() => {
    generarMundo();
    pintarTerrenoCompleto();
    registrar("Un mundo nuevo abre los ojos.", "info");
    pintarFicha();
    const h = humanos[0];
    camara.zoom = 1;
    if (h) centrarEn(h.x, h.y); else centrarEn(W_PX / 2, H_PX / 2);
    document.getElementById("loading").style.display = "none";
  }, 30);
}

document.getElementById("btnPause").addEventListener("click", pausa);
document.getElementById("spd1").addEventListener("click", () => setVel(1));
document.getElementById("spd2").addEventListener("click", () => setVel(2));
document.getElementById("spd3").addEventListener("click", () => setVel(4));
document.getElementById("btnFit").addEventListener("click", verTodo);
document.getElementById("btnTerr").addEventListener("click", alternarTerritorios);
document.getElementById("btnNew").addEventListener("click", nuevoMundo);
document.getElementById("btnHelp").addEventListener("click", ayuda);
document.getElementById("btnCloseHelp").addEventListener("click", ayuda);

window.addEventListener("resize", () => {
  const z = camara.zoom, cx = camara.x + canvas.width / (2 * z), cy = camara.y + canvas.height / (2 * z);
  ajustarLienzo();
  centrarEn(cx, cy);
});

/* ============================================================
   14. Bucle principal
   ============================================================ */
const PASO = 1000 / 11;
let acum = 0, ultimoT = performance.now();

function bucle(ahora) {
  const dt = Math.min(120, ahora - ultimoT);
  ultimoT = ahora;
  if (!pausado) {
    acum += dt * velocidad;
    let pasos = 0;
    while (acum >= PASO && pasos < 8) { simTick(); acum -= PASO; pasos++; }
  }
  // interpolar entre pasos de simulación para que el movimiento sea continuo
  dibujar(pausado ? 1 : clamp(acum / PASO, 0, 1));
  requestAnimationFrame(bucle);
}

function iniciar() {
  construirAtlas();
  construirMenu();
  elegirPoder(PODERES[0]);
  ajustarLienzo();
  setVel(1);
  setPincel(3);
  generarMundo();
  pintarTerrenoCompleto();
  registrar("Un mundo nuevo abre los ojos. Cuatro tribus dan sus primeros pasos.", "info");
  const h = humanos[0];
  camara.zoom = 1;
  if (h) centrarEn(h.x, h.y); else centrarEn(W_PX / 2, H_PX / 2);
  document.getElementById("loading").style.display = "none";
  setInterval(() => { actualizarStats(); pintarLog(); if (seleccion.ref) pintarFicha(); }, 500);
  requestAnimationFrame(bucle);
}

iniciar();
