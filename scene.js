/* ============================================================
   ALAS PA' VOLAR 3D · escena
   Frida Kahlo por Federico Chilian Espinosa
   Unidades: el ancho de la ilustración impresa = 1. Origen al centro.
   +z sale de la playera hacia quien mira.
   ============================================================ */
import * as THREE from 'three';

export const W = 696, H = 924, A = H / W;
export const LOOP = 14;          // historia (s)
export const UNFOLD = 1.6;       // la ilustración pasa de plana a 3D (s)

// Línea de tiempo de la historia
export const T = {
  blinks: [1.0, 7.6, 12.2],
  brailleL: [0.4, 2.4], brailleR: [2.4, 4.0],
  handL: [0.6, 2.6], handR: [2.6, 4.2],
  petals: 3.2, wings: [4.4, 5.8], wingsClose: [11.4, 12.6],
  butterflies: 5.0, leave: 10.8, goldOut: [12.4, 13.4], caption: [5.8, 12.6],
};
const Z = { bg: -0.09, frame: 0.002, wings: 0.022, figBase: 0.03, figAmp: 0.12, lift: 0.065 };

// Braille detectado en la ilustración (Pies para qué los quiero / si tengo alas pa' volar)
const BRAILLE = [[[36,26],[36,45],[50,26],[50,36],[50,45],[60,26],[74,36],[84,26],[97,26],[107,36],[121,36],[121,45],[131,26],[168,45],[168,26],[168,36],[178,26],[191,26],[214,26],[214,45],[215,36],[224,36],[237,26]],[[25,74],[25,83],[25,64],[35,64],[35,74],[50,64],[50,83],[60,83],[74,74],[74,83],[84,83],[84,64],[121,65],[121,74],[121,83],[145,83],[145,64],[155,74],[170,74],[170,83],[180,64]],[[25,112],[25,122],[25,103],[35,112],[35,103],[50,122],[50,103],[60,122],[75,112],[84,103],[99,103],[108,112],[121,122],[121,103],[121,112],[131,112],[145,103],[145,122],[155,112]],[[476,39],[476,30],[486,20],[501,30],[511,20],[550,30],[550,39],[559,20],[559,30],[572,20],[582,30],[596,20],[596,39],[606,30],[606,20],[621,30],[622,20],[631,20],[631,30],[647,20],[647,39],[657,30]],[[476,61],[501,71],[501,62],[501,80],[526,61],[550,71],[550,80],[559,61]],[[476,103],[476,112],[476,122],[486,103],[502,103],[527,121],[576,103],[576,121],[576,112],[586,121],[601,103],[601,121],[610,112],[624,103],[624,122],[625,112],[647,103],[671,103],[671,121],[671,112],[681,112]]];
const HAND_L = [[26, 350, 108, 396], [18, 404, 192, 452], [36, 452, 108, 498], [32, 508, 162, 560]];
const HAND_R = [[496, 344, 634, 393], [522, 393, 604, 434], [492, 436, 662, 500]];
const EYES = [{ x: 279, y: 377, rx: 30, ry: 13, c: 'rgb(245,210,202)' }, { x: 383, y: 373, rx: 31, ry: 13, c: 'rgb(241,206,197)' }];
const SHOULDER_L = [268, 612], SHOULDER_R = [392, 612];
const FLOWERS = [[272, 160, '#ec4fb5', '#c81f8f'], [380, 152, '#e6332a', '#b5161c'], [202, 196, '#e8a93a', '#c07d1c'], [468, 172, '#e6332a', '#b5161c'], [330, 104, '#d75ad8', '#a2309f'], [440, 130, '#ef5a9a', '#c22d6b']];
const GLINTS = [[212, 470, 6.4], [441, 468, 6.9], [329, 656, 7.8], [213, 262, 8.6], [452, 262, 9.1]];
const NESTS = [[70, 225], [628, 225], [600, 555], [80, 600], [95, 830], [630, 830], [560, 690], [140, 720], [610, 380], [60, 470], [300, 60], [400, 880]];
const PALETTES = [['#f28c1c', '#c9481a'], ['#ec4fb5', '#a81d72'], ['#e6332a', '#8e1217'], ['#f0b73a', '#b8740f'], ['#3d74d6', '#183a8c']];

