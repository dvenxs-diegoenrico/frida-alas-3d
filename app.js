import * as THREE from 'three';
import { MindARThree } from 'mindar-image-three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildFrida, CUES, T, LOOP, UNFOLD, W, H, A, loadImg, clamp } from './scene.js';
import { makeStabilizer, MINDAR_PASSTHROUGH, preferHDCamera, makeDebug } from './estabilizador.js';

/* Figura: modelo 3D (por defecto) o relieve (?figura=relieve) */
const USE_MODEL = new URLSearchParams(location.search).get('figura') !== 'relieve';
async function loadModel(light = false) {
  if (!USE_MODEL) return null;
  const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
  // en AR va la versión ligera (59 mil triángulos) para no robarle cuadros al rastreo
  const g = await loader.loadAsync(light ? 'assets/modelo/frida-3d-ligero.glb' : 'assets/modelo/frida-3d.glb');
  return g.scene;
}
async function makeFrida(light = false) { return buildFrida('./', { model: await loadModel(light) }); }

/* Rastreo: el filtro de MindAR (por elemento de la matriz) deformaba el contenido 3D y obligaba a
   escoger entre temblor y retraso. Queda apagado y la pose pasa por el estabilizador rígido
   (estabilizador.js), que filtra rotación, posición y profundidad por separado y predice entre poses. */
const RESTART_AFTER_MS = 2500;   // si se pierde el estampado menos de esto, la historia sigue (no se vuelve a desplegar)
function addEnvironment(renderer, scene) { scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), .04).texture; }

const $ = (id) => document.getElementById(id);
const show = (id, on = true) => { $(id).hidden = !on; };

/* ---------------- Sonido sintetizado ---------------- */
let actx = null, muted = false;
function initAudio() { try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); actx.resume(); } catch (e) { actx = null; } }
function chime(freq, gain = .18, dur = 1.6) {
  if (!actx || muted) return; const t0 = actx.currentTime;
  for (const [mul, gm] of [[1, 1], [2.76, .25], [5.4, .08]]) {
    const o = actx.createOscillator(), g = actx.createGain(); o.frequency.value = freq * mul;
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(gain * gm, t0 + .01); g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
    o.connect(g).connect(actx.destination); o.start(t0); o.stop(t0 + dur + .05);
  }
}
function whoosh(dur = .7, f0 = 300, f1 = 1400, gain = .5) {
  if (!actx || muted) return; const t0 = actx.currentTime, n = Math.floor(actx.sampleRate * dur);
  const buf = actx.createBuffer(1, n, actx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * i / n);
  const s = actx.createBufferSource(); s.buffer = buf;
  const f = actx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2; f.frequency.setValueAtTime(f0, t0); f.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
  const g = actx.createGain(); g.gain.value = gain; s.connect(f).connect(g).connect(actx.destination); s.start(t0);
}
const cues = CUES(T);
function runCues(t, fired) { cues.forEach((c, i) => { if (t >= c.t && !fired.has(i)) { fired.add(i); c.k === 'chime' ? chime(c.f, c.g, c.d) : whoosh(...c.a); } }); }

/* ---------------- Reloj de la experiencia ---------------- */
function makeClock() {
  let start = performance.now(), fired = new Set(), lastT = -1;
  return {
    restart() { start = performance.now(); fired = new Set(); lastT = -1; },
    tick() {
      const tau = (performance.now() - start) / 1000;
      const t = tau < UNFOLD ? 0 : (tau - UNFOLD) % LOOP;
      if (t < lastT) fired = new Set(); lastT = t;
      if (tau >= UNFOLD) runCues(t, fired);
      $('quote').classList.toggle('on', t > T.caption[0] && t < T.caption[1]);
      return { tau, t };
    },
  };
}

/* ---------------- Color de la tela ---------------- */
const FABRICS = { blanca: '#f3efe8', cruda: '#e9dcc4', negra: '#1b1a1c', azul: '#1f3f8f' };
let fabricMode = 'auto';
function wireFabric(frida, extra) {
  document.querySelectorAll('[data-fabric]').forEach((b) => b.addEventListener('click', () => {
    fabricMode = b.dataset.fabric;
    document.querySelectorAll('[data-fabric]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    if (fabricMode !== 'auto') { const c = new THREE.Color().setStyle(FABRICS[fabricMode], THREE.SRGBColorSpace); frida.setFabric(c); extra && extra(c); }
  }));
}

/* ---------------- Marcador MindAR (compilado en el teléfono, con caché) ---------------- */
const CACHE_KEY = 'frida-alas-3d-mind-v1';
const COMPILER_URL = 'https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image.prod.js';
function b64(buf) { let s = ''; const b = new Uint8Array(buf); for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); }
function unb64(str) { const s = atob(str), b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return b; }
async function loadCompiler() {
  const fromGlobal = () => window.MINDAR && window.MINDAR.IMAGE && window.MINDAR.IMAGE.Compiler;
  try { const mod = await import(COMPILER_URL); const C = mod.Compiler || fromGlobal(); if (C) return C; } catch (e) {}
  await new Promise((ok, ko) => { const s = document.createElement('script'); s.src = COMPILER_URL; s.onload = ok; s.onerror = () => ko(new Error('No cargó el compilador de MindAR')); document.head.appendChild(s); });
  const C = fromGlobal(); if (!C) throw new Error('El compilador de MindAR no está disponible'); return C;
}
async function getTargetSrc(onProgress) {
  try { const r = await fetch('assets/targets.mind', { method: 'HEAD' }); if (r.ok) return 'assets/targets.mind'; } catch (e) {}
  try { const cached = localStorage.getItem(CACHE_KEY); if (cached) return URL.createObjectURL(new Blob([unb64(cached)])); } catch (e) {}
  const img = await loadImg('assets/target.webp');
  const compiler = new (await loadCompiler())();
  await compiler.compileImageTargets([img], (p) => onProgress(p));
  const data = await compiler.exportData();
  try { localStorage.setItem(CACHE_KEY, b64(data)); } catch (e) {}
  return URL.createObjectURL(new Blob([data]));
}

