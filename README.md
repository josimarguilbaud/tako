# Tako

**Quién lo vio, y cuándo.**

Un colaborador sale de un hospital y cuenta lo que vio. Tako lo convierte en datos
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

Hace falta **Node 20 o superior** (medido en v24) y unos **10 GB** libres.

```bash
npm install          # los binarios de QVAC: 5,5 GB, una sola vez
npm run pruebas      # 168 pruebas sin modelo: confirma que el árbol quedó bien
npm start            # y abrir http://localhost:3210
```

El primer arranque descarga los modelos del registro de QVAC (4,3 GB) y necesita internet
**esa vez**. Después funciona sin conexión, que es el punto. Los modelos viven en
`~/.qvac/models` y **se comparten entre proyectos**: si ya instalaste Alcancía, aquí no se
vuelven a bajar.

Variantes:

```
QMODEL=4b node servidor.mjs    # solo Qwen3 4B: más lento, más fiable
QMODEL=1.7b node servidor.mjs  # solo Qwen3 1.7B, sin reintento
QVOZ=base node servidor.mjs    # Whisper base (82 MB): más rápido, peor con español hablado
HOST=0.0.0.0 node servidor.mjs # abrir a la red local (sin micrófono: eso exige HTTPS)
```

También valen como banderas, que es lo cómodo en PowerShell:
`node servidor.mjs --qmodel=4b`.

