import { loadRun } from './eval.mjs'; import { evalSet, line } from './tune.mjs'; import path from 'path'; import fs from 'fs';
const file = path.resolve(process.argv[2]); const seeds = process.argv.slice(3);
let ok = 0; const rows = [];
for (const s of seeds) {
  const dirs = fs.readdirSync('runs').filter(d => d.startsWith(s + '_')).map(d => 'runs/' + d);
  const r = await evalSet(dirs.map(loadRun), { kind: 'stab', file });
  const pass = r.every(x => x.pass); ok += pass;
  console.log(`\n=== Corrida ${s}: ${pass ? 'APROBADA' : 'NO APROBADA'} (${r[0] && loadRun(dirs[0]).gt.W}x${loadRun(dirs[0]).gt.H})`);
  r.forEach(x => { console.log('  ' + line(x)); rows.push({ corrida: s, escena: x.scen, pasa: x.pass, puntaje: +x.score.toFixed(2), temblor: +x.m.shake.toFixed(2), temblorOraculo: +x.o.shake.toFixed(2), mapeo: +x.m.mapa.toFixed(2) }); });
}
console.log(`\n${ok}/${seeds.length} corridas aprobadas seguidas`);
fs.writeFileSync('aprobacion.json', JSON.stringify(rows, null, 1));