// ---------- utilidades ----------
let seed = 21;
const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
export const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const ease = (t) => { t = clamp(t); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
const easeOut = (t) => 1 - Math.pow(1 - clamp(t), 3);
const backOut = (t) => { t = clamp(t); const c = 1.5; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
export const loadImg = (src) => new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ko(new Error('No cargó ' + src)); i.src = src; });
const px = (x, y, z = 0) => new THREE.Vector3(x / W - 0.5, A / 2 - y / W, z);
function tex(canvas) { const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
function texImg(img) { const t = new THREE.Texture(img); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.needsUpdate = true; return t; }

// ---------- dibujos en canvas (texturas) ----------
function flowerMotif(c, x, y, r, col) {
  c.fillStyle = col;
  for (let i = 0; i < 5; i++) { const a = i * 1.2566; c.beginPath(); c.ellipse(x + Math.cos(a) * r * .55, y + Math.sin(a) * r * .55, r * .42, r * .28, a, 0, 6.28); c.fill(); }
  c.fillStyle = '#f6c544'; c.beginPath(); c.arc(x, y, r * .25, 0, 6.28); c.fill();
}
// Ala de monarca bordada; pivote en (0,0), se extiende hacia +x
export function drawWing(c) {
  const fw = new Path2D();
  fw.moveTo(0, 0); fw.bezierCurveTo(70, -170, 270, -330, 470, -300); fw.bezierCurveTo(520, -290, 535, -250, 505, -205); fw.bezierCurveTo(440, -90, 300, -10, 0, 18); fw.closePath();
  const hw = new Path2D();
  hw.moveTo(0, 12); hw.bezierCurveTo(170, 10, 330, 60, 340, 160); hw.bezierCurveTo(345, 230, 270, 280, 190, 262); hw.bezierCurveTo(100, 240, 30, 130, 0, 30); hw.closePath();
  for (const p of [hw, fw]) {
    const isF = p === fw;
    const gr = c.createRadialGradient(0, 0, 30, 0, 0, isF ? 520 : 340);
    gr.addColorStop(0, '#b8360b'); gr.addColorStop(.45, '#e2601a'); gr.addColorStop(1, '#f39a2c');
    c.fillStyle = gr; c.fill(p);
    c.save(); c.clip(p);
    c.globalCompositeOperation = 'lighter'; c.fillStyle = 'rgba(255,190,90,.16)';
    for (const [x, y, r] of (isF ? [[300, -210, 70], [380, -230, 50], [220, -120, 60], [330, -120, 45]] : [[220, 150, 55], [280, 200, 40], [140, 170, 40]])) { c.beginPath(); c.ellipse(x, y, r, r * .55, isF ? -.5 : .6, 0, 6.28); c.fill(); }
    c.globalCompositeOperation = 'source-over';
    c.strokeStyle = '#140d0b'; c.lineCap = 'round';
    (isF ? [[470, -296], [505, -235], [460, -150], [360, -70], [230, -12], [400, -300]] : [[332, 120], [300, 225], [215, 262], [130, 215], [60, 140]]).forEach(([vx, vy], i) => {
      c.lineWidth = 9 - i * .6; c.beginPath(); c.moveTo(0, 4); c.bezierCurveTo(vx * .3, vy * .15 + (isF ? -50 : 40), vx * .7, vy * .7 + (isF ? -20 : 10), vx, vy); c.stroke();
    });
    c.lineWidth = 5;
    if (isF) { c.beginPath(); c.moveTo(250, -235); c.quadraticCurveTo(300, -170, 290, -95); c.moveTo(380, -265); c.quadraticCurveTo(400, -200, 380, -140); c.stroke(); }
    else { c.beginPath(); c.moveTo(180, 70); c.quadraticCurveTo(220, 130, 200, 200); c.stroke(); }
    c.lineWidth = 40; c.strokeStyle = '#140d0b'; c.stroke(p);
    c.fillStyle = '#fff6e2';
    for (const [x, y] of (isF ? [[440, -286], [478, -274], [502, -244], [496, -210], [460, -152], [410, -104], [355, -64], [295, -32], [400, -301], [350, -294], [300, -278]]
      : [[332, 118], [336, 162], [322, 204], [290, 238], [244, 256], [198, 257], [152, 240], [112, 210]])) { c.beginPath(); c.arc(x, y, 5.5, 0, 6.28); c.fill(); }
    const band = c.createRadialGradient(0, 0, 0, 0, 0, 125);
    band.addColorStop(0, 'rgba(26,22,24,1)'); band.addColorStop(.82, 'rgba(26,22,24,.96)'); band.addColorStop(1, 'rgba(26,22,24,0)');
    c.fillStyle = band; c.beginPath(); c.arc(0, 0, 125, 0, 6.28); c.fill();
    c.restore();
    c.lineWidth = 3.5; c.strokeStyle = '#140d0b'; c.stroke(p);
  }
  flowerMotif(c, 88, 60, 20, '#e3267f'); flowerMotif(c, 60, -45, 17, '#e6332a'); flowerMotif(c, 104, -6, 13, '#f0b73a');
  flowerMotif(c, 40, 100, 14, '#d75ad8'); flowerMotif(c, 100, -78, 12, '#e3267f');
}
// Media mariposa (ala derecha), bisagra en x=0
function butterflyHalf(pal) {
  const s = 128, cv = mk(s, s), c = cv.getContext('2d');
  c.translate(4, s / 2);
  const z = s * .9;
  const gr = c.createLinearGradient(0, 0, z, 0); gr.addColorStop(0, pal[1]); gr.addColorStop(1, pal[0]);
  c.fillStyle = gr; c.strokeStyle = '#141014'; c.lineWidth = 5; c.lineJoin = 'round';
  c.beginPath(); c.moveTo(0, -2); c.bezierCurveTo(z * .5, -z * .62, z * 1.05, -z * .5, z * .96, -z * .1); c.bezierCurveTo(z * .85, z * .03, z * .4, z * .03, 0, 0); c.fill(); c.stroke();
  c.beginPath(); c.moveTo(0, 1); c.bezierCurveTo(z * .7, z * .06, z * .8, z * .45, z * .42, z * .5); c.bezierCurveTo(z * .18, z * .53, z * .05, z * .25, 0, 2); c.fill(); c.stroke();
  c.strokeStyle = 'rgba(20,16,20,.8)'; c.lineWidth = 2.2;
  for (const [x, y] of [[z * .9, -z * .32], [z * .7, -z * .45], [z * .55, z * .35]]) { c.beginPath(); c.moveTo(2, 0); c.quadraticCurveTo(x * .5, y * .3, x, y); c.stroke(); }
  c.fillStyle = '#fff8ea';
  for (const [x, y] of [[.86, -.34], [.93, -.17], [.58, .4], [.7, -.48]]) { c.beginPath(); c.arc(z * x, z * y, 3.4, 0, 6.28); c.fill(); }
  return cv;
}
function petalTex(c0, c1) {
  const cv = mk(64, 64), c = cv.getContext('2d'); c.translate(32, 32);
  const g = c.createLinearGradient(0, -28, 0, 28); g.addColorStop(0, c0); g.addColorStop(1, c1);
  c.fillStyle = g; c.strokeStyle = 'rgba(20,12,14,.9)'; c.lineWidth = 3;
  c.beginPath(); c.moveTo(0, -28); c.bezierCurveTo(26, -17, 20, 22, 0, 28); c.bezierCurveTo(-20, 22, -26, -17, 0, -28); c.closePath(); c.fill(); c.stroke();
  c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, -18); c.lineTo(0, 18); c.stroke();
  return cv;
}
function glowTex(inner = 'rgba(255,225,150,1)', outer = 'rgba(255,190,80,0)') {
  const cv = mk(128, 128), c = cv.getContext('2d'); const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, inner); g.addColorStop(1, outer); c.fillStyle = g; c.fillRect(0, 0, 128, 128); return cv;
}
function starTex() {
  const cv = mk(128, 128), c = cv.getContext('2d'); c.translate(64, 64);
  const g = c.createRadialGradient(0, 0, 0, 0, 0, 22); g.addColorStop(0, 'rgba(255,250,220,1)'); g.addColorStop(1, 'rgba(255,220,140,0)');
  c.fillStyle = g; c.beginPath(); c.arc(0, 0, 22, 0, 6.28); c.fill();
  c.fillStyle = 'rgba(255,248,215,.95)';
  for (const r of [0, Math.PI / 2]) { c.save(); c.rotate(r); c.beginPath(); c.moveTo(-60, 0); c.lineTo(0, -4); c.lineTo(60, 0); c.lineTo(0, 4); c.closePath(); c.fill(); c.restore(); }
  return cv;
}
// Cubierta de tela: opaca sobre toda la impresión (la oculta) y se funde hacia afuera con la playera real
function frameTex(sw, sh) {
  const w = 320, h = Math.round(320 * sh / sw), cv = mk(w, h), c = cv.getContext('2d'), d = c.createImageData(w, h);
  const hx = 0.5, hy = A / 2, r = 0.04;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const x = Math.abs(((i + .5) / w - .5) * sw), y = Math.abs(((j + .5) / h - .5) * sh);   // en unidades del mundo
    const qx = x - (hx - r), qy = y - (hy - r);
    const sd = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
    const a = 1 - clamp((sd - 0.05) / 0.11);
    const k = (j * w + i) * 4; d.data[k] = d.data[k + 1] = d.data[k + 2] = 255; d.data[k + 3] = Math.round(255 * a * a * (3 - 2 * a));
  }
  c.putImageData(d, 0, 0); return cv;
}
// Ruido suave para orillas orgánicas
function noise2(x, y) {
  const hsh = (a, b) => { const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return v - Math.floor(v); };
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, sx = xf * xf * (3 - 2 * xf), sy = yf * yf * (3 - 2 * yf);
  const a = hsh(xi, yi), b = hsh(xi + 1, yi), c = hsh(xi, yi + 1), d = hsh(xi + 1, yi + 1);
  return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
}
// Fondo como nube: se disuelve en orillas orgánicas hacia el color de la tela
function featheredBg(img) {
  const cv = mk(W, H), c = cv.getContext('2d'); c.drawImage(img, 0, 0, W, H);
  const id = c.getImageData(0, 0, W, H), d = id.data;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const x = (i / W - .5) / .5, y = (j / H - .47) / .5;                  // -1..1
    const n = noise2(i / 70, j / 70) * .6 + noise2(i / 26 + 9, j / 26 + 3) * .4;
    const r = Math.hypot(x * .98, y * .92) + (n - .5) * .42;
    const a = 1 - clamp((r - .62) / .36);
    d[(j * W + i) * 4 + 3] = Math.round(255 * a * a * (3 - 2 * a));
  }
  c.putImageData(id, 0, 0); return cv;
}

