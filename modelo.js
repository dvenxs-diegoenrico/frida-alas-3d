/* ============================================================
   FIGURA 3D POR CÓDIGO · Frida (ilustración de Federico Chilian Espinosa)
   El volumen se "infla" desde la silueta: cada punto sube según su
   distancia al borde. Frente = ilustración original; espalda = interpretación.
   ============================================================ */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { drawWing, loadImg } from './scene.js';

const $ = (id) => document.getElementById(id);
const B = 'assets/modelo/';
const GX = 232, GY = 308;                 // resolución de la malla (cada lado)

function pixels(img) {
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0);
  return { d: x.getImageData(0, 0, c.width, c.height).data, w: c.width, h: c.height };
}
function sampler(p) {
  return (u, v) => {
    const x = Math.min(p.w - 1, Math.max(0, u * (p.w - 1))), y = Math.min(p.h - 1, Math.max(0, v * (p.h - 1)));
    const x0 = Math.floor(x), y0 = Math.floor(y), x1 = Math.min(p.w - 1, x0 + 1), y1 = Math.min(p.h - 1, y0 + 1), fx = x - x0, fy = y - y0;
    const g = (a, b) => p.d[(b * p.w + a) * 4] / 255;
    return (g(x0, y0) * (1 - fx) + g(x1, y0) * fx) * (1 - fy) + (g(x0, y1) * (1 - fx) + g(x1, y1) * fx) * fy;
  };
}
function texOf(img) { const t = new THREE.Texture(img); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.needsUpdate = true; return t; }
function canvasTex(c) { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }

/* Malla inflada: frente y espalda cosidos en la silueta (z = 0) */
function inflate(sil, hf, hb, meta) {
  const A = meta.H / meta.W, S = (meta.maxPx / meta.W) * 1.6;   // 1.6 = más volumen
  const inside = new Uint8Array(GX * GY);
  for (let j = 0; j < GY; j++) for (let i = 0; i < GX; i++) inside[j * GX + i] = sil(i / (GX - 1), j / (GY - 1)) > .5 ? 1 : 0;
  const used = new Int32Array(GX * GY).fill(-1);
  const cells = [];
  for (let j = 0; j < GY - 1; j++) for (let i = 0; i < GX - 1; i++) {
    const a = j * GX + i, b = a + 1, c = a + GX, d = c + 1;
    if (inside[a] | inside[b] | inside[c] | inside[d]) cells.push(a);
  }
  const posF = [], posB = [], uvs = [];
  let n = 0;
  const vid = (k) => {
    if (used[k] >= 0) return used[k];
    const i = k % GX, j = (k / GX) | 0, u = i / (GX - 1), v = j / (GY - 1);
    const x = u - .5, y = A / 2 - v * A;
    const zf = inside[k] ? hf(u, v) * S : 0, zb = inside[k] ? hb(u, v) * S : 0;
    posF.push(x, y, zf); posB.push(x, y, -zb); uvs.push(u, 1 - v);
    used[k] = n++; return used[k];
  };
  const idxF = [], idxB = [];
  for (const a of cells) {
    const b = a + 1, c = a + GX, d = c + 1;
    const A_ = vid(a), B_ = vid(b), C_ = vid(c), D_ = vid(d);
    idxF.push(A_, C_, B_, B_, C_, D_);
    idxB.push(A_, B_, C_, B_, D_, C_);
  }
  const mkGeo = (pos, idx) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(idx); g.computeVertexNormals(); return g;
  };
  return { front: mkGeo(posF, idxF), back: mkGeo(posB, idxB), A, S };
}

