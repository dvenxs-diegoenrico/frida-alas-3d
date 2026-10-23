/* ============================================================
   VISOR · Frida 3D generada con IA (Tripo H3.1 vía Higgsfield)
   Carga el GLB y lo pone sobre la misma base de talavera que la
   figura hecha por código, para compararlas.
   ============================================================ */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const $ = (id) => document.getElementById(id);
const SOURCES = ['assets/modelo/frida-3d.glb'];   // versión optimizada para celular

function canvasTex(c) { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }
function talaveraTex() {
  const w = 1024, h = 256, c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
  const azul = '#1f3f9a', azul2 = '#2f5cc8', crema = '#f6f1e4', ocre = '#e0a23a';
  x.fillStyle = crema; x.fillRect(0, 0, w, h);
  x.fillStyle = azul; x.fillRect(0, 0, w, 22); x.fillRect(0, h - 22, w, 22);
  x.fillStyle = ocre; x.fillRect(0, 22, w, 6); x.fillRect(0, h - 28, w, 6);
  for (let k = 0; k < 8; k++) {
    const cx = k * (w / 8) + w / 16, cy = h / 2; x.save(); x.translate(cx, cy);
    for (let p = 0; p < 8; p++) { x.rotate(Math.PI / 4); x.fillStyle = p % 2 ? azul : azul2; x.beginPath(); x.ellipse(0, -38, 13, 30, 0, 0, Math.PI * 2); x.fill(); }
    x.fillStyle = ocre; x.beginPath(); x.arc(0, 0, 14, 0, Math.PI * 2); x.fill(); x.fillStyle = azul; x.beginPath(); x.arc(0, 0, 6, 0, Math.PI * 2); x.fill(); x.restore();
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

async function loadFirst(loader) {
  let last;
  for (const url of SOURCES) { try { return await loader.loadAsync(url); } catch (e) { last = e; } }
  throw last || new Error('No hay archivo de modelo');
}

async function main() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1)); renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  $('stage').appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), .04).texture;
  const camera = new THREE.PerspectiveCamera(35, 1, .01, 50);
  scene.add(new THREE.HemisphereLight(0xfff4e6, 0x1b3f9a, .55));
  const key = new THREE.DirectionalLight(0xfff0d8, 1.6); key.position.set(1.2, 1.6, 2); scene.add(key);
  const rim = new THREE.DirectionalLight(0x9fc0ff, 1.0); rim.position.set(-1.5, .8, -2); scene.add(rim);

  const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loadFirst(loader);
  let model = gltf.scene; model.rotation.y = -Math.PI / 2; model.updateMatrixWorld(true);  // de frente
  // Normaliza: alto 1.33 (como la figura por código), centrada, pies en la base
  const inner = model; model = new THREE.Group(); model.add(inner);
  const box = new THREE.Box3().setFromObject(model), size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
  const k = 1.33 / size.y; model.scale.setScalar(k);
  model.position.set(-center.x * k, -box.min.y * k, -center.z * k);
  let tris = 0; model.traverse((o) => { if (o.isMesh) { tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; if (o.material) o.material.envMapIntensity = .6; } });
  const holder = new THREE.Group(); holder.add(model); scene.add(holder);
  const footY = -1.33 / 2 + .02; holder.position.y = footY;

  const R = .44, BH = .13;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(R, R * 1.04, BH, 96), [
    new THREE.MeshPhysicalMaterial({ map: talaveraTex(), roughness: .25, clearcoat: 1, clearcoatRoughness: .1 }),
    new THREE.MeshPhysicalMaterial({ map: topTex(), roughness: .25, clearcoat: 1, clearcoatRoughness: .1 }),
    new THREE.MeshPhysicalMaterial({ color: 0x1f3f9a, roughness: .4 }),
  ]);
  base.position.y = footY - BH / 2; scene.add(base);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), new THREE.MeshBasicMaterial({ map: shadowTex(), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = footY - BH - .001; scene.add(shadow);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, -.08, 0); controls.enableDamping = true; controls.autoRotate = true; controls.autoRotateSpeed = 1.6;
  controls.minDistance = 1.2; controls.maxDistance = 5; controls.maxPolarAngle = Math.PI * .58;
  function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h); camera.aspect = w / h; camera.userData.dist = 3.05 / Math.min(1, camera.aspect / .8); camera.updateProjectionMatrix(); }
  addEventListener('resize', resize); resize();
  const setView = (yaw, pitch = .12) => { const d = camera.userData.dist; camera.position.set(Math.sin(yaw) * Math.cos(pitch) * d, -.08 + Math.sin(pitch) * d, Math.cos(yaw) * Math.cos(pitch) * d); controls.update(); };
  setView(.5);
  const pressed = (id, on) => $(id).setAttribute('aria-pressed', String(on));
  $('spin').onclick = () => { controls.autoRotate = !controls.autoRotate; pressed('spin', controls.autoRotate); };
  $('front').onclick = () => { controls.autoRotate = false; pressed('spin', false); setView(0); };
  $('side').onclick = () => { controls.autoRotate = false; pressed('spin', false); setView(Math.PI / 2); };
  $('back').onclick = () => { controls.autoRotate = false; pressed('spin', false); setView(Math.PI); };
  $('stats').textContent = `${Math.round(tris).toLocaleString('es-MX')} triángulos`;

  const frame = () => { controls.update(); renderer.render(scene, camera); };
  renderer.setAnimationLoop(() => { if (!window.__ia?.manual) frame(); });
  window.__ia = { setView, frame, controls, manual: false };
  $('loading').hidden = true;
}
main().catch((e) => { console.error(e); $('loading').textContent = 'No se pudo cargar el modelo: ' + (e.message || e); });
