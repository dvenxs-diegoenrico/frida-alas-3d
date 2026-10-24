"""Genera video sintético de la ilustración impresa en una playera, visto por un celular en mano.
Salida: <out>/f_XXXX.jpg (solo los cuadros que el rastreador procesa) y <out>/gt.json
gt.json: camera (W,H), video (30 Hz) matrices de verdad por cuadro, horario del rastreador.
Convención de matrices: igual que anchor.group.matrix de MindAR-three (columna mayor, 16 números):
espacio del ancla = centro de la ilustración, ancho = 1, x derecha, y arriba, z hacia la cámara.
"""
import sys, json, math, os
import numpy as np, cv2

out, seed, scen = sys.argv[1], int(sys.argv[2]), sys.argv[3]
W, H = (int(v) for v in (sys.argv[4] if len(sys.argv) > 4 else '720x1280').split('x'))
os.makedirs(out, exist_ok=True)
rng = np.random.default_rng(seed)

TGT = cv2.imread(sys.argv[5] if len(sys.argv) > 5 else '/home/claude/frida-alas-3d/assets/target.webp', cv2.IMREAD_COLOR)
TH, TW = TGT.shape[:2]
A = TH / TW
F = (H / 2) / math.tan(math.radians(22.5))  # igual que MindAR: fovy 45° sobre el alto de entrada
SS = 2                                       # supermuestreo

DUR = {'tripode': 8.0, 'quieto': 8.0, 'lento': 10.0, 'rapido': 7.0, 'acercar': 8.0}[scen]

# --- temblor de mano: suma de senos 6-12 Hz + deriva lenta (ruido 1/f aproximado) ---
def tremor_fn(amp_deg, n=6):
    fr = rng.uniform(5, 12, (3, n)); ph = rng.uniform(0, 2 * math.pi, (3, n)); am = rng.uniform(.5, 1, (3, n))
    am = am / am.sum(1, keepdims=True) * math.radians(amp_deg)
    dfr = rng.uniform(.1, .6, (3, 3)); dph = rng.uniform(0, 2 * math.pi, (3, 3))
    def f(t):
        tr = (am * np.sin(2 * math.pi * fr * t + ph)).sum(1)
        dr = (np.sin(2 * math.pi * dfr * t + dph)).sum(1) * math.radians(amp_deg) * 2.5
        return tr + dr
    return f
trem = tremor_fn(0.012 if scen == 'tripode' else 0.12)
tpos_f = rng.uniform(.2, .9, 3); tpos_p = rng.uniform(0, 6.28, 3)

base_d = rng.uniform(3.9, 4.6)
yaw0 = rng.uniform(-.15, .15); pitch0 = rng.uniform(-.12, .08); roll0 = rng.uniform(-.08, .08)

def smooth_cycle(t, period):  # 0..1..0 suave
    return .5 - .5 * math.cos(2 * math.pi * t / period)

def cam_params(t):
    yaw, pitch, d, roll, lx, ly = yaw0, pitch0, base_d, roll0, 0.0, 0.0
    if scen == 'lento':
        yaw = -0.6 + 1.2 * smooth_cycle(t, 10.0) + yaw0 * .3      # ±34°, ~0.37 rad/s pico
    elif scen == 'rapido':
        yaw = 0.7 * math.sin(2 * math.pi * t / 3.5)               # ±40°, ~1.25 rad/s pico
        pitch = pitch0 + 0.15 * math.sin(2 * math.pi * t / 5.0)
    elif scen == 'acercar':
        d = 3.3 + 2.6 * smooth_cycle(t, 8.0)
        yaw = yaw0 + 0.25 * math.sin(2 * math.pi * t / 6.0)
    # deriva lenta de a dónde apunta la mano
    dr = 0.1 if scen == 'tripode' else 1.0
    lx = dr * 0.04 * math.sin(2 * math.pi * .23 * t + tpos_p[0]); ly = dr * 0.04 * math.sin(2 * math.pi * .17 * t + tpos_p[1])
    return yaw, pitch, d, roll, lx, ly

def rot(axis, a):
    c, s = math.cos(a), math.sin(a)
    if axis == 'x': return np.array([[1, 0, 0], [0, c, -s], [0, s, c]])
    if axis == 'y': return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])
    return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])

def anchor_to_cam(t):
    yaw, pitch, d, roll, lx, ly = cam_params(t)
    C = np.array([d * math.sin(yaw) * math.cos(pitch), d * math.sin(pitch), d * math.cos(yaw) * math.cos(pitch)])
    C += (0.0006 if scen == 'tripode' else 0.006) * np.sin(2 * math.pi * tpos_f * t + tpos_p)          # pequeña deriva de la mano (≈1.5 mm)
    L = np.array([lx, ly, 0.0])
    z = C - L; z /= np.linalg.norm(z)
    x = np.cross([0, 1, 0], z); x /= np.linalg.norm(x); y = np.cross(z, x)
    R = np.stack([x, y, z], 1) @ rot('z', roll)
    tr = trem(t); R = R @ rot('x', tr[0]) @ rot('y', tr[1]) @ rot('z', tr[2] * .5)
    M = np.eye(4); M[:3, :3] = R.T; M[:3, 3] = -R.T @ C
    return M

