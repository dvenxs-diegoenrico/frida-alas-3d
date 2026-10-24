/* ============================================================
   ESTABILIZADOR DE POSE v2 (MindAR + three.js)

   Medido con el rastreador real de MindAR sobre video de la ilustración:
   - La INCLINACIÓN (giro fuera del plano de la playera) trae casi todo el ruido:
     ±0.4–1.1° por cuadro, aleatorio. Como Frida sobresale medio ancho de la
     ilustración, eso mueve su cara 1–2 px: es el temblor que se ve.
   - El GIRO en el plano (±0.14°), la posición lateral (±0.25 px) y la
     profundidad (±0.15 %) son muy precisos. Filtrarlos fuerte solo despega
     a Frida de la playera (no sigue el pulso de la mano ni el acercamiento).

   Por eso cada parte tiene su propio filtro de Kalman (posición + velocidad):
   la inclinación se filtra fuerte, lo demás casi nada. Un detector de movimiento
   (la diferencia entre lo medido y lo esperado crece más de lo que explica el
   ruido) abre el filtro al empezar a moverse, y el nivel de ruido se mide en vivo.
   Entre poses del rastreo (15–30 fps) la salida avanza con la velocidad estimada
   y se suaviza a 60 fps, así los saltos entre poses no se ven.
   ============================================================ */
import * as THREE from 'three';

const QS = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams('');
const num = (k, d) => { const v = parseFloat(QS.get(k)); return Number.isFinite(v) ? v : d; };

// σ = ruido de medición por pose · q = cuánto puede cambiar la velocidad en reposo · qMax = en movimiento.
// Valores afinados con el rastreador real de MindAR (banco de pruebas: 4 escenas × 4 condiciones).
export const STAB = {
  tiltSigma: num('tsig', 0.016), tiltQ: num('tq', 3e-6), tiltQMax: num('tqmax', 1),         // inclinación (rad)
  twistSigma: num('wsig', 0.0025), twistQ: num('wq', 1e-3), twistQMax: num('wqmax', 0.3),   // giro en el plano (rad)
  latSigma: num('lsig', 0.00025), latQ: num('lq', 1e-4), latQMax: num('lqmax', 0.3),          // lateral (fracción de la distancia)
  depSigma: num('dsig', 0.0016), depQ: num('dq', 3e-4), depQMax: num('dqmax', 0.3),         // profundidad relativa
  manAlpha: 0.2,            // memoria del detector de movimiento (~0.25 s a 20 fps)
  manOn: num('man', 4),     // umbral del detector (varianzas normalizadas)
  adaptR: QS.get('adapt') !== '0',
  rMin: 1, rMax: 6,                 // el ruido medido en vivo puede subir, nunca bajar del de banco (el error de MindAR se arrastra)
  lead: num('lead', 0.1),   // compensación de latencia: fracción del intervalo entre poses
  maxLead: 0.12,            // s
  smooth: num('suave', 0), // s (a 20 fps de rastreo): suavizado extra a 60 fps de la salida (apagado)
  smoothPow: 1, smoothGate: true,
  snapAngle: 0.6,
};

export const MINDAR_PASSTHROUGH = { filterMinCF: 1000, filterBeta: 0, warmupTolerance: 3, missTolerance: 8 };

// Canal de Kalman isotrópico de velocidad constante (la misma covarianza para cada eje del vector)
function channel(sigma, q, qMax, P) {
  const c = { R: sigma * sigma, R0: sigma * sigma, q, qMax, p00: sigma * sigma, p01: 0, p11: 1, man: 0, boost: 0 };
  c.predict = (dt) => {
    const qq = c.q + (c.qMax - c.q) * c.boost;
    const p00 = c.p00 + dt * (2 * c.p01 + dt * c.p11) + qq * dt * dt * dt / 3;
    const p01 = c.p01 + dt * c.p11 + qq * dt * dt / 2;
    const p11 = c.p11 + qq * dt;
    c.p00 = p00; c.p01 = p01; c.p11 = p11;
  };
  // y = innovación (vector), n = ejes. Devuelve ganancias [k0, k1]
  c.update = (y, n) => {
    const y2 = y.lengthSq(), S = c.p00 + c.R;
    // detector de maniobra: energía de la innovación (χ² normalizada, promediada)
    const nu = y2 / (S * n);
    c.man += (nu - c.man) * P.manAlpha;
    const target = Math.min(1, Math.max(0, (c.man - P.manOn) / (3 * P.manOn)));
    c.boost += (target - c.boost) * (target > c.boost ? 0.6 : 0.15);
    // ruido de medición en vivo (solo en calma, lento, acotado)
    if (P.adaptR && c.boost < 0.05 && nu < 4) {
      const r = Math.max(0, y2 / n - c.p00);
      c.R = Math.min(c.R0 * P.rMax, Math.max(c.R0 * P.rMin, c.R + (r - c.R) * 0.03));
    }
    const k0 = c.p00 / S, k1 = c.p01 / S;
    const p11 = c.p11 - k1 * c.p01, p01 = (1 - k0) * c.p01, p00 = (1 - k0) * c.p00;
    c.p00 = p00; c.p01 = p01; c.p11 = Math.max(p11, 1e-12);
    return [k0, k1];
  };
  c.reset = () => { c.p00 = c.R; c.p01 = 0; c.p11 = 1; c.man = 0; c.boost = 0; };
  return c;
}