/* ============================================================ */
export async function buildFrida(base = './', opts = {}) {
  const MODEL = opts.model || null;   // gltf.scene de la Frida 3D (opcional)
  const [target, figura, fondo, prof] = await Promise.all(['target.webp', 'figura.webp', 'fondo.webp', 'profundidad.png'].map((f) => loadImg(base + 'assets/' + f)));
  const root = new THREE.Group();
  const lights = [new THREE.AmbientLight(0xffffff, .65), new THREE.DirectionalLight(0xfff1d6, 1.6)];
  lights[1].position.set(.4, .8, 1.2);
  root.add(...lights);

  // ---- marco de tela (cubre el cuadro impreso) ----
  const FSW = 1.5, FSH = A + .5;
  const frameMat = new THREE.MeshBasicMaterial({ map: tex(frameTex(FSW, FSH)), transparent: true, depthWrite: false, opacity: 0 });
  const frame = new THREE.Mesh(new THREE.PlaneGeometry(FSW, FSH), frameMat);
  frame.position.z = Z.frame; frame.renderOrder = -1; root.add(frame);

  // ---- fondo: una ventana hacia atrás de la playera ----
  const bgGroup = new THREE.Group(); root.add(bgGroup);
  const bgMat = new THREE.MeshBasicMaterial({ map: tex(featheredBg(fondo)), transparent: true, depthWrite: false });
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(1, A), bgMat); bg.renderOrder = 0; bgGroup.add(bg);
  const bgFlat = new THREE.MeshBasicMaterial({ map: texImg(target), transparent: true, depthWrite: false, opacity: 1 });
  const bgFlatMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, A), bgFlat); bgFlatMesh.renderOrder = 0; bgFlatMesh.position.z = .0005; bgFlatMesh.renderOrder = 0.5; bgGroup.add(bgFlatMesh);

  // ---- braille en relieve: esferas doradas ----
  const dots = BRAILLE.flat();
  const sph = new THREE.InstancedMesh(new THREE.SphereGeometry(.0095, 16, 12), new THREE.MeshPhongMaterial({ color: 0xf2c14e, specular: 0xfff2c0, shininess: 90, emissive: 0x6a4200, transparent: true }), dots.length);
  sph.renderOrder = 1; bgGroup.add(sph);
  const dotTime = []; BRAILLE.forEach((line, li) => {
    const [g0, g1] = li < 3 ? T.brailleL : T.brailleR, span = (g1 - g0) / 3, t0 = g0 + (li % 3) * span;
    line.forEach((_, di) => dotTime.push(t0 + (di / line.length) * span));
  });
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v3 = new THREE.Vector3(), s3 = new THREE.Vector3();

  // ---- letra manuscrita dorada que se levanta ----
  const ac = mk(W, H).getContext('2d', { willReadFrequently: true }); ac.drawImage(target, 0, 0, W, H);
  const src = ac.getImageData(0, 0, W, H).data;
  const fc = mk(W, H).getContext('2d', { willReadFrequently: true }); fc.drawImage(figura, 0, 0, W, H);
  const fa = fc.getImageData(0, 0, W, H).data;
  const hand = [];
  for (const [lines, [g0, g1]] of [[HAND_L, T.handL], [HAND_R, T.handR]]) {
    const span = (g1 - g0) / lines.length;
    lines.forEach(([x0, y0, x1, y1], i) => {
      const pad = 10, w = x1 - x0 + pad * 2, h = y1 - y0 + pad * 2;
      const ink = mk(w, h), ic = ink.getContext('2d'), id = ic.createImageData(w, h);
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
        const k = (y * W + x) * 4, l = src[k] * .3 + src[k + 1] * .59 + src[k + 2] * .11;
        if (l < 72 && fa[k + 3] < 60) { const o = ((y - y0 + pad) * w + (x - x0 + pad)) * 4, kk = 1 - l / 72; id.data[o] = 255; id.data[o + 1] = 205; id.data[o + 2] = 80; id.data[o + 3] = 255 * Math.min(1, kk * 1.7); }
      }
      ic.putImageData(id, 0, 0);
      const out = mk(w, h), oc = out.getContext('2d');
      const t = tex(out);
      const mat = new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, opacity: 1 });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w / W, h / W), mat);
      const c = px((x0 + x1) / 2, (y0 + y1) / 2); mesh.position.set(c.x, c.y, .003); mesh.renderOrder = 7; bgGroup.add(mesh);
      hand.push({ ink, oc, w, h, t, mat, mesh, t0: g0 + i * span, span, drawn: -1, baseY: c.y });
    });
  }
  function drawHand(hl, k) {
    const { oc, ink, w, h } = hl; oc.clearRect(0, 0, w, h);
    oc.save(); oc.beginPath(); oc.rect(0, 0, w * k, h); oc.clip();
    oc.shadowColor = 'rgba(40,16,0,.85)'; oc.shadowBlur = 4; oc.drawImage(ink, 0, 0);
    oc.shadowColor = 'rgba(255,190,60,.95)'; oc.shadowBlur = 9; oc.drawImage(ink, 0, 0); oc.shadowBlur = 0; oc.drawImage(ink, 0, 0);
    oc.restore(); hl.t.needsUpdate = true;
  }

  // ---- halo dorado detrás de la figura ----
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), new THREE.MeshBasicMaterial({ map: tex(glowTex('rgba(255,205,110,1)')), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
  halo.position.copy(px(330, 400, .012)); halo.renderOrder = 4; root.add(halo);

  // ---- alas de monarca 3D ----
  const wc = mk(600, 660); const wctx = wc.getContext('2d'); wctx.translate(30, 350); drawWing(wctx);
  const wingTex = tex(wc);
  const wingGeo = new THREE.PlaneGeometry(600 / W, 660 / W); wingGeo.translate(270 / W, 20 / W, 0);
  const wingMat = new THREE.MeshBasicMaterial({ map: wingTex, side: THREE.DoubleSide, alphaTest: .35, transparent: true, opacity: 1 });
  const wingR = new THREE.Mesh(wingGeo, wingMat), wingL = new THREE.Mesh(wingGeo, wingMat);
  wingR.position.copy(px(...SHOULDER_R, Z.wings)); wingL.position.copy(px(...SHOULDER_L, Z.wings)); wingL.scale.x = -1;
  wingR.renderOrder = wingL.renderOrder = 5; root.add(wingR, wingL);
  if (MODEL) { wingR.position.z = wingL.position.z = -.035; }

  // ---- figura en relieve (malla desplazada por el mapa de profundidad) ----
  const pc = mk(prof.width, prof.height).getContext('2d', { willReadFrequently: true }); pc.drawImage(prof, 0, 0);
  const pd = pc.getImageData(0, 0, prof.width, prof.height).data, PW = prof.width, PH = prof.height;
  const depthAt = (u, v) => { // u,v en 0..1 (v=0 arriba)
    const x = clamp(u) * (PW - 1), y = clamp(v) * (PH - 1), x0 = Math.floor(x), y0 = Math.floor(y), x1 = Math.min(PW - 1, x0 + 1), y1 = Math.min(PH - 1, y0 + 1), fx = x - x0, fy = y - y0;
    const g = (xx, yy) => pd[(yy * PW + xx) * 4] / 255;
    return (g(x0, y0) * (1 - fx) + g(x1, y0) * fx) * (1 - fy) + (g(x0, y1) * (1 - fx) + g(x1, y1) * fx) * fy;
  };
  const figGeo = new THREE.PlaneGeometry(1, A, 150, 200);
  const pos = figGeo.attributes.position, uv = figGeo.attributes.uv, depth0 = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) depth0[i] = depthAt(uv.getX(i), 1 - uv.getY(i));
  const figCanvas = mk(W, H), figCtx = figCanvas.getContext('2d'); figCtx.drawImage(figura, 0, 0, W, H);
  const figTex = tex(figCanvas);
  const fig = new THREE.Mesh(figGeo, new THREE.MeshBasicMaterial({ map: figTex, alphaTest: .5, side: THREE.DoubleSide }));
  fig.renderOrder = 6; root.add(fig);

  // ---- Frida en bulto (modelo 3D): sale del estampado y se puede rodear ----
  let holder = null, dissolve = null;
  const rootInv = new THREE.Matrix4();
  if (MODEL) {
    fig.visible = false;
    holder = new THREE.Group(); root.add(holder);
    const wrap = new THREE.Group(); holder.add(wrap); wrap.add(MODEL);
    MODEL.rotation.y = -Math.PI / 2;                  // el modelo viene mirando a +x; lo giro hacia quien mira
    MODEL.updateMatrixWorld(true);
    let box = new THREE.Box3().setFromObject(MODEL);
    const FIG_H = (924 - 70) / W, TOP_Y = A / 2 - 70 / W, BACK_Z = -0.05;
    const s = FIG_H / (box.max.y - box.min.y); wrap.scale.setScalar(s);
    wrap.updateMatrixWorld(true); box = new THREE.Box3().setFromObject(wrap);
    wrap.position.set(-(box.min.x + box.max.x) / 2, TOP_Y - box.max.y, BACK_Z - box.min.z);
    // la orilla inferior (fondo blanco de la imagen de entrada) se disuelve en polvo dorado
    dissolve = { uCut: { value: -0.49 }, uRootInv: { value: rootInv }, uGlow: { value: new THREE.Color(0xffc861) },
      // movimiento (deformación en el vértice, en coordenadas de la ilustración)
      uToRoot: { value: new THREE.Matrix4() }, uFromRoot: { value: new THREE.Matrix4() },
      uHeadRot: { value: new THREE.Matrix3() }, uPivH: { value: new THREE.Vector3(0, -0.14, 0.2) },
      uArm: { value: 0 }, uBreath: { value: 0 } };
    MODEL.traverse((o) => {
      if (!o.isMesh) return;
      o.renderOrder = 6; o.frustumCulled = false;
      const m = o.material; m.envMapIntensity = .7; m.side = THREE.FrontSide;
      m.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, dissolve);
        sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
uniform mat4 uRootInv; varying vec3 vLoc;
uniform mat4 uToRoot; uniform mat4 uFromRoot; uniform mat3 uHeadRot; uniform vec3 uPivH; uniform float uArm; uniform float uBreath;
float wHead(vec3 p){ return smoothstep(-0.19, -0.09, p.y); }
float wArm(vec3 p){ return smoothstep(0.235, 0.33, abs(p.x)) * (1.0 - smoothstep(-0.13, -0.07, p.y)) * smoothstep(-0.46, -0.38, p.y); }
mat2 rot2(float a){ float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }
vec3 deformP(vec3 p){
  float wh = wHead(p);
  vec3 q = p - uPivH; p = uPivH + mix(q, uHeadRot * q, wh);
  float wa = wArm(p), sd = sign(p.x);
  vec2 piv = vec2(sd * 0.26, -0.26);
  p.xy = piv + rot2(uArm * sd * wa) * (p.xy - piv);
  float wt = (1.0 - wh) * (1.0 - wa) * smoothstep(-0.62, -0.45, p.y);
  p.z = uPivH.z + (p.z - uPivH.z) * (1.0 + uBreath * wt);
  p.x *= 1.0 + uBreath * 0.4 * wt;
  return p;
}
vec3 deformN(vec3 p, vec3 n){
  float wh = wHead(p); n = normalize(mix(n, uHeadRot * n, wh));
  float wa = wArm(p); n.xy = rot2(uArm * sign(p.x) * wa) * n.xy; return n;
}`)
          .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
{ vec3 pR = (uToRoot * vec4(position, 1.0)).xyz; vec3 nR = normalize(mat3(uToRoot) * objectNormal);
  objectNormal = normalize(mat3(uFromRoot) * deformN(pR, nR)); }`)
          .replace('#include <begin_vertex>', `#include <begin_vertex>
transformed = (uFromRoot * vec4(deformP((uToRoot * vec4(transformed, 1.0)).xyz), 1.0)).xyz;`)
          .replace('#include <project_vertex>', '#include <project_vertex>\nvLoc = (uToRoot * vec4(transformed, 1.0)).xyz;');   // independiente de la pose: el borde disuelto no tiembla
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
uniform float uCut; uniform vec3 uGlow; varying vec3 vLoc;
float hsh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(hsh(i), hsh(i+vec2(1,0)), f.x), mix(hsh(i+vec2(0,1)), hsh(i+vec2(1,1)), f.x), f.y); }`)
          .replace('#include <dithering_fragment>', `#include <dithering_fragment>