El laboratorio arranca con **una** observación de ejemplo: la que levantó la gente de este
equipo. El conflicto no viene servido, aparece al fundir el libro de otro equipo (ver
[Dos libros se hacen uno](#dos-libros-se-hacen-uno)). Se borra con el botón de abajo del
todo.

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

```bash
npm run pruebas          # 168 pruebas deterministas, sin modelo, en milisegundos
npm run pruebas-modelo   # 13 casos con Qwen3 + 4 placas con VisionPsy (~4 min)
```

`npm run pruebas` es lo primero que conviene correr después de instalar: no carga ni un
modelo, así que dice si el árbol quedó bien sin esperar a que se descarguen 4 GB. Por
separado:

```bash
node prueba-cantidades.mjs     # 24 pruebas de la capa de texto
node prueba-placa-campos.mjs   # 21 pruebas de la capa de la placa
node prueba-tecnicos.mjs       # 74 del PIN, el contraste y el panel
node prueba-libro.mjs          # 49 de fundir dos libros
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
repartiendo y atribuyendo. Tako no les pide que se porten bien: les quita el trabajo que
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

## Dos libros se hacen uno

Correr **dentro** del dispositivo no es lo mismo que ser **descentralizado**, y durante un
tiempo Tako solo cumplía lo primero. Lo que veía Marta se quedaba en la tablet de Marta y
lo de Luis en la suya. El desacuerdo entre dos personas, que es lo único que Tako hace y
nadie más hace, solo aparecía cuando las dos observaciones habían nacido en el mismo
equipo. En campo no se habrían encontrado nunca.

Un libro se **exporta a un archivo**, el archivo viaja como quiera (USB, correo, el chat
que sea) y el otro equipo lo **funde** con el suyo. Sin servidor en medio y sin nube.

Las reglas de la fusión están en [`libro.mjs`](libro.mjs) y son cuatro:

- **La identidad de una observación es su contenido, no su número.** `OBS-003` en una
  tablet y `OBS-003` en otra son cosas distintas, así que la identidad es
  `sha256(quién + cuándo + lo dicho + lo extraído)`. La etiqueta `OBS-NNN` es **derivada**:
  se recalcula por fecha cada vez que el libro se escribe, así que después de fundir se
  lee 001, 002, 003… sin huecos ni repetidas, y nadie tiene que fiarse de la numeración
  ajena.
- **Fundir es unir, nunca sustituir.** Ninguna observación se modifica y ninguna se
  descarta. Da igual el orden en que lleguen los libros, da igual quién funde a quién, y
  fundir dos veces el mismo archivo no duplica nada.
- **El desacuerdo se conserva.** Es la razón de fundir, así que el informe lo dice con
  nombre y número en vez de dejarlo enterrado en una tabla.
- **El sello dice que el libro llegó entero, no quién lo escribió.** Es integridad, no
  autoría: detecta un archivo cortado o editado por el camino. Firmar cada observación de
  forma que se pueda probar la autoría es otra cosa y **todavía no está hecha**. Se dice
  aquí porque el argumento de esta app es saber de dónde salió cada número.

Al fundir, el informe queda así:

```
Fundido, y aparecieron desacuerdos
Viene de Luis Ortega, exportado el 10 de septiembre de 2026 a las 01:30 p. m.

  2  observaciones nuevas entraron al libro
  0  ya las tenías
  3  en total ahora

  1 DESACUERDO QUE NO EXISTÍA
  Hospital DemoCare Pacific · MR: Marta Gómez dice 2 y Luis Ortega dice 3
  Nadie elige por ellos. Quedan los dos números, con nombre y fecha,
  hasta que alguien vaya a contar.
```

### Probarlo

El laboratorio arranca con **una** observación: la que levantó la gente de este equipo.
Antes arrancaba con dos que no coincidían entre sí, y eso era hacer trampa con la propia
tesis: en campo las dos personas no comparten tablet, así que el desacuerdo **no puede
estar servido** al abrir la app.

Para verlo aparecer hay dos caminos. El corto, con el libro que viene en el repositorio:

> **Fundir un libro** &rarr; elige `datos-ejemplo/libro-de-luis.json`

Y el largo, que es el de verdad: **levantar un segundo equipo** en la misma máquina, con
su propio libro y su propio padrón.

```bash
node servidor.mjs --puerto=3211 --datos=datos-equipo-2 --qmodel=1.7b
```

Ese segundo Tako no comparte nada con el primero. Capturas algo ahí, exportas su libro,
lo fundes en el primero y el desacuerdo aparece. Las banderas también valen como variables
de entorno (`PUERTO`, `DATOS`, `QMODEL`, `QVOZ`) para quien use bash; van como banderas
porque en PowerShell `DATOS=x node servidor.mjs` no hace lo que parece.

## Quién lo vio

El lema promete dos cosas y durante un tiempo solo cumplió una. El «cuándo» siempre fue la
fecha del sistema; el «quién» era un campo de texto con `Field User 01` ya escrito dentro,
o sea nadie. Un dato que no sabe de quién viene no se puede repreguntar, y el Cliente 360
entero se apoya en poder decir *quién* dijo qué.

**Ahora se entra con un PIN.** El padrón de técnicos vive en `datos/tecnicos.json` y cada
uno tiene su propia sal; lo que se guarda es `sha256(sal + pin)`, nunca el PIN. La
comprobación es en el dispositivo, con `node:crypto`, sin una sola llamada de red. Tras
tres fallos seguidos la espera sube a 5 s, 15 s, 60 s y 5 min: diez mil combinaciones a
mano no se prueban, con un script sí.

Hay que decir qué **no** es: un PIN de cuatro dígitos no es el directorio corporativo de
Philips. En un despliegue real esto lo firma el SSO de la empresa. Es la prueba más fuerte
que se puede dar sin salir del equipo, y el sistema no aparenta más de lo que tiene:

- Quien venía en el padrón sale como **del padrón**; quien se registró en la tablet sale
  como **alta local**. No son la misma garantía y el panel no las pinta igual.
- Las observaciones guardadas antes, con el nombre a mano, siguen ahí y salen marcadas
  **sin verificar**. No se borran ni se disimulan.
- El observador lo pone el **servidor desde la sesión**, nunca el cuerpo de la petición. Si
  viniera en el cuerpo, firmar con el nombre de otro sería teclearlo.

**Y qué recibe el técnico a cambio.** Un formulario solo le quita tiempo; esto le devuelve
lo que la cuenta ya sabe. Antes de guardar, Tako mira si otra persona puso otro número en
ese mismo hospital y esa misma modalidad, y se lo dice **mientras todavía está ahí y puede
ir a contar**:

```
Alguien ya contó aquí, y no da lo mismo
MR                                        tú dices 3
Marta Gómez dijo 2 · 3 de septiembre · OBS-001
«Dos resonadores y un tomógrafo.»
      [Volver a revisar]   [Guardar así]
```

Si decide guardar igual, queda escrito en la observación que se guardó con un desacuerdo
abierto, con quién y con qué números. El desacuerdo no se resuelve solo: se fecha. Es la
misma regla que el Cliente 360 aplica desde el principio.

El panel **Quién lo vio** cierra el círculo: cuántas observaciones levantó cada quien, en
cuántos hospitales, cuándo fue la última y en cuántas pugnas está metido. Todos esos
números salen de las observaciones guardadas, no de un contador aparte: cualquiera se
puede seguir hasta una observación con su id.

### La cuadrilla de ejemplo

Esto es un laboratorio, así que los PIN son públicos y están escritos en la propia pantalla
de entrada:

| Técnico | Zona | PIN |
|---|---|---|
| `T-01` Marta Gómez | Panamá y Chiriquí | `2468` |
| `T-02` Luis Ortega | Panamá Oeste y Colón | `1357` |
| `T-03` Ana Ruiz | Azuero y Veraguas | `9024` |

Marta firma la observación con la que arranca este equipo; Luis firma las dos que trae
`datos-ejemplo/libro-de-luis.json`, y por eso el desacuerdo aparece al fundir y no antes.
Ana arranca en cero: un técnico sin actividad es justo el dato que un gerente de cuentas
quiere ver. Con «No estoy en la lista» te das de alta en el equipo.

## Qué hay

| Archivo | Qué hace |
|---|---|
| `servidor.mjs` + `index.html` | El laboratorio: micrófono o texto, foto de la placa, resultado verificado, guardar, y Cliente 360 con conflictos y rastro |
| `verificar.mjs` | La verificación determinista contra la frase |
| `extraer.mjs` | Esquema, prompt, extracción y la lógica de repregunta (hoja «Agent Question Logic» de Philips) |
| `placa.mjs` | La lectura de la placa con VisionPsy y el parseo de sus campos |
| `clientes.mjs` + `clientes.json` | Emparejar el nombre dicho con la lista de clientes, tolerando erratas |
| `tecnicos.mjs` | El padrón, el PIN con sal, el contraste con lo que reportaron otros y la cobertura del panel |
| `libro.mjs` | La identidad por contenido, el sello, y las reglas de fundir dos libros sin perder nada |
| `placas/generar.mjs` | Genera las placas sintéticas de prueba con su verdad conocida |
| `datos-ejemplo/` | La observación y la cuadrilla con las que arranca el laboratorio, y el libro de Luis para probar la fusión |

## Licencia

MIT. Ver [LICENSE](LICENSE).
