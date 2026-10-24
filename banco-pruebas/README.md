# Banco de pruebas del rastreo

Mide, con el **rastreador real de MindAR**, cuánto se mueve Frida respecto a la playera.

1. `gen_frames.py <carpeta> <semilla> <tripode|quieto|lento|rapido|acercar> [480x640]` genera el video
   sintético (ilustración impresa, pulso de mano, ruido, desenfoque, compresión) y la pose verdadera.
2. `run_track.py <carpetas…>` corre MindAR en Chromium (`track.html`) cuadro por cuadro.
   `REFINE=1 OUT=raw_ref.json` aplica el recálculo de pose como en la app.
3. `tune.mjs <estabilizador.js> '{params}' <carpetas…>` evalúa contra los umbrales;
   `approve.mjs <estabilizador.js> <semillas…>` da el veredicto por corrida (todas las escenas deben pasar).

Necesita junto a esta carpeta: `../three/build/three.module.js` (three r160) y `../mindar-dist/`
(el `dist/` de mind-ar-js, commit 60eb03b; su rastreo es idéntico al de 1.2.5), servidos en
`http://localhost:8775/`. `RAW=raw_ref.json` hace que la evaluación use las poses recalculadas.
