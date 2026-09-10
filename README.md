# Consta

**Que conste quién lo vio.**

Un colaborador sale de un hospital y cuenta lo que vio. Consta lo convierte en datos
estructurados de la base instalada —cuántos equipos, de qué marca, de qué año— y guarda
**quién lo observó, cuándo y cuántas personas lo confirmaron por separado**. Todo corre en
el dispositivo. Nada sale de la máquina.

Presentado al **Decentralized AI Hackathon** (Panamá, 9–11 de septiembre de 2026), al reto
corporativo de Philips «Customer Installed Base Intelligence», al reto de Tether «QVAC Psy»
y al desafío general.

---

## Declaración de base preexistente

**Este proyecto parte de una base construida el 8 de septiembre de 2026, antes de que
empezara el hackathon.** Se declara aquí de forma expresa, como exigen las bases.

Lo que ya existía al arrancar el hackathon:

- La captura por voz con Whisper y la extracción a JSON con Qwen3 vía QVAC.
- La verificación contra la transcripción de edades, marcas, modelos, lugares y hospital.
- El emparejador de clientes y la lógica de repregunta.
- El Cliente 360 con conflictos por observador, y el arnés con las diez pruebas de Philips.

Lo construido **durante** el hackathon (9–11 de septiembre) está en el historial de git a
partir del primer commit, y en resumen es:

- Las cantidades, el reparto por edad y los calificativos pasan a código determinista. El
  arnés dejó de medir un prompt distinto al que corría la app. De 11/13 a **13/13**.
- La lectura de la placa del equipo por foto con **VisionPsy-Nano-460M**, con su propio
  banco de pruebas y su registro de rendimiento.

---

## Requisito técnico: toda la inferencia en el dispositivo

No hay ninguna llamada a una API de inferencia en la nube. Los modelos se descargan
una vez desde el registro de QVAC y a partir de ahí el sistema funciona sin conexión.

| Papel | Archivo del modelo | Cuantización | Tamaño |
|---|---|---|---|
| Voz → texto | `ggml-small-q8_0.bin` | q8_0 | 264 MB |
| Texto → JSON | `Qwen3-1.7B-Q4_0.gguf` | q4_0 | 1,1 GB |
| Texto → JSON (reintento) | `Qwen3-4B-Q4_K_M.gguf` | q4_K_M | 2,5 GB |
| Foto de la placa → texto | `visionpsy-nano-460m-q4_k_m-imat.gguf` | q4_k_m | 303 MB |
| Proyector multimodal de la anterior | `mmproj-visionpsy-nano-460m-q8.gguf` | q8_0 | 109 MB |

VisionPsy es uno de los modelos **Psy** oficiales de QVAC, y tiene papel central en el flujo:
es lo único que puede dar la marca, el modelo y la fecha de fabricación de un equipo, que
son justo los datos que la voz nunca da.

Todo pasa por `@qvac/sdk`. No se usa ninguna API remota, ni para inferencia ni para nada más.

### Hardware en el que están medidos los números de abajo

- AMD Ryzen 5 5600G, 6 núcleos / 12 hilos, con gráficos Radeon **integrados**
- 31 GB de RAM
- Windows 11 Pro · Node v24.18.0
- QVAC informa `backendDevice: "gpu"`, es decir la GPU integrada del propio procesador.
  No hay tarjeta gráfica dedicada: es deliberado, porque el escenario real es un teléfono
  o un portátil de campo, no una estación de trabajo.

---

## Correr

```
npm install          # baja los binarios de QVAC (~6 GB, una sola vez)
node servidor.mjs    # y abrir http://localhost:3210
```

La primera vez descarga los modelos del registro de QVAC; necesita internet **una vez**.
Después funciona sin conexión.

Variantes:

```
QMODEL=4b node servidor.mjs    # solo Qwen3 4B: más lento, más fiable
QMODEL=1.7b node servidor.mjs  # solo Qwen3 1.7B, sin reintento
QVOZ=base node servidor.mjs    # Whisper base (82 MB): más rápido, peor con español hablado
HOST=0.0.0.0 node servidor.mjs # abrir a la red local (sin micrófono: eso exige HTTPS)
```

En PowerShell las variables van aparte: `$env:QMODEL = "4b"; node servidor.mjs`.

El laboratorio arranca con dos observaciones de ejemplo que **no coinciden** en la cantidad
de resonadores, para que el Cliente 360 muestre un conflicto desde el primer momento. Se
borran con el botón de abajo del todo.

---

## Si no arranca

**«RPC initialization timed out» en Windows.** No es un fallo de esta app: es Windows
bloqueando los binarios de QVAC, que no van firmados. Smart App Control y la protección
de reputación los matan en silencio y lo único que se ve es el timeout. Hay que
permitirlos en Seguridad de Windows, o desactivar Smart App Control mientras se prueba.
Para ver la causa real en vez del timeout, lanzar el proceso de QVAC a mano con `bare`.

**Se instaló una versión distinta del SDK.** El `package.json` fija `@qvac/sdk` a
`^0.18.2`, que es con la que están medidos todos los números de este README. Las
versiones 1.x traen otro `@qvac/fabric` y otro árbol de dependencias, y no están
probadas aquí. Si `npm install` trajo otra cosa, borrar `node_modules` y
`package-lock.json` y repetir.

