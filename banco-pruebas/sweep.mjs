import { loadRun } from './eval.mjs';
import { evalSet } from './tune.mjs';
import path from 'path';
const file = path.resolve(process.argv[2]);
let P = JSON.parse(process.argv[3] || '{}');
const runs = process.argv.slice(4).map(loadRun);
const GRID = {
  tiltQ: [3e-7, 1e-6, 2e-6, 3e-6, 5e-6, 1e-5, 3e-5], tiltQMax: [0.1, 0.2, 0.3, 0.5, 1, 2],
  manOn: [3, 4, 5, 6, 8, 99], manAlpha: [0.08, 0.1, 0.15, 0.2],
  twistQ: [1e-5, 1e-4, 1e-3, 1e-2, 0.1], twistQMax: [0.3, 1, 3, 10, 60],
  latQ: [1e-6, 3e-6, 1e-5, 3e-5, 1e-4, 3e-4], latQMax: [0.03, 0.1, 0.3, 1, 2, 5],
  depQ: [1e-5, 1e-4, 3e-4, 1e-3, 3e-3], depQMax: [0.3, 1, 5, 20], lead: [0, 0.1, 0.2, 0.3, 0.5],
  adaptR: [true, false], rMin: [0.7, 1, 1.3], rMax: [1, 1.3, 1.6, 2, 3], tiltSigma: [0.012, 0.016, 0.02, 0.025], smooth: [0, 0.01, 0.02, 0.03, 0.04, 0.05, 0.07], smoothPow: [1, 1.5, 2, 3], smoothGate: [true, false],
};
async function obj(P) { const r = await evalSet(runs, { kind: 'stab', file, P }); const s = r.map(x => x.score);
  return { v: Math.max(...s) + 0.15 * s.reduce((a, b) => a + b) / s.length, fails: r.filter(x => !x.pass).map(x => x.dir.replace('runs/', '')), max: Math.max(...s) }; }
let best = await obj(P); console.log('inicio', best.v.toFixed(3), JSON.stringify(P), best.fails.join(','));
for (let pass = 0; pass < 5; pass++) {
  let improved = false;
  for (const [k, vals] of Object.entries(GRID)) {
    for (const val of vals) {
      if (P[k] === val) continue;
      const Q = { ...P, [k]: val }; const o = await obj(Q);
      if (o.v < best.v - 1e-4) { best = o; P = Q; improved = true; console.log(`  ${k}=${val} → ${o.v.toFixed(3)} (máx ${o.max.toFixed(2)}) fallan: ${o.fails.join(',') || 'ninguna'}`); }
    }
  }
  if (!improved) break;
}
console.log('MEJOR', JSON.stringify(P), best.v.toFixed(3));
