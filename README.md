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
El GLB original (45.7 MB, 1.47 M triángulos) se optimizó con gltfpack a `assets/modelo/frida-3d.glb`:
~103 mil triángulos, texturas a 1024 px y compresión meshopt (0.96 MB). Requiere `MeshoptDecoder` en el `GLTFLoader`.

## Experiencia AR con Frida en bulto (por defecto en `index.html`)
- Al escanear, la ilustración plana se **infla hasta un bulto 3D completo** que sale de la playera hacia quien mira.
- Como el modelo tiene volumen real, **al moverte a los lados ves a Frida de perfil**, y en ángulos extremos, su espalda (chongo de trenzas y rebozo).
- La orilla inferior del modelo (fondo blanco de la imagen de entrada) se disuelve en polvo dorado con un shader.
- Se mantienen las alas de monarca 3D, mariposas en órbita (más amplia, para rodear el bulto), braille en relieve, letra dorada, pétalos, polvo dorado y el fondo disuelto en el color de la tela.
- `?figura=relieve` usa la versión anterior en relieve (sin modelo).
