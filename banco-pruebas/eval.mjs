// Evalúa variantes de filtrado sobre poses reales de MindAR contra la verdad del video.
// Mide, en px CSS de un celular (390×844), cuánto se mueve el contenido respecto a la playera.
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const THREE_PATH = path.resolve(HERE, '../three/build/three.module.js');
const THREE = await import(pathToFileURL(THREE_PATH).href);
const { OneEuroFilter } = await import('./one-euro-filter.mjs');

const F_CSS = (844 / 2) / Math.tan(22.5 * Math.PI / 180);
// puntos de la figura en el espacio del ancla (ancho de ilustración = 1)
export const POINTS = {
  base: [0, 0, 0], esqSupIzq: [-0.5, 0.664, 0], esqInfDer: [0.5, -0.664, 0],
  cabeza: [0, 0.42, 0.32], frente: [0, 0.05, 0.46], tope: [0, 0.56, 0.15],
  lado: [0.47, -0.2, 0.22], ala: [0.66, 0.3, 0.0],
};
const MAP_PTS = ['base', 'esqSupIzq', 'esqInfDer'];

const modCache = new Map();
export async function loadStab(file) {
  if (modCache.has(file)) return modCache.get(file);
  const src = fs.readFileSync(file, 'utf8').replace(/from 'three'/g, `from '${pathToFileURL(THREE_PATH).href}'`);
  const tmp = path.join(HERE, 'variants', '_' + path.basename(file).replace(/\.js$/, '') + '_' + Date.now() + Math.random().toString(36).slice(2) + '.mjs');
  fs.writeFileSync(tmp, src);
  const m = await import(pathToFileURL(tmp).href);
  fs.unlinkSync(tmp);
  modCache.set(file, m); return m;
}

export function loadRun(dir) {
  const gt = JSON.parse(fs.readFileSync(path.join(dir, 'gt.json')));
  const rr = JSON.parse(fs.readFileSync(path.join(dir, process.env.RAW || 'raw.json')));
  const [mw, mh] = rr.dims;
  const post = new THREE.Matrix4().compose(new THREE.Vector3(mw / 2, mw / 2 + (mh - mw) / 2, 0), new THREE.Quaternion(), new THREE.Vector3(mw, mw, mw));
  return { gt, raw: rr.raw, post, dir };
}

// variante: { kind:'raw' } | { kind:'mindar', cf, beta } | { kind:'stab', file, P, cf?, beta? }
export async function simulate(run, v) {
  const { gt, raw, post } = run;
  const cf = v.kind === 'mindar' ? v.cf : 1000, beta = v.kind === 'mindar' ? v.beta : 0;
  const warm = 3, missTol = v.kind === 'mindar' ? (v.miss ?? 10) : 8;
  const filter = new OneEuroFilter({ minCutOff: cf, beta });
  const anchor = { group: { visible: false, matrix: new THREE.Matrix4() } };
  let stab = null;
  if (v.kind === 'stab') { const m = await loadStab(v.file); stab = m.makeStabilizer(anchor, { ...m.STAB, ...(v.P || {}) }); }
  let trackCount = 0, showing = false, miss = 0, k = 0, lastWorld = null;
  const vid = gt.vid, frames = [];
  const tEnd = gt.sched[gt.sched.length - 1].r;
  for (let i = 0; ; i++) {
    const t = i / 60; if (t > tEnd) break;
    while (k < gt.sched.length && gt.sched[k].r <= t + 1e-9) {
      const w = raw[k]; const tms = gt.sched[k].r * 1000;
      if (w) { lastWorld = w; miss = 0; if (!showing) { trackCount++; if (trackCount > warm) { showing = true; filter.reset(); } } }
      else if (showing) { trackCount = 0; miss++; if (miss > missTol) { showing = false; anchor.group.visible = false; } }
      if (showing && lastWorld) {
        const fw = filter.filter(tms, lastWorld);
        const m = new THREE.Matrix4(); m.elements = [...fw]; m.multiply(post);
        anchor.group.matrix = m; anchor.group.visible = true;
      }
      k++;
    }
    let M = null;
    if (stab) { stab.update(t * 1000); if (stab.group.visible) M = stab.group.matrix.clone(); }
    else if (anchor.group.visible) M = anchor.group.matrix.clone();
    const c = Math.min(gt.video.length - 1, Math.floor(t / vid + 1e-9));
    frames.push({ t, M, G: new THREE.Matrix4().fromArray(gt.video[c]) });
  }
  return frames;
}