**La primera vez tarda mucho.** `npm install` baja unos 6 GB entre binarios y modelos, y
el primer arranque los carga en memoria. A partir de ahí es rápido.

**Node.** Medido en v24. Hace falta 20 o superior.

## Pruebas

```
node prueba-cantidades.mjs     # 24 pruebas de la capa de texto, sin modelo
node prueba-placa-campos.mjs   # 21 pruebas de la capa de la placa, sin modelo
node prueba-extraccion3.mjs    # 13 casos con Qwen3 1.7B (~2,5 min)
node prueba-placas.mjs         # 4 placas con VisionPsy (~1,5 min)
```

### Resultados medidos el 9 de septiembre de 2026

| Qué | Resultado | Detalle |
|---|---|---|
| Extracción de lo dictado | **13 / 13** | las diez pruebas oficiales de Philips, la del enunciado en español y dos grabaciones de voz reales |
| Tiempo por observación | **8,9 s** | media de los 13 casos · carga 19,3 s · TTFT 1,9 s · 21,2 tok/s · prompt de 499 tokens |
| Lectura de placas | **4 / 4** | tres corridas seguidas sin un solo campo mal, incluida una placa gastada con brillo y ruido |
| Tiempo por foto | **18,6 s** | dos pases · carga 5,1 s · TTFT 6,8 s · 52,5 tok/s · prompt de 893 tokens |
| Pruebas deterministas | **45** | sin cargar ningún modelo, en milisegundos |

`rendimiento/texto.json` y `rendimiento/placas.json` guardan el registro estructurado y
reproducible: modelo, archivo, cuantización, tiempo de carga, el prompt del sistema, y por
cada caso el TTFT, los tokens de prompt y de generación, el throughput y el dispositivo.
Los regeneran `node prueba-extraccion3.mjs` y `node prueba-placas.mjs`.

### Una nota honesta sobre la variabilidad

VisionPsy **no es determinista ni a temperatura 0**. En tres corridas del 9 de septiembre se
desvió de tres formas distintas: pegó la etiqueta al número de serie (`SERIAL NOGE-99213`),
metió una palabra de relleno junto a la marca (`GE brand`) y contestó como en un chat
(`The answer is…`). Las tres están cubiertas por pruebas deterministas con el texto exacto
que devolvió, y las tres las absorbe el código, no el prompt. Es justamente el motivo de que
el parseo no se le delegue al modelo.

---

## La idea: el modelo propone, el código comprueba

Los modelos que caben en un teléfono son buenos leyendo y nombrando, y malos contando,
repartiendo y atribuyendo. Consta no les pide que se porten bien: les quita el trabajo que
hacen mal.

`verificar.mjs` lee la propia frase y **impone** lo que dice:

- `cantidadesEn` — cuántas unidades hay de cada modalidad. «Dos resonadores» son dos, diga
  lo que diga el modelo. Se ignora el partitivo: «uno de los resonadores» no dice cuántos hay.
- `edadesEn` — qué número es una edad. Un número solo es edad si lo sigue la palabra año(s):
  «about six ultrasound units» no son seis años.
- `calificativosEn` — «very old», «mostly new», que muchas veces son el único dato de edad
  que hay en la frase.
- `partitivosEn` — «uno de los dos resonadores tiene ocho años» son dos filas, no una de dos
  unidades con la edad puesta a las dos. Philips quiere saber exactamente a cuál le falta.

Y descarta lo que no está: edades cuyo número no aparece, lugares no introducidos por
«en/in», marcas y modelos ausentes, hospitales inventados. Cada corrección y cada descarte
quedan escritos en el rastro que ve el usuario. «No inventar» no es una promesa del prompt:
es una propiedad del sistema.

## La foto de la placa

La voz casi nunca da marca ni modelo. La placa los lleva impresos y además trae la fecha de
fabricación, así que la antigüedad deja de ser una estimación y pasa a ser un dato.

Dos preguntas cortas a VisionPsy, no una larga: medido, «lee toda la placa» se come la
cabecera y pierde la marca en 3 de 4, o se come los valores de las filas. Una pregunta por
bloque acierta 4 de 4 en ambos. El modelo solo transcribe; los campos los saca el código, y
la marca se ancla a una lista de fabricantes con tolerancia a erratas, para que dos fotos de
la misma máquina no creen dos marcas.

**Una placa identifica una máquina, no un grupo.** Si la fila agrupa varias unidades, se
parte: la fotografiada se queda con la serie y la fecha, y las demás siguen sin marca ni
edad, así que el sistema las sigue preguntando.

## Qué hay

| Archivo | Qué hace |
|---|---|
| `servidor.mjs` + `index.html` | El laboratorio: micrófono o texto, foto de la placa, resultado verificado, guardar, y Cliente 360 con conflictos y rastro |
| `verificar.mjs` | La verificación determinista contra la frase |
| `extraer.mjs` | Esquema, prompt, extracción y la lógica de repregunta (hoja «Agent Question Logic» de Philips) |
| `placa.mjs` | La lectura de la placa con VisionPsy y el parseo de sus campos |
| `clientes.mjs` + `clientes.json` | Emparejar el nombre dicho con la lista de clientes, tolerando erratas |
| `placas/generar.mjs` | Genera las placas sintéticas de prueba con su verdad conocida |
| `datos-ejemplo/` | Las dos observaciones con las que arranca el laboratorio |

## Licencia

MIT. Ver [LICENSE](LICENSE).