export function makeStabilizer(anchor, P = STAB) {
  P = { ...STAB, ...P };
  const group = new THREE.Group();
  group.matrixAutoUpdate = false; group.visible = false;
  const tilt = channel(P.tiltSigma, P.tiltQ, P.tiltQMax, P), twist = channel(P.twistSigma, P.twistQ, P.twistQMax, P);
  const lat = channel(P.latSigma, P.latQ, P.latQMax, P), dep = channel(P.depSigma, P.depQ, P.depQMax, P);
  const rp = new THREE.Vector3(), rq = new THREE.Quaternion(), rs = new THREE.Vector3();
  const fp = new THREE.Vector3(), fq = new THREE.Quaternion(); let fs = 1;
  const vel = new THREE.Vector3(), omega = new THREE.Vector3();
  let lastRawT = 0, init = false, interval = 50;
  let outInit = false;
  const lastEl = new Float64Array(16);
  const t1 = new THREE.Vector3(), t2 = new THREE.Vector3(), t3 = new THREE.Vector3(), u = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
  const yT = new THREE.Vector3(), yW = new THREE.Vector3(), yL = new THREE.Vector3(), yLn = new THREE.Vector3(), yDn = new THREE.Vector3();
  const qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), qPredInv = new THREE.Quaternion();
  const toVec = (q, out) => {
    if (q.w < 0) q.set(-q.x, -q.y, -q.z, -q.w);
    const sn = Math.sqrt(q.x * q.x + q.y * q.y + q.z * q.z), ang = 2 * Math.atan2(sn, q.w);
    return sn < 1e-12 ? out.set(0, 0, 0) : out.set(q.x, q.y, q.z).multiplyScalar(ang / sn);
  };
  const fromVec = (v, out) => { const ang = v.length(); if (ang < 1e-12) return out.set(0, 0, 0, 1); const k = Math.sin(ang / 2) / ang; return out.set(v.x * k, v.y * k, v.z * k, Math.cos(ang / 2)); };

  function update(now = performance.now()) {
    const gA = anchor.group;
    group.visible = gA.visible;
    if (!gA.visible) { init = false; return false; }
    const el = gA.matrix.elements; let fresh = !init;
    for (let i = 0; i < 16 && !fresh; i++) if (el[i] !== lastEl[i]) fresh = true;
    if (init && !fresh) { show(now); return true; }
    lastEl.set(el);
    gA.matrix.decompose(rp, rq, rs); rq.normalize();
    const s = (Math.abs(rs.x) + Math.abs(rs.y) + Math.abs(rs.z)) / 3 || 1;
    const dtMs = lastRawT ? now - lastRawT : 50;
    const dt = Math.min(0.15, Math.max(1 / 240, dtMs / 1000)); lastRawT = now;
    if (init) interval += (Math.min(150, dtMs) - interval) * 0.1;
    if (!init || fq.angleTo(rq) > P.snapAngle || rp.distanceTo(fp) > 0.25 * fp.length()) {
      fp.copy(rp); fq.copy(rq); fs = s; vel.set(0, 0, 0); omega.set(0, 0, 0); outInit = false;
      [tilt, twist, lat, dep].forEach(c => c.reset()); init = true;
    } else {
      // --- rotación: predicción, innovación separada en inclinación y giro en el plano de la imagen
      tilt.predict(dt); twist.predict(dt);
      const pred = qa.copy(fromVec(t3.copy(omega).multiplyScalar(dt), qb)).multiply(fq).normalize();
      const r = toVec(qb.copy(rq).multiply(qPredInv.copy(pred).invert()), t3);  // rq · pred⁻¹ (marco de cámara)
      u.copy(fp).normalize();                                     // línea de vista al centro de la ilustración
      yW.copy(u).multiplyScalar(r.dot(u)); yT.copy(r).sub(yW);
      const [kt0, kt1] = tilt.update(yT, 2);
      const [kw0, kw1] = twist.update(yW, 1);
      t1.copy(yT).multiplyScalar(kt0).addScaledVector(yW, kw0);
      fq.copy(fromVec(t1, qb).multiply(pred)).normalize();
      omega.addScaledVector(yT, kt1).addScaledVector(yW, kw1);
      // --- posición: lateral y profundidad (relativas a la distancia)
      lat.predict(dt); dep.predict(dt);
      const fpPred = t2.copy(fp).addScaledVector(vel, dt);
      const D = Math.max(1e-6, fpPred.length()); u.copy(fpPred).divideScalar(D);
      const res = t1.subVectors(rp, fpPred); const along = res.dot(u);
      yL.copy(res).addScaledVector(u, -along);
      const [kl0, kl1] = lat.update(yLn.copy(yL).divideScalar(D), 2);
      const [kd0, kd1] = dep.update(yDn.set(along / D, 0, 0), 1);
      fp.copy(fpPred).addScaledVector(yL, kl0).addScaledVector(u, along * kd0);
      vel.addScaledVector(yL, kl1).addScaledVector(u, along * kd1);
      fs = s;   // MindAR da escala constante (ancho del marcador)
    }
    show(now);
    return true;
  }
  // Estado corregido proyectado al instante actual + latencia del rastreo (el estado no se toca aquí)
  const dq = new THREE.Quaternion(), dp = new THREE.Vector3(), dv = new THREE.Vector3();
  const oq = new THREE.Quaternion(), op = new THREE.Vector3(); let lastShow = 0;
  function show(now) {
    const e = Math.min(P.maxLead, Math.max(0, (now - lastRawT) / 1000 + P.lead * interval / 1000));
    fromVec(dv.copy(omega).multiplyScalar(e), dq).multiply(fq).normalize();
    dp.copy(fp).addScaledVector(vel, e);
    // suavizado a la frecuencia de pantalla: los saltos de 20 fps se vuelven continuos
    const dts = outInit ? Math.min(0.1, Math.max(0, (now - lastShow) / 1000)) : 1; lastShow = now;
    // más fuerte si el rastreo es lento (saltos más grandes); se apaga mientras hay movimiento real
    const still = 1 - Math.max(tilt.boost, twist.boost, lat.boost, dep.boost);
    const tau = P.smooth * Math.pow(interval / 50, P.smoothPow) * (P.smoothGate ? still : 1);
    const a = !outInit || tau <= 0 ? 1 : 1 - Math.exp(-dts / tau);
    if (a >= 1) { op.copy(dp); oq.copy(dq); outInit = true; }
    else {
      // la salida avanza con la velocidad estimada (sin retraso a velocidad constante) y se acerca al objetivo
      op.addScaledVector(vel, dts); oq.premultiply(fromVec(dv.copy(omega).multiplyScalar(dts), qb)).normalize();
      op.lerp(dp, a); oq.slerp(dq, a);
    }
    group.matrix.compose(op, oq, t1.copy(one).multiplyScalar(fs));
    group.updateMatrixWorld(true);
  }
  return { group, update, reset: () => { init = false; },
    state: () => ({ vRot: tilt.boost, vPos: lat.boost, vDep: dep.boost, fs, tiltR: Math.sqrt(tilt.R) * 180 / Math.PI, interval }) };
}