float nz = vnoise(vLoc.xz * 34.0) * 0.6 + vnoise(vLoc.xz * 90.0 + 7.0) * 0.4;
float edge = uCut + nz * 0.07;
if (vLoc.y < edge) discard;
gl_FragColor.rgb += uGlow * smoothstep(edge + 0.02, edge, vLoc.y) * 0.9;`);
      };
      m.needsUpdate = true;
    });
  }
  // Movimiento de Frida: mirada que sigue a quien mira, asentir, brazos que aletean, respiración
  const pose = { yaw: 0, pitch: 0, roll: 0, arm: 0 }, eul = new THREE.Euler(), m4h = new THREE.Matrix4(), camL = new THREE.Vector3();
  let modelMesh = null; if (MODEL) MODEL.traverse((o) => { if (o.isMesh && !modelMesh) modelMesh = o; });
  function headPoint(p) {                         // aplica el giro de cabeza a un punto (para los destellos)
    if (!MODEL) return p;
    const w = THREE.MathUtils.smoothstep(p.y, -0.19, -0.09); if (w <= 0) return p;
    const pv = dissolve.uPivH.value, q = p.clone().sub(pv), r = q.clone().applyMatrix3(dissolve.uHeadRot.value);
    return q.lerp(r, w).add(pv);
  }
  function animateBody(t, u, cam) {
    // hacia dónde está la cámara, en coordenadas de la ilustración
    let tyaw = Math.sin(t * .5) * .12, tpitch = 0;
    if (cam) {
      cam.getWorldPosition(camL); root.worldToLocal(camL);
      const dz = Math.max(.3, camL.z - .2);
      tyaw = THREE.MathUtils.clamp(Math.atan2(camL.x, dz), -.55, .55);
      tpitch = THREE.MathUtils.clamp(-Math.atan2(camL.y + .1, dz) * .6, -.3, .3);
    }
    // gestos de la historia
    const nod = Math.exp(-Math.pow((t - 4.5) / .25, 2)) * .16 + Math.exp(-Math.pow((t - 4.95) / .2, 2)) * .1;   // asiente al terminar la frase
    const proud = clamp((t - T.wings[0]) / 1.2) * (1 - clamp((t - T.wingsClose[0]) / 1.2));                     // mentón arriba con las alas
    const beat = (t > T.wings[1] - .3 && t < T.wingsClose[0] + .3) ? Math.sin((t - T.wings[1]) * 2.7) : 0;
    const k = window.__snapPose ? 1 : .08;                 // (__snapPose: solo para pruebas)
    pose.yaw += (tyaw - pose.yaw) * k;
    pose.pitch += (tpitch + nod - proud * .14 - pose.pitch) * Math.min(1, k * 1.6);
    pose.roll += (proud * .1 * Math.sin(t * .8) + Math.sin(t * .37) * .03 - pose.roll) * k;
    const armTarget = proud * (.2 + .13 * beat);
    pose.arm += (armTarget - pose.arm) * (window.__snapPose ? 1 : .18);
    eul.set(pose.pitch * u, pose.yaw * u, pose.roll * u, 'YXZ');
    dissolve.uHeadRot.value.setFromMatrix4(m4h.makeRotationFromEuler(eul));
    dissolve.uArm.value = pose.arm * u;
    dissolve.uBreath.value = .018 * Math.sin(t * 1.7) * u;
    if (modelMesh) { dissolve.uToRoot.value.copy(rootInv).multiply(modelMesh.matrixWorld); dissolve.uFromRoot.value.copy(dissolve.uToRoot.value).invert(); }
  }
  const ray = new THREE.Raycaster();
  function surfaceZ(pxx, pyy) {                     // z de la superficie del modelo vista de frente
    if (!MODEL) return Z.figBase + depthAt(pxx / W, pyy / H) * Z.figAmp;
    holder.scale.z = 1; root.updateMatrixWorld(true);
    const p0 = px(pxx, pyy, 3).applyMatrix4(root.matrixWorld);
    const dir = new THREE.Vector3(0, 0, -1).transformDirection(root.matrixWorld);
    ray.set(p0, dir); const hit = ray.intersectObject(MODEL, true)[0];
    return hit ? root.worldToLocal(hit.point.clone()).z : .05;
  }
  const zFig = (pxx, pyy) => Z.figBase + depthAt(pxx / W, pyy / H) * Z.figAmp;
  let figU = -1;
  function setRelief(u) {
    if (Math.abs(u - figU) < 1e-4) return; figU = u;
    for (let i = 0; i < pos.count; i++) pos.setZ(i, .002 + u * (Z.figBase + depth0[i] * Z.figAmp));
    pos.needsUpdate = true;
  }
  function drawBlink(close) {
    figCtx.clearRect(0, 0, W, H); figCtx.drawImage(figura, 0, 0, W, H);
    if (close > 0) for (const e of EYES) {
      figCtx.save(); figCtx.beginPath(); figCtx.ellipse(e.x, e.y, e.rx, e.ry + 2, 0, 0, 6.28); figCtx.clip();
      const ly = e.y - e.ry - 2 + (e.ry * 2 + 4) * close;
      figCtx.fillStyle = e.c; figCtx.fillRect(e.x - e.rx - 2, e.y - e.ry - 4, e.rx * 2 + 4, ly - (e.y - e.ry - 4));
      figCtx.strokeStyle = '#1a1010'; figCtx.lineWidth = 3.2;
      figCtx.beginPath(); figCtx.ellipse(e.x, ly - (e.ry + 2) * (1 - close) * .2, e.rx, Math.max(1, (e.ry + 2) * (1 - close) * .5 + 1), 0, .12, Math.PI - .12); figCtx.stroke();
      figCtx.restore();
    }
    figTex.needsUpdate = true;
  }

  // ---- destellos en el oro ----
  const starMat = new THREE.SpriteMaterial({ map: tex(starTex()), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const glints = GLINTS.map(([x, y, t]) => { const s = new THREE.Sprite(starMat.clone()); const base = px(x, y, surfaceZ(x, y) + .012); s.position.copy(base); s.renderOrder = 10; s.scale.setScalar(0); root.add(s); return { s, t, base }; });

  // ---- pétalos ----
  const petalMats = FLOWERS.map(([, , c0, c1]) => new THREE.MeshBasicMaterial({ map: tex(petalTex(c0, c1)), transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  const petalGeo = new THREE.PlaneGeometry(.028, .028);
  const petals = Array.from({ length: 36 }, (_, i) => {
    const f = FLOWERS[i % FLOWERS.length], m = new THREE.Mesh(petalGeo, petalMats[i % FLOWERS.length].clone());
    m.renderOrder = 8; m.visible = false; root.add(m);
    return { m, o: px(f[0] + (rnd() - .5) * 40, f[1] + (rnd() - .5) * 26, surfaceZ(f[0], f[1]) + .01), d: rnd() * 5, life: 3.6 + rnd() * 2.4,
      v: new THREE.Vector3((rnd() - .5) * .16, .08 + rnd() * .12, .05 + rnd() * .14), sw: .02 + rnd() * .05, ph: rnd() * 6.28,
      r: new THREE.Vector3(rnd() * 6, rnd() * 6, rnd() * 6), vr: new THREE.Vector3((rnd() - .5) * 5, (rnd() - .5) * 5, (rnd() - .5) * 3), s: .7 + rnd() * .7 };
  });

  // ---- mariposas 3D ----
  const bodyGeo = new THREE.CylinderGeometry(.0035, .0028, .05, 8); const bodyMat = new THREE.MeshBasicMaterial({ color: 0x141014, transparent: true });
  const bTex = PALETTES.map((p) => tex(butterflyHalf(p)));
  const butterflies = NESTS.map(([nx, ny], i) => {
    const size = .07 + rnd() * .04;
    const g = new THREE.Group(); g.visible = false; root.add(g);
    const geo = new THREE.PlaneGeometry(size, size); geo.translate(size / 2 - size * .03, 0, 0);
    const mat = new THREE.MeshBasicMaterial({ map: bTex[i % bTex.length], side: THREE.DoubleSide, transparent: true, depthWrite: false });
    const r = new THREE.Mesh(geo, mat), l = new THREE.Mesh(geo, mat); l.scale.x = -1;
    const body = new THREE.Mesh(bodyGeo, bodyMat.clone()); body.scale.setScalar(size / .07);
    g.add(r, l, body); r.renderOrder = l.renderOrder = body.renderOrder = 8;
    return { g, r, l, body, mat, nest: new THREE.Vector3(), nx, ny, d: rnd() * 1.6, rx: .5 + rnd() * .35, ry: .32 + rnd() * .3, yc: .05 + (rnd() - .5) * .3,
      zc: .16 + rnd() * .22, az: .08 + rnd() * .14, w: (rnd() > .5 ? 1 : -1) * (.45 + rnd() * .35), ph: rnd() * 6.28, fq: 14 + rnd() * 6, prev: new THREE.Vector3() };
  });

  // ---- polvo dorado ----
  const NDUST = 170, dustGeo = new THREE.BufferGeometry(), dpos = new Float32Array(NDUST * 3), dseed = [];
  for (let i = 0; i < NDUST; i++) { dseed.push([rnd() * 2 - 1, rnd() * 2 - 1, rnd(), rnd() * 6.28, .2 + rnd() * .5]); }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
  const dustMat = new THREE.PointsMaterial({ size: .018, map: tex(glowTex('rgba(255,236,170,1)', 'rgba(255,200,90,0)')), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, sizeAttenuation: true });
  const dust = new THREE.Points(dustGeo, dustMat); dust.renderOrder = 9; root.add(dust);

  // ---------- estado de la tela ----------
  const fabric = new THREE.Color(0xf3efe8);
  function setFabric(color) { fabric.copy(color); frameMat.color.copy(fabric); }
  setFabric(fabric);

  /* ---------- actualización por cuadro ----------
     tau: segundos desde que se encontró la ilustración (controla el despliegue)
     t:   segundos de la historia (en loop)                                    */
  let blinkState = 0, petalsOn = false;
  function update(tau, t, cam) {
    const u = ease(tau / UNFOLD);
    // despliegue: de plano a 3D
    if (MODEL) {
      holder.scale.z = Math.max(1e-3, u);           // de plano a bulto completo
      holder.position.y = .015 * Math.sin(t * 1.1) * u;
      root.updateMatrixWorld(); rootInv.copy(root.matrixWorld).invert();
      animateBody(t, u, cam);
    } else setRelief(u);
    frameMat.opacity = u;
    bgGroup.position.z = Z.bg * u; bgGroup.scale.setScalar(1 + .14 * u);
    bgFlat.opacity = 1 - clamp(u * 1.4);          // al inicio coincide exacto con la impresión
    root.userData.u = u;

    // braille
    const gOut = 1 - clamp((t - T.goldOut[0]) / (T.goldOut[1] - T.goldOut[0]));
    dots.forEach(([x, y], i) => {
      const k = clamp((t - dotTime[i]) / .3) * gOut * u, pop = 1 + .7 * Math.max(0, 1 - (t - dotTime[i]) / .4);
      const p = px(x, y, .004 + .01 * easeOut(k)); s3.setScalar(k > 0 ? k * pop : 1e-4);
      m4.compose(p, q, s3); sph.setMatrixAt(i, m4);
    });
    sph.instanceMatrix.needsUpdate = true;

    // letra dorada: se escribe y después flota hacia afuera
    for (const hl of hand) {
      const k = clamp((t - hl.t0) / hl.span);
      const kk = Math.round(k * 40) / 40;
      if (kk !== hl.drawn) { drawHand(hl, kk); hl.drawn = kk; }
      const lift = easeOut((t - hl.t0 - hl.span) / .9) * gOut;
      hl.mesh.position.z = .003 + (Z.lift - Z.bg) * lift * u;  // sale del fondo y queda frente a las alas
      hl.mesh.position.y = hl.baseY + Math.sin(t * 1.3 + hl.t0) * .004 * lift;
      hl.mat.opacity = gOut * (k > 0 ? 1 : 0);
    }

    // alas
    const open = t < T.wingsClose[0] ? backOut((t - T.wings[0]) / (T.wings[1] - T.wings[0])) : 1 - ease((t - T.wingsClose[0]) / (T.wingsClose[1] - T.wingsClose[0]));
    const vis = clamp(open) * u;
    wingR.visible = wingL.visible = vis > .01;
    if (vis > .01) {
      const flapping = t > T.wings[1] - .3 && t < T.wingsClose[0] + .3;
      const beat = flapping ? Math.sin((t - T.wings[1]) * 2.7) : 0;
      const fold = (1 - open) * 1.45;
      const yaw = fold + (flapping ? .2 + .38 * beat : 0);
      wingR.rotation.set(0, yaw, -.05 - .12 * beat); wingL.rotation.set(0, -yaw, .05 + .12 * beat);
      const sc = .55 + .45 * clamp(open); wingR.scale.set(sc, sc, sc); wingL.scale.set(-sc, sc, sc);
      wingMat.opacity = clamp(open * 1.5);
    }
    halo.material.opacity = .55 * clamp(open) * u;

    // parpadeo
    let close = 0; for (const tb of T.blinks) { const k = (t - tb) / .2; if (k >= 0 && k <= 1) close = Math.sin(k * Math.PI); }
    const cq = Math.round(close * 8) / 8; if (!MODEL && cq !== blinkState) { drawBlink(cq); blinkState = cq; }

    // destellos
    for (const g of glints) { if (MODEL) g.s.position.copy(headPoint(g.base.clone())); const k = (t - g.t) / .7; const s = k > 0 && k < 1 ? Math.sin(k * Math.PI) * .07 : 0; g.s.scale.setScalar(Math.max(1e-4, s * u)); g.s.material.rotation = k * 1.4; }

    // pétalos
    for (const p of petals) {
      const qq = t - T.petals - p.d; const on = qq > 0 && qq < p.life && u > .5;
      p.m.visible = on; if (!on) continue;
      p.m.position.set(p.o.x + p.v.x * qq + Math.sin(qq * 1.6 + p.ph) * p.sw, p.o.y + p.v.y * qq + .01 * qq * qq, p.o.z + p.v.z * qq);
      p.m.rotation.set(p.r.x + p.vr.x * qq, p.r.y + p.vr.y * qq, p.r.z + p.vr.z * qq);
      p.m.scale.setScalar(p.s); p.m.material.opacity = Math.min(1, qq * 3) * (1 - clamp(qq - p.life + 1));
    }

    // mariposas: despiertan en el fondo, orbitan alrededor de Frida y se van
    for (const b of butterflies) {
      const k = t - T.butterflies - b.d; const on = k > 0 && t < T.leave + 2.2 && u > .5;
      b.g.visible = on; if (!on) continue;
      b.nest.copy(px(b.nx, b.ny)).multiplyScalar(bgGroup.scale.x); b.nest.z = bgGroup.position.z + .01;
      const ang = b.ph + b.w * k * 1.1;
      const orbit = MODEL ? v3.set(Math.cos(ang) * (b.rx + .2), b.yc + Math.sin(ang) * b.ry, b.zc + .22 + Math.sin(ang * 2 + b.ph) * (b.az + .1))
        : v3.set(Math.cos(ang) * b.rx, b.yc + Math.sin(ang) * b.ry, b.zc + Math.sin(ang * 2 + b.ph) * b.az);
      const pin = easeOut(k / 1.4);
      const p = new THREE.Vector3().copy(b.nest).lerp(orbit, pin);
      const kl = clamp((t - T.leave - b.d * .5) / 1.6);
      if (kl > 0) p.add(new THREE.Vector3(p.x * 2.2, p.y * 1.2 + .5, .3).multiplyScalar(ease(kl)));
      const vel = new THREE.Vector3().subVectors(p, b.prev); b.prev.copy(p);
      b.g.position.copy(p);
      if (vel.lengthSq() > 1e-9) { b.g.rotation.z = Math.atan2(vel.y, vel.x) - Math.PI / 2; b.g.rotation.x = -.35 + clamp(vel.z * 40, -.5, .5); }
      const flap = .15 + 1.25 * (.5 + .5 * Math.sin(t * b.fq + b.ph));
      b.r.rotation.y = flap; b.l.rotation.y = -flap;
      const a = clamp(k * 3) * (1 - kl);
      b.mat.opacity = a; b.body.material.opacity = a;
    }

    // polvo dorado (más intenso con las alas abiertas)
    for (let i = 0; i < NDUST; i++) {
      const [sx, sy, sz, ph, sp] = dseed[i];
      const y = ((sy * .9 + t * sp * .06 + 1.5) % 1.9) - .9;
      dpos[i * 3] = sx * .75 + Math.sin(t * .7 + ph) * .03; dpos[i * 3 + 1] = y; dpos[i * 3 + 2] = .02 + sz * .45;
    }
    dustGeo.attributes.position.needsUpdate = true;
    dustMat.opacity = u * (.25 + .6 * clamp(open)) * (.75 + .25 * Math.sin(t * 3));
  }

  return { root, update, setFabric, fabric, holder, dissolve };
}

// Señales de sonido de la historia
export const CUES = (T_) => {
  const NOTES = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];
  return [
    ...NOTES.map((n, i) => ({ t: (i < 3 ? T_.brailleL[0] + i * (T_.brailleL[1] - T_.brailleL[0]) / 3 : T_.brailleR[0] + (i - 3) * (T_.brailleR[1] - T_.brailleR[0]) / 3) + .05, k: 'chime', f: n })),
    { t: T_.wings[0], k: 'whoosh', a: [1.2, 180, 1600, .7] },
    ...Array.from({ length: 6 }, (_, i) => ({ t: T_.wings[1] + .55 + i * (Math.PI * 2 / 2.7), k: 'whoosh', a: [.5, 200, 700, .35] })),
    { t: T_.wingsClose[0], k: 'whoosh', a: [1, 1400, 220, .45] },
    ...GLINTS.map(([, , gt], i) => ({ t: gt, k: 'chime', f: 1318.5 + i * 120, g: .07, d: .9 })),
  ];
};