const proj = (M, p, out) => { const v = new THREE.Vector3(...p).applyMatrix4(M); out[0] = F_CSS * v.x / -v.z; out[1] = F_CSS * v.y / -v.z; return out; };

export function metrics(frames, skip = 1.0) {
  const first = frames.findIndex(f => f.M); if (first < 0) return null;
  const fr = frames.filter(f => f.M && f.t >= frames[first].t + skip);
  const res = {};
  const a = [0, 0], b = [0, 0];
  for (const [name, p] of Object.entries(POINTS)) {
    const e = fr.map(f => { proj(f.M, p, a); proj(f.G, p, b); return [a[0] - b[0], a[1] - b[1]]; });
    const n = e.length, H = 7; // media centrada de 15 cuadros (250 ms): lo que queda arriba de ~4 Hz es temblor
    let reg = 0, sh = 0, jk = 0; const shs = [];
    for (let i = 0; i < n; i++) {
      reg += e[i][0] ** 2 + e[i][1] ** 2;
      if (i >= H && i < n - H) {
        let mx = 0, my = 0; for (let j = i - H; j <= i + H; j++) { mx += e[j][0]; my += e[j][1]; }
        mx /= 2 * H + 1; my /= 2 * H + 1;
        const d = Math.hypot(e[i][0] - mx, e[i][1] - my); sh += d * d; shs.push(d);
      }
      if (i) jk += (e[i][0] - e[i - 1][0]) ** 2 + (e[i][1] - e[i - 1][1]) ** 2;
    }
    shs.sort((x, y) => x - y);
    res[name] = { reg: Math.sqrt(reg / n), shake: Math.sqrt(sh / shs.length), p95: shs[Math.floor(shs.length * .95)], jerk: Math.sqrt(jk / (n - 1)) };
  }
  const vals = Object.values(res);
  return {
    shake: Math.max(...vals.map(r => r.shake)), p95: Math.max(...vals.map(r => r.p95)), jerk: Math.max(...vals.map(r => r.jerk)),
    mapa: Math.max(...MAP_PTS.map(k => res[k].reg)), reg: Math.max(...vals.map(r => r.reg)), pts: res,
    cobertura: fr.length / frames.filter(f => f.t >= frames[first].t + skip).length,
  };
}

export const fmt = (m) => m ? `temblor ${m.shake.toFixed(2)} px (p95 ${m.p95.toFixed(2)}) · salto/cuadro ${m.jerk.toFixed(2)} · mapeo ${m.mapa.toFixed(1)} px · desfase máx ${m.reg.toFixed(1)} px` : 'sin pose';

// CLI: node eval.mjs runs/a runs/b ...
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const runs = process.argv.slice(2).map(loadRun);
  const V = {
    'sin filtro (MindAR crudo)': { kind: 'raw' },
    'MindAR 0.001/500 (antes)': { kind: 'mindar', cf: 0.001, beta: 500 },
    'MindAR ?mincf=0.0004': { kind: 'mindar', cf: 0.0004, beta: 500 },
    'MindAR ?beta=1500': { kind: 'mindar', cf: 0.001, beta: 1500 },
    'estabilizador publicado (4c52794)': { kind: 'stab', file: path.join(HERE, 'variants/v_old.js') },
    'estabilizador corregido (1709a34)': { kind: 'stab', file: path.join(HERE, 'variants/v_cur.js') },
  };
  for (const run of runs) {
    console.log(`\n== ${run.dir} (${run.gt.scen}, semilla ${run.gt.seed}, ${run.gt.W}x${run.gt.H})`);
    for (const [name, v] of Object.entries(V)) console.log(name.padEnd(36), fmt(metrics(await simulate(run, v))));
  }
}