/* ---------------- Muestra del color real de la tela desde la cámara ---------------- */
function makeFabricSampler(mindar, target) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 8; const c = cv.getContext('2d', { willReadFrequently: true });
  const pts = [[0, -A / 2 - .09], [-.6, 0], [.6, 0], [-.6, -A / 3], [.6, -A / 3]].map(([x, y]) => new THREE.Vector3(x, y, 0));
  const acc = new THREE.Color(), tmp = new THREE.Vector3(); let last = 0, have = false;
  return function sample(frida) {
    const now = performance.now(); if (now - last < (have ? 1500 : 400)) return; last = now;   // leer píxeles del video frena el cuadro: pocas veces
    const video = mindar.video, cont = $('ar'); if (!video || !video.videoWidth) return;
    const vr = video.getBoundingClientRect(), cr = cont.getBoundingClientRect();
    let r = 0, g = 0, b = 0, n = 0;
    for (const p of pts) {
      tmp.copy(p).applyMatrix4(target.matrixWorld).project(mindar.camera);
      if (Math.abs(tmp.x) > 1 || Math.abs(tmp.y) > 1) continue;
      const sx = (tmp.x + 1) / 2 * cr.width + cr.left, sy = (1 - tmp.y) / 2 * cr.height + cr.top;
      const vx = (sx - vr.left) / vr.width * video.videoWidth, vy = (sy - vr.top) / vr.height * video.videoHeight;
      if (vx < 4 || vy < 4 || vx > video.videoWidth - 4 || vy > video.videoHeight - 4) continue;
      try { c.drawImage(video, vx - 4, vy - 4, 8, 8, 0, 0, 8, 8); const d = c.getImageData(0, 0, 8, 8).data; for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; } } catch (e) { return; }
    }
    if (!n) return;
    const col = new THREE.Color().setRGB(r / n / 255, g / n / 255, b / n / 255, THREE.SRGBColorSpace);
    if (!have) { acc.copy(col); have = true; } else acc.lerp(col, .35);
    if (fabricMode === 'auto') frida.setFabric(acc);
  };
}

/* ---------------- Modo AR ---------------- */
async function startAR() {
  initAudio();
  show('intro', false); show('loading');
  const bar = $('loadBar');
  try {
    const [frida, src] = await Promise.all([makeFrida(true), getTargetSrc((p) => { bar.style.width = Math.round(p) + '%'; })]);
    bar.style.width = '100%'; $('loadMsg').textContent = 'Abriendo cámara';
    const mindar = new MindARThree({ container: $('ar'), imageTargetSrc: src, uiLoading: 'no', uiScanning: 'no', uiError: 'no', ...MINDAR_PASSTHROUGH });
    const { renderer, scene, camera } = mindar;
    renderer.outputColorSpace = THREE.SRGBColorSpace; addEnvironment(renderer, scene);
    renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));   // menos carga = más cuadros para el rastreo
    const anchor = mindar.addAnchor(0);
    const stab = makeStabilizer(anchor); scene.add(stab.group); stab.group.add(frida.root);   // la escena cuelga de la pose estabilizada
    const debug = makeDebug(stab);
    const clock = makeClock(); let visible = false;
    let everFound = false, lostAt = 0;
    anchor.onTargetFound = () => {
      visible = true; show('scan', false);
      if (!everFound || performance.now() - lostAt > RESTART_AFTER_MS) { clock.restart(); show('tilt'); setTimeout(() => show('tilt', false), 5200); }
      everFound = true;
    };
    anchor.onTargetLost = () => { visible = false; lostAt = performance.now(); show('scan'); show('tilt', false); $('quote').classList.remove('on'); };
    preferHDCamera();
    await mindar.start();
    const sample = makeFabricSampler(mindar, stab.group);
    show('loading', false); show('scan'); show('hud');
    wireFabric(frida);
    $('replay').onclick = () => { initAudio(); clock.restart(); };
    $('mute').onclick = () => { muted = !muted; $('mute').textContent = muted ? 'Sin sonido' : 'Sonido'; $('mute').setAttribute('aria-pressed', String(muted)); };
    renderer.setAnimationLoop(() => {
      stab.update();
      if (visible && stab.group.visible) { const { tau, t } = clock.tick(); frida.update(tau, t, camera); sample(frida); }
      renderer.render(scene, camera); debug();
    });
  } catch (e) {
    console.error(e);
    show('loading', false); show('err');
    if (/Permission|NotAllowed|getUserMedia|camera/i.test(String(e && (e.name + e.message)))) $('errMsg').textContent = 'El navegador no dio permiso a la cámara. Actívalo en la configuración del sitio y vuelve a intentar.';
    $('errDetail').textContent = String(e && e.message || e);
  }
}

