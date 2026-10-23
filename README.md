# Alas pa' volar 3D · Frida AR

Versión 3D de la experiencia WebAR para la ilustración de **Frida Kahlo por Federico Chilian Espinosa**.
Compárala con la versión 2D: https://frida-alas-ar.vercel.app

> "Pies, ¿para qué los quiero si tengo alas pa' volar?" — Frida Kahlo, Diario, 1953

## Qué cambia frente a la 2D
- **Despliegue:** al reconocer la ilustración, el estampado pasa de plano a 3D en 1.6 s.
- **Relieve:** la figura es una malla desplazada por un mapa de profundidad (`assets/profundidad.png`). La cara, la corona y las manos salen hacia quien mira.
- **Fondo como ventana:** el fondo se reconstruyó sin la figura y queda *detrás* de la playera, disuelto en una nube de orillas orgánicas.
- **Sin cuadro:** una cubierta del color de la tela oculta el rectángulo impreso. En modo *Auto* el color se toma de la cámara, alrededor del estampado; también se puede elegir a mano.
- **Elementos 3D:** braille como esferas doradas en relieve, letra dorada que se despega y flota, alas de monarca con bisagra que aletean en 3D, mariposas que orbitan alrededor de Frida, pétalos y polvo dorado con profundidad.

## Archivos
| Archivo | Qué es |
|---|---|
| `index.html` | Pantallas, guía de escaneo, selector de tela, subtítulo |
| `app.js` | Modo AR (MindAR), demo 3D sin cámara, muestreo del color de la tela, sonido |
| `scene.js` | La escena 3D completa y su línea de tiempo |
| `assets/target.webp` | Ilustración original (marcador de seguimiento) |
| `assets/figura.webp` | Figura recortada con transparencia |
| `assets/fondo.webp` | Fondo reconstruido sin la figura |
| `assets/profundidad.png` | Mapa de profundidad (blanco = más cerca) |

Demo sin cámara: botón "Ver en 3D sin cámara" o agrega `#preview` al link. Se puede arrastrar para girar.

## Con los archivos editables
Con el PSD o los PNG por capas se reemplazan `figura.webp` y `fondo.webp` por capas limpias y se ajusta `profundidad.png` por elemento. Así desaparecen los bordes de recorte y el relleno aproximado del fondo.

Sitio estático: no requiere build.

## Prueba: figura 3D por código (`modelo.html`)
Frida como figura de bulto sobre una base de talavera poblana, modelada por código (sin IA ni créditos):
- El volumen se "infla" desde la silueta del dibujo (`assets/modelo/altura_frente.png` y `altura_espalda.png`); la cabeza, la cara y la corona tienen su propio volumen.
- El frente usa la ilustración original; la espalda es una interpretación (trenzas en chongo y rebozo) en `assets/modelo/espalda.webp`.
- Acabado de resina laqueada; alas de monarca opcionales con aleteo.
- Botones: Girar, Frente, Perfil, Espalda, Alas. Se puede arrastrar para rodearla.

## Prueba: figura 3D con IA (`modelo-ia.html`)
Modelo generado con **Tripo H3.1 vía Higgsfield** (9 créditos, calidad estándar, textura + PBR) desde `assets/modelo/entrada-ia.png`.
El archivo GLB vive en el CDN de Higgsfield; `vercel.json` lo sirve en `/assets/modelo/frida-ia.glb` para que cargue desde el mismo dominio.
Si en algún momento ese enlace deja de funcionar, descarga el GLB desde Higgsfield y guárdalo en `assets/modelo/frida-ia.glb` (el visor lo prefiere).