/* Resolución de cámara: medido con MindAR, 640×480 da el mismo ruido que 1280×720 y rastrea al doble
   de velocidad (menos latencia). Por eso ya no se pide HD; ?res=hd la vuelve a pedir. */
export function preferHDCamera() {
  if (QS.get('res') !== 'hd' || typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return;
  const md = navigator.mediaDevices; if (md.__hdPatched) return; md.__hdPatched = true;
  const orig = md.getUserMedia.bind(md);
  md.getUserMedia = (c) => {
    try { if (c && c.video) { const v = typeof c.video === 'object' ? c.video : {}; c = { ...c, video: { ...v, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } } }; } } catch (e) {}
    return orig(c);
  };
}

export function makeDebug(stab) {
  if (QS.get('debug') !== '1') return () => {};
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;z-index:99;left:8px;top:calc(8px + env(safe-area-inset-top,0px));font:12px/1.3 ui-monospace,monospace;color:#fff;background:rgba(0,0,0,.6);padding:6px 8px;border-radius:6px;pointer-events:none';
  document.body.appendChild(el);
  let n = 0, t0 = performance.now();
  return () => {
    n++; const now = performance.now();
    if (now - t0 > 500) { const fps = n * 1000 / (now - t0); n = 0; t0 = now; const st = stab.state();
      el.textContent = `${fps.toFixed(0)} fps · rastreo ${(1000 / st.interval).toFixed(0)} fps · pose ${refinerOn ? 'recalculada' : 'de MindAR'} · ruido incl. ${st.tiltR.toFixed(2)}° · mov ${st.vRot.toFixed(2)}/${st.vPos.toFixed(2)}/${st.vDep.toFixed(2)}`; }
  };
}