/* Base de talavera poblana */
function talaveraTex() {
  const w = 1024, h = 256, c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
  const azul = '#1f3f9a', azul2 = '#2f5cc8', crema = '#f6f1e4', ocre = '#e0a23a';
  x.fillStyle = crema; x.fillRect(0, 0, w, h);
  x.fillStyle = azul; x.fillRect(0, 0, w, 22); x.fillRect(0, h - 22, w, 22);
  x.fillStyle = ocre; x.fillRect(0, 22, w, 6); x.fillRect(0, h - 28, w, 6);
  for (let k = 0; k < 8; k++) {
    const cx = k * (w / 8) + w / 16, cy = h / 2;
    x.save(); x.translate(cx, cy);
    for (let p = 0; p < 8; p++) {
      x.rotate(Math.PI / 4); x.fillStyle = p % 2 ? azul : azul2;
      x.beginPath(); x.ellipse(0, -38, 13, 30, 0, 0, Math.PI * 2); x.fill();
    }
    x.fillStyle = ocre; x.beginPath(); x.arc(0, 0, 14, 0, Math.PI * 2); x.fill();
    x.fillStyle = azul; x.beginPath(); x.arc(0, 0, 6, 0, Math.PI * 2); x.fill();
    x.restore();
    x.fillStyle = azul;
    for (const dy of [-70, 70]) { x.beginPath(); x.arc(cx + w / 16, cy + dy * .7, 7, 0, Math.PI * 2); x.fill(); }
  }
  x.strokeStyle = azul; x.lineWidth = 3;
  for (let k = 0; k < w; k += 32) { x.beginPath(); x.moveTo(k, 34); x.quadraticCurveTo(k + 16, 48, k + 32, 34); x.stroke(); x.beginPath(); x.moveTo(k, h - 34); x.quadraticCurveTo(k + 16, h - 48, k + 32, h - 34); x.stroke(); }
  const t = canvasTex(c); t.wrapS = THREE.RepeatWrapping; return t;
}
function topTex() {
  const s = 512, c = document.createElement('canvas'); c.width = c.height = s; const x = c.getContext('2d');
  x.fillStyle = '#f6f1e4'; x.fillRect(0, 0, s, s); x.translate(s / 2, s / 2);
  x.strokeStyle = '#1f3f9a'; x.lineWidth = 10; x.beginPath(); x.arc(0, 0, s / 2 - 14, 0, Math.PI * 2); x.stroke();
  x.lineWidth = 4; x.beginPath(); x.arc(0, 0, s / 2 - 40, 0, Math.PI * 2); x.stroke();
  for (let k = 0; k < 16; k++) { x.rotate(Math.PI / 8); x.fillStyle = k % 2 ? '#1f3f9a' : '#2f5cc8'; x.beginPath(); x.ellipse(0, -(s / 2 - 70), 9, 22, 0, 0, Math.PI * 2); x.fill(); }
  return canvasTex(c);
}
function shadowTex() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  const g = x.createRadialGradient(128, 128, 0, 128, 128, 128); g.addColorStop(0, 'rgba(8,16,40,.55)'); g.addColorStop(1, 'rgba(8,16,40,0)');
  x.fillStyle = g; x.fillRect(0, 0, 256, 256); return canvasTex(c);
}