def project(M, P):  # P: Nx3 en espacio del ancla -> px de entrada
    Pc = (M[:3, :3] @ P.T).T + M[:3, 3]
    return np.stack([W / 2 + F * Pc[:, 0] / -Pc[:, 2], H / 2 - F * Pc[:, 1] / -Pc[:, 2]], 1)

# --- tela de fondo (playera negra con tejido) ---
def fabric(w, h):
    g = rng.normal(0, 1, (h // 4 + 2, w // 4 + 2)).astype(np.float32)
    g = cv2.resize(cv2.GaussianBlur(g, (0, 0), 3), (w, h))
    yy, xx = np.mgrid[0:h, 0:w]
    weave = (np.sin(xx * 1.7) * np.sin(yy * 1.7)) * 2.0
    base = 28 + 10 * g + weave
    return np.clip(np.stack([base * .95, base * .97, base * 1.05], -1), 0, 255).astype(np.uint8)
BG = fabric(W * SS + 400, H * SS + 400)

corners_t = np.float32([[0, 0], [TW, 0], [TW, TH], [0, TH]])
corners_a = np.array([[-.5, A / 2, 0], [.5, A / 2, 0], [.5, -A / 2, 0], [-.5, -A / 2, 0]])

def render(t, M, M_prev):
    pts = project(M, corners_a) * SS
    Hm = cv2.getPerspectiveTransform(corners_t, np.float32(pts))
    ox, oy = int(40 * math.sin(t * .7)) + 200, int(40 * math.cos(t * .5)) + 200   # la tela se mueve con la imagen aprox.
    img = BG[oy:oy + H * SS, ox:ox + W * SS].copy()
    warped = cv2.warpPerspective(TGT, Hm, (W * SS, H * SS), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT)
    mask = cv2.warpPerspective(np.full((TH, TW), 255, np.uint8), Hm, (W * SS, H * SS))
    m = (mask.astype(np.float32) / 255)[..., None]
    img = (img * (1 - m) + warped * m).astype(np.float32)
    img = cv2.resize(img, (W, H), interpolation=cv2.INTER_AREA)
    # desenfoque por movimiento (exposición ~8 ms) a partir del movimiento del centro
    c1 = project(M, np.array([[0, 0, 0.]]))[0]; c0 = project(M_prev, np.array([[0, 0, 0.]]))[0]
    v = (c1 - c0) * (0.008 / (1 / 30))
    L = float(np.hypot(*v))
    if L > 0.7:
        k = int(math.ceil(L)) | 1; ker = np.zeros((k, k), np.float32)
        cv2.line(ker, (int(k / 2 - v[0] / 2), int(k / 2 - v[1] / 2)), (int(k / 2 + v[0] / 2), int(k / 2 + v[1] / 2)), 1, 1)
        ker /= max(ker.sum(), 1e-6); img = cv2.filter2D(img, -1, ker)
    img = cv2.GaussianBlur(img, (0, 0), 0.7)                          # enfoque imperfecto
    img *= rng.uniform(.97, 1.03)                                       # exposición automática
    img += rng.normal(0, 3.0, img.shape)                                # ruido del sensor
    yy, xx = np.mgrid[0:H, 0:W]; vig = 1 - .25 * (((xx - W / 2) / W) ** 2 + ((yy - H / 2) / H) ** 2) * 2
    img *= vig[..., None]
    return np.clip(img, 0, 255).astype(np.uint8)

# --- horario: video a 30 Hz; el rastreador toma el último cuadro, procesa 30–55 ms, espera el siguiente rAF ---
VID = 1 / 30; RAF = 1 / 60
PMIN, PMAX = (float(v) / 1000 for v in os.environ.get('PROC', '30-55').split('-'))
nvid = int(DUR / VID) + 2
video = [anchor_to_cam(i * VID) for i in range(nvid)]
sched = []; s = 0.0
while True:
    c = int(math.floor(s / VID + 1e-9))
    if c >= nvid - 1: break
    P = rng.uniform(PMIN, PMAX); r = s + P
    sched.append({'s': s, 'c': c, 'r': r})
    s = math.ceil(r / RAF - 1e-9) * RAF

def colmajor(M):  # three.js Matrix4.elements
    return [float(v) for v in M.T.reshape(-1)]

done = set()
todo = [{'c': c} for c in range(nvid)] if os.environ.get('ALL') else sched
for k, e in enumerate(todo):
    c = e['c']
    if c in done: continue
    done.add(c)
    img = render(c * VID, video[c], video[max(0, c - 1)])
    cv2.imwrite(f'{out}/f_{c:04d}.jpg', img, [cv2.IMWRITE_JPEG_QUALITY, 82])

json.dump({'W': W, 'H': H, 'F': F, 'dur': DUR, 'scen': scen, 'seed': seed, 'vid': VID,
           'video': [colmajor(M) for M in video], 'sched': sched}, open(f'{out}/gt.json', 'w'))
print(out, len(sched), 'muestras', len(done), 'cuadros')