/* ============================================================
   REFINADOR DE POSE
   MindAR refina la pose desde la pose anterior y a veces se queda atorado en el
   "valle" de inclinación (un plano visto de lejos casi no cambia su imagen al
   inclinarse): medido con su propio rastreo, llega a 4–10° de error sostenido y
   Frida se ve ladeada o despegada al rodearla. Aquí se recalcula la pose con los
   mismos puntos que MindAR acaba de rastrear (mínimos cuadrados robustos), y se le
   devuelve a MindAR para que siga rastreando desde la pose buena. ?refinar=0 lo apaga.
   ============================================================ */
export function refinePose(mvt, world, screen, K, iters = 10) {
  const n = world.length; if (n < 6) return null;
  const fx = K[0][0], fy = K[1][1], cx = K[0][2], cy = K[1][2];
  // La matriz de MindAR no es una rotación pura (trae estiramiento/torcedura de ~3 %):
  // se lleva a la rotación más cercana (descomposición polar, iteración de Newton) y desde ahí se ajusta.
  let R = [[mvt[0][0], mvt[0][1], mvt[0][2]], [mvt[1][0], mvt[1][1], mvt[1][2]], [mvt[2][0], mvt[2][1], mvt[2][2]]];
  for (let i = 0; i < 6; i++) { const Ri = inv3T(R); if (!Ri) return null; R = R.map((r, a) => r.map((v, c) => 0.5 * (v + Ri[a][c]))); }
  let t = [mvt[0][3], mvt[1][3], mvt[2][3]];
  const residuals = (R, t, out) => {   // devuelve costo robusto (Huber, δ = 2 px)
    let cost = 0;
    for (let i = 0; i < n; i++) {
      const X = world[i].x, Y = world[i].y;
      const a = R[0][0] * X + R[0][1] * Y + t[0], b = R[1][0] * X + R[1][1] * Y + t[1], c = R[2][0] * X + R[2][1] * Y + t[2];
      if (c <= 1e-6) return Infinity;
      const ru = fx * a / c + cx - screen[i].x, rv = fy * b / c + cy - screen[i].y;
      const e = Math.hypot(ru, rv); cost += e <= 2 ? e * e : 2 * 2 * (2 * e / 2 - 1);
      if (out) { out[i * 5] = ru; out[i * 5 + 1] = rv; out[i * 5 + 2] = a; out[i * 5 + 3] = b; out[i * 5 + 4] = c; }
    }
    return cost;
  };
  const buf = new Float64Array(n * 5);
  let cost = residuals(R, t, buf), lambda = 1e-3;
  if (!Number.isFinite(cost)) return null;
  for (let it = 0; it < iters; it++) {
    const H = Array.from({ length: 6 }, () => new Float64Array(6)), g = new Float64Array(6);
    for (let i = 0; i < n; i++) {
      const ru = buf[i * 5], rv = buf[i * 5 + 1], a = buf[i * 5 + 2], b = buf[i * 5 + 3], c = buf[i * 5 + 4];
      const e = Math.hypot(ru, rv), w = e <= 2 ? 1 : 2 / e;
      const X = world[i].x, Y = world[i].y;
      const p0 = R[0][0] * X + R[0][1] * Y, p1 = R[1][0] * X + R[1][1] * Y, p2 = R[2][0] * X + R[2][1] * Y;   // R·X
      // d(cámara)/d(δω) = −[R·X]×, d(cámara)/d(δt) = I
      const dC = [[0, p2, -p1, 1, 0, 0], [-p2, 0, p0, 0, 1, 0], [p1, -p0, 0, 0, 0, 1]];
      const ju = new Float64Array(6), jv = new Float64Array(6);
      for (let k = 0; k < 6; k++) {
        ju[k] = fx * (dC[0][k] / c - a * dC[2][k] / (c * c));
        jv[k] = fy * (dC[1][k] / c - b * dC[2][k] / (c * c));
      }
      for (let r = 0; r < 6; r++) {
        g[r] += w * (ju[r] * ru + jv[r] * rv);
        for (let s = r; s < 6; s++) H[r][s] += w * (ju[r] * ju[s] + jv[r] * jv[s]);
      }
    }
    for (let r = 0; r < 6; r++) for (let s = 0; s < r; s++) H[r][s] = H[s][r];
    let improved = false;
    for (let tries = 0; tries < 5 && !improved; tries++) {
      const A = H.map((row, r) => { const x = Float64Array.from(row); x[r] *= 1 + lambda; return x; });
      const d = solve6(A, g.map(v => -v)); if (!d) { lambda *= 10; continue; }
      const Rn = mulR(rodrigues(d[0], d[1], d[2]), R), tn = [t[0] + d[3], t[1] + d[4], t[2] + d[5]];
      const buf2 = new Float64Array(n * 5), c2 = residuals(Rn, tn, buf2);
      if (c2 < cost) { R = Rn; t = tn; cost = c2; buf.set(buf2); lambda = Math.max(1e-7, lambda / 10); improved = true;
        if (Math.hypot(d[0], d[1], d[2]) < 1e-7 && Math.hypot(d[3], d[4], d[5]) < 1e-5 * Math.hypot(t[0], t[1], t[2])) it = iters; }
      else lambda *= 10;
    }
    if (!improved) break;
  }
  return [[R[0][0], R[0][1], R[0][2], t[0]], [R[1][0], R[1][1], R[1][2], t[1]], [R[2][0], R[2][1], R[2][2], t[2]]];
}
function rodrigues(x, y, z) {
  const th = Math.hypot(x, y, z); if (th < 1e-12) return [[1, -z, y], [z, 1, -x], [-y, x, 1]];
  const kx = x / th, ky = y / th, kz = z / th, c = Math.cos(th), s = Math.sin(th), v = 1 - c;
  return [[c + kx * kx * v, kx * ky * v - kz * s, kx * kz * v + ky * s], [ky * kx * v + kz * s, c + ky * ky * v, ky * kz * v - kx * s], [kz * kx * v - ky * s, kz * ky * v + kx * s, c + kz * kz * v]];
}
function inv3T(M) {   // (M⁻¹)ᵀ
  const [[a, b, c], [d, e, f], [g, h, i]] = M;
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g, det = a * A + b * B + c * C;
  if (Math.abs(det) < 1e-12) return null;
  return [[A / det, B / det, C / det], [-(b * i - c * h) / det, (a * i - c * g) / det, -(a * h - b * g) / det], [(b * f - c * e) / det, -(a * f - c * d) / det, (a * e - b * d) / det]];
}
function mulR(A, B) { return A.map((r) => [0, 1, 2].map((j) => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j])); }
function solve6(A, b) {   // eliminación gaussiana con pivoteo
  const n = 6, M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-12) return null; [M[c], M[p]] = [M[p], M[c]];
    for (let r = c + 1; r < n; r++) { const f = M[r][c] / M[c][c]; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
  }
  const x = new Float64Array(n);
  for (let r = n - 1; r >= 0; r--) { let s = M[r][n]; for (let k = r + 1; k < n; k++) s -= M[r][k] * x[k]; x[r] = s / M[r][r]; }
  return x;
}

/* Engancha el refinador al controlador de MindAR (llamar después de mindar.start()).
   Si la versión de MindAR no expone lo necesario, no hace nada y todo sigue igual. */
let refinerOn = false;
export function attachPoseRefiner(mindar) {
  const ctrl = mindar && mindar.controller;
  if (QS.get('refinar') === '0' || !ctrl || typeof ctrl._trackAndUpdate !== 'function' || typeof ctrl._workerTrackUpdate !== 'function' || !ctrl.tracker) return false;
  ctrl._trackAndUpdate = async function (inputT, lastModelViewTransform, targetIndex) {
    const { worldCoords, screenCoords } = this.tracker.track(inputT, lastModelViewTransform, targetIndex);
    if (worldCoords.length < 4) return null;
    const mvt = await this._workerTrackUpdate(lastModelViewTransform, { worldCoords, screenCoords });
    if (!mvt) return mvt;
    try { return refinePose(mvt, worldCoords, screenCoords, this.projectionTransform) || mvt; } catch (e) { return mvt; }
  };
  refinerOn = true;
  return true;
}