async function main() {
  const [sil, hf, hb, front, back, meta] = await Promise.all([
    loadImg(B + 'silueta.png'), loadImg(B + 'altura_frente.png'), loadImg(B + 'altura_espalda.png'),
    loadImg(B + 'frente.webp'), loadImg(B + 'espalda.webp'), fetch(B + 'meta.json').then((r) => r.json()),
  ]);
  const geo = inflate(sampler(pixels(sil)), sampler(pixels(hf)), sampler(pixels(hb)), meta);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1)); renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  $('stage').appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), .04).texture;
  const camera = new THREE.PerspectiveCamera(35, 1, .01, 50);

  // Luces: principal cálida, relleno frío (Casa Azul) y contraluz
  scene.add(new THREE.HemisphereLight(0xfff4e6, 0x1b3f9a, .55));
  const key = new THREE.DirectionalLight(0xfff0d8, 1.9); key.position.set(1.2, 1.6, 2); scene.add(key);
  const rim = new THREE.DirectionalLight(0x9fc0ff, 1.2); rim.position.set(-1.5, .8, -2); scene.add(rim);

  // Figura: acabado de resina laqueada, como un alebrije
  const mat = (img) => new THREE.MeshPhysicalMaterial({ map: texOf(img), roughness: .5, metalness: 0, clearcoat: .55, clearcoatRoughness: .35, envMapIntensity: .55 });
  const figura = new THREE.Group();
  figura.add(new THREE.Mesh(geo.front, mat(front)), new THREE.Mesh(geo.back, mat(back)));
  scene.add(figura);
  const footY = -geo.A / 2 + 0.02;

  // Base de talavera
  const R = .44, BH = .13;
  const side = talaveraTex(); side.repeat.set(1, 1);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(R, R * 1.04, BH, 96, 1, false), [
    new THREE.MeshPhysicalMaterial({ map: side, roughness: .25, clearcoat: 1, clearcoatRoughness: .1 }),
    new THREE.MeshPhysicalMaterial({ map: topTex(), roughness: .25, clearcoat: 1, clearcoatRoughness: .1 }),
    new THREE.MeshPhysicalMaterial({ color: 0x1f3f9a, roughness: .4 }),
  ]);
  base.position.y = footY - BH / 2; scene.add(base);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), new THREE.MeshBasicMaterial({ map: shadowTex(), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = footY - BH - .001; scene.add(shadow);

  // Alas de monarca (opcionales), curvas y con aleteo
  const wc = document.createElement('canvas'); wc.width = 600; wc.height = 660; const wx = wc.getContext('2d'); wx.translate(30, 350); drawWing(wx);
  const wingGeo = new THREE.PlaneGeometry(600 / meta.W, 660 / meta.W, 24, 24); wingGeo.translate(270 / meta.W, 20 / meta.W, 0);
  const wp = wingGeo.attributes.position; for (let i = 0; i < wp.count; i++) { const xx = wp.getX(i); wp.setZ(i, -.18 * xx * xx); } wingGeo.computeVertexNormals();
  const wingMat = new THREE.MeshPhysicalMaterial({ map: canvasTex(wc), side: THREE.DoubleSide, alphaTest: .4, roughness: .55, clearcoat: .3 });
  const shoulder = (px, py) => new THREE.Vector3(px / meta.W - .5, geo.A / 2 - py / meta.W, -.05);
  const wingR = new THREE.Mesh(wingGeo, wingMat), wingL = new THREE.Mesh(wingGeo, wingMat);
  wingR.position.copy(shoulder(392, 560)); wingL.position.copy(shoulder(268, 560)); wingR.position.z = wingL.position.z = -.1; wingL.scale.x = -1;
  const wings = new THREE.Group(); wings.add(wingR, wingL); wings.visible = false; figura.add(wings);

  // Cámara y controles
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, -.08, 0); controls.enableDamping = true; controls.autoRotate = true; controls.autoRotateSpeed = 1.6;
  controls.minDistance = 1.2; controls.maxDistance = 5; controls.maxPolarAngle = Math.PI * .58;
  function resize() {
    const w = innerWidth, h = innerHeight; renderer.setSize(w, h); camera.aspect = w / h;
    const dist = 3.05 / Math.min(1, camera.aspect / .8); camera.userData.dist = dist; camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize); resize();
  const setView = (yaw, pitch = .12) => { const d = camera.userData.dist; camera.position.set(Math.sin(yaw) * Math.cos(pitch) * d, -.08 + Math.sin(pitch) * d, Math.cos(yaw) * Math.cos(pitch) * d); controls.update(); };
  setView(.5);

  const pressed = (id, on) => $(id).setAttribute('aria-pressed', String(on));
  $('spin').onclick = () => { controls.autoRotate = !controls.autoRotate; pressed('spin', controls.autoRotate); };
  $('front').onclick = () => { controls.autoRotate = false; pressed('spin', false); setView(0); };
  $('side').onclick = () => { controls.autoRotate = false; pressed('spin', false); setView(Math.PI / 2); };
  $('back').onclick = () => { controls.autoRotate = false; pressed('spin', false); setView(Math.PI); };
  $('alas').onclick = () => { wings.visible = !wings.visible; pressed('alas', wings.visible); };

  const t0 = performance.now();
  function frame() {
    const t = (performance.now() - t0) / 1000;
    figura.position.y = Math.sin(t * 1.2) * .006;
    if (wings.visible) { const b = Math.sin(t * 2.4); wingR.rotation.y = .35 + .3 * b; wingL.rotation.y = -(.35 + .3 * b); }
    controls.update(); renderer.render(scene, camera);
  }
  renderer.setAnimationLoop(() => { if (!window.__modelo?.manual) frame(); });
  window.__modelo = { setView, frame, wings, controls, manual: false };
  $('loading').hidden = true;
}
main().catch((e) => { console.error(e); $('loading').textContent = 'No se pudo cargar el modelo: ' + (e.message || e); });
