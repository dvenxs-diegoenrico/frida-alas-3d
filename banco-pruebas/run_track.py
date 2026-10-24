"""Corre el rastreador real de MindAR sobre carpetas de cuadros. Uso: run_track.py runs/a runs/b ..."""
import sys, json, base64, os
from playwright.sync_api import sync_playwright
BASE = 'http://localhost:8775/bench/'
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
                          args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    pg = b.new_page()
    pg.on('pageerror', lambda e: print('PAGEERR', e))
    pg.goto(BASE + 'track.html')
    for _ in range(100):
        if pg.evaluate('!!window.__ready'): break
        pg.wait_for_timeout(200)
    pg.set_default_timeout(0)
    for d in sys.argv[1:]:
        pg.evaluate('window.__keepPts = %s; window.__pts = []; window.__refine = %s' % ('true' if os.environ.get('PTS') else 'false', 'true' if os.environ.get('REFINE') else 'false'))
        r = pg.evaluate('(d) => window.runTrack(d)', d)
        if os.environ.get('PTS'): json.dump(pg.evaluate('window.__pts'), open(d + '/pts.json', 'w'))
        m = pg.evaluate('window.__mind || null')
        if m and not os.path.exists('targets.mind'):
            open('targets.mind', 'wb').write(base64.b64decode(m)); print('targets.mind guardado')
        json.dump(r, open(d + '/' + os.environ.get('OUT', 'raw.json'), 'w'))
        lost = sum(1 for x in r['raw'] if x is None)
        print(d, 'muestras', len(r['raw']), 'sin pose', lost, 'tiempo %.1fs' % (r['ms'] / 1000), 'track %.0f ms' % r['trackMs'], 'dims', r['dims'])
    b.close()