/* ---------------- Demo 3D sin cámara ----------------
   Simula la playera y el estampado plano; la cámara oscila para mostrar la profundidad. */
async function startPreview() {
  show('intro', false); show('loading'); $('loadMsg').textContent = 'Cargando la escena';
  const frida = await makeFrida();
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); renderer.outputColorSpace = THREE.SRGBColorSpace;
  $('ar').appendChild(renderer.domElement);
  const scene = new THREE.Scene(); addEnvironment(renderer, scene);
  const camera = new THREE.PerspectiveCamera(42, 1, .01, 20);
  // "mundo real": tela y estampado impreso
  const print = await loadImg('assets/target.webp');
  const ptex = new THREE.Texture(print); ptex.colorSpace = THREE.SRGBColorSpace; ptex.needsUpdate = true;
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshBasicMaterial({ color: frida.fabric.clone(), depthWrite: false }));
  const flat = new THREE.Mesh(new THREE.PlaneGeometry(1, A), new THREE.MeshBasicMaterial({ map: ptex, depthWrite: false }));
  cloth.renderOrder = -20; flat.renderOrder = -19; cloth.position.z = flat.position.z = -.001;
  scene.add(cloth, flat, frida.root);
  wireFabric(frida, (c) => cloth.material.color.copy(c));
  document.querySelector('[data-fabric="auto"]').hidden = true;
  document.querySelector('[data-fabric="blanca"]').setAttribute('aria-pressed', 'true'); fabricMode = 'blanca';

  let dragX = 0, dragY = 0, down = null;
  const el = renderer.domElement;
  el.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY, dragX, dragY]; el.setPointerCapture(e.pointerId); });
  el.addEventListener('pointermove', (e) => { if (!down) return; dragX = clamp(down[2] + (e.clientX - down[0]) / 300, -1, 1); dragY = clamp(down[3] + (e.clientY - down[1]) / 300, -1, 1); });
  el.addEventListener('pointerup', () => { down = null; });
  const resize = () => { const w = innerWidth, h = innerHeight; renderer.setSize(w, h); camera.aspect = w / h; const d = (A * 1.55) / (2 * Math.tan(THREE.MathUtils.degToRad(21))) / Math.min(1, camera.aspect / .75); camera.userData.d = d; camera.updateProjectionMatrix(); };
  addEventListener('resize', resize); resize();
  const clock = makeClock();
  window.__preview = { renderer, scene, camera, frida, setView: null };
  show('loading', false); show('hud'); $('preview-badge').hidden = false;
  $('replay').onclick = () => { initAudio(); clock.restart(); };
  $('mute').textContent = 'Activar sonido';
  $('mute').onclick = () => { if (!actx) { initAudio(); $('mute').textContent = 'Sonido'; return; } muted = !muted; $('mute').textContent = muted ? 'Sin sonido' : 'Sonido'; };
  let fixed = null; window.__preview.setView = (yaw, pitch) => { fixed = [yaw, pitch]; };
  window.__preview.frame = (tau, t) => { render(true); frida.update(tau, t, camera); render(); };
  function render() {
    const s = performance.now() / 1000;
    const yaw = fixed ? fixed[0] : Math.sin(s * .4) * (USE_MODEL ? .95 : .42) + dragX * 1.2, pitch = fixed ? fixed[1] : Math.sin(s * .31) * .14 - dragY * .5;
    const d = camera.userData.d;
    camera.position.set(Math.sin(yaw) * Math.cos(pitch) * d, Math.sin(pitch) * d, Math.cos(yaw) * Math.cos(pitch) * d);
    camera.lookAt(0, 0, .03);
    renderer.render(scene, camera);
  }
  renderer.setAnimationLoop(() => { if (window.__preview.manual) return; const { tau, t } = clock.tick(); frida.update(tau, t, camera); render(); });
}

$('start').addEventListener('click', startAR, { once: true });
$('demo').addEventListener('click', () => { initAudio(); startPreview(); }, { once: true });
if (location.hash === '#preview') startPreview();
