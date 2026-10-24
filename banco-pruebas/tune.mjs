import { loadRun, simulate, metrics, fmt } from './eval.mjs';
import path from 'path'; import { pathToFileURL } from 'url';
const THREE = await import(pathToFileURL(path.resolve(path.dirname(new URL(import.meta.url).pathname), '../three/build/three.module.js')).href);

/* Umbrales de aprobación, px CSS en un celular de 390×844 (1 minuto de arco a 30 cm ≈ 0.5 px CSS).
   Todo se mide como EXCESO sobre un "rastreador perfecto" con el mismo horario real (20 fps, latencia
   de 30–55 ms): lo que ni ese oráculo puede seguir (pulso de la mano >10 Hz) no se le cobra al filtro.
   tripode: celular fijo → el temblor que queda es ruido del rastreo; además se exige un tope absoluto.
   El desfase de lo que sobresale (cara, alas) se compara contra MindAR sin filtrar: el filtro no debe empeorarlo.
   El mapeo del trípode se compara contra el rastreo crudo (MindAR tiene un sesgo fijo que no es temblor). */
export const LIM = {
  tripode: { shake: 0.12, p95: 0.25, mapa: 0.5, reg: 1.0, absShake: 0.3, mapaRef: 'raw' },
  quieto:  { shake: 0.3, p95: 0.6, mapa: 1.0, reg: 1.0 },
  lento:   { shake: 0.3, p95: 0.6, mapa: 1.0, reg: 1.0 },
  acercar: { shake: 0.3, p95: 0.6, mapa: 1.0, reg: 1.0 },
  rapido:  { shake: 0.6, p95: 1.2, mapa: 2.5, reg: 2.0 },
};
// reg (desfase de la figura que sobresale): contra MindAR sin filtrar, porque su sesgo fijo de inclinación
// no lo puede quitar ningún filtro; temblor y mapeo de la playera: contra el rastreador perfecto.
const oracleCache = new Map(), rawCache = new Map();
export async function oracle(run) {
  if (oracleCache.has(run.dir)) return oracleCache.get(run.dir);
  const inv = run.post.clone().invert();
  const o = { ...run, raw: run.gt.sched.map(e => new THREE.Matrix4().fromArray(run.gt.video[e.c]).multiply(inv).elements.slice()) };
  const m = metrics(await simulate(o, { kind: 'raw' }));
  oracleCache.set(run.dir, m); return m;
}
async function rawM(run) { if (!rawCache.has(run.dir)) rawCache.set(run.dir, metrics(await simulate(run, { kind: 'raw' }))); return rawCache.get(run.dir); }
export async function evalSet(runs, v) {
  const out = [];
  for (const run of runs) {
    const m = metrics(await simulate(run, v)); const L = LIM[run.gt.scen];
    const o = await oracle(run); const mref = L.mapaRef === 'raw' ? (await rawM(run)).mapa : o.mapa;
    const rr = await rawM(run);
    const ex = m && { shake: m.shake - o.shake, p95: m.p95 - o.p95, mapa: m.mapa - mref, reg: m.reg - rr.reg };
    let score = m ? Math.max(ex.shake / L.shake, ex.p95 / L.p95, ex.mapa / L.mapa, ex.reg / L.reg) : 9;
    if (m && L.absShake) score = Math.max(score, m.shake / L.absShake);
    out.push({ dir: run.dir, scen: run.gt.scen, m, o, ex, pass: !!m && score <= 1 && m.cobertura > 0.97, score });
  }
  return out;
}
export const line = (r) => `${r.pass ? 'PASA ' : 'FALLA'} ${r.dir.padEnd(16)} ${r.score.toFixed(2)}  ${fmt(r.m)}` +
  `  | exceso: temblor ${r.ex.shake.toFixed(2)} · mapeo ${r.ex.mapa.toFixed(1)}`;

if ((process.argv[1] || '').endsWith('tune.mjs')) {
  const arg = process.argv[2];
  const v = arg === 'raw' ? { kind: 'raw' } : { kind: 'stab', file: path.resolve(arg), P: JSON.parse(process.argv[3] || '{}') };
  const runs = process.argv.slice(4).map(loadRun);
  for (const r of await evalSet(runs, v)) console.log(line(r));
}
