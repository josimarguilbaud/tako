# Prompt para generar la interfaz de Consta

Copia todo lo que hay debajo de la línea y pégalo en la herramienta.
Cuando te devuelva el HTML, pásamelo y yo lo cableo al motor.

**Ojo con una cosa antes de empezar:** el JavaScript de Consta ya está escrito y
funciona. Escribe HTML dentro de unos contenedores concretos usando unas clases
concretas. Por eso el prompt le exige unos `id` exactos y le pide estilar clases que no
va a ver en el HTML estático. Si eso no se respeta, hay que recablear la aplicación
entera y no compensa.

---

Necesito un **único archivo HTML autocontenido** para una aplicación llamada **Consta**.

## Qué es

Un ingeniero de servicio de Philips sale de visitar un hospital y cuenta lo que vio:
cuántos resonadores y tomógrafos tiene, de qué marca, de qué año. Puede **dictarlo** o
**fotografiar la chapa de identificación** del equipo. Todo se procesa dentro del
teléfono, sin conexión, porque está en el sótano de un hospital y lo que ve es
información del cliente.

**La tesis, y tiene que notarse en el diseño:** el sistema sabe **de dónde salió cada
número**. Cada dato lleva encima su procedencia. Cuando dos personas reportan cantidades
distintas, no se elige una: se enseñan las dos. Y cuando el código corrige al modelo,
lo dice en pantalla en vez de esconderlo.

El lema es: **Que conste quién lo vio.**

## Restricciones técnicas, no negociables

- Un solo archivo `.html`. Nada de React, Vue, Tailwind ni ningún framework.
- **Cero recursos externos.** Ni un `<link>`, ni un `<script src>`, ni `@import` a
  Google Fonts o a cualquier CDN. La aplicación funciona sin internet: si le pides una
  fuente a un servidor, se rompe justo en la demostración con el modo avión puesto.
  Declara las familias por nombre con sus alternativas; yo sirvo los archivos.
- Sin imágenes externas, sin iconos de librería, sin emoji como elemento de diseño.
- Todo el texto en español.
- **Móvil primero.** Se usa de pie, en un pasillo, con una mano. Funciona a 375 px y se
  abre a dos columnas por encima de 900 px. Nada desborda horizontalmente.
- Tema claro y oscuro con `prefers-color-scheme`, con los colores como variables CSS en
  `:root` redefinidas dentro de la media query. El oscuro no es una inversión.
- Deja el `<script>` que ya tenga la página vacío o mínimo: el JavaScript lo pongo yo.

## Sistema de diseño, úsalo tal cual

```css
/* claro */
--papel:#F1F4F4;  --hoja:#FFFFFF;  --tinta:#14181A;  --media:#5E696D;
--suave:#8A9498;  --linea:#D3DADC;  --linea-f:#E4E9EA;  --metal:#E7ECED;
--sello:#075A63;  --sello-tenue:#E2EEEF;
--ambar:#8A5A00;  --ambar-tenue:#FAF0DC;
--rojo:#8D3030;   --rojo-tenue:#F9EBEA;

/* oscuro */
--papel:#0F1315;  --hoja:#171D1F;  --tinta:#E6ECED;  --media:#96A2A6;
--suave:#6C787C;  --linea:#2A3437;  --linea-f:#202829;  --metal:#232B2D;
--sello:#4FC3CE;  --sello-tenue:#103336;
--ambar:#D9A64E;  --ambar-tenue:#2C2415;
--rojo:#E08A82;   --rojo-tenue:#2E1A19;
```

**Tipografías** (declara los nombres y las alternativas, sin cargarlas de ningún sitio):

- Títulos: `"Archivo", "Arial Narrow", sans-serif`, peso 700, `letter-spacing:-.022em`
- Texto e interfaz: `"Public Sans", "Segoe UI", system-ui, sans-serif`
- **Todo dato**: `"JetBrains Mono", Consolas, monospace` con
  `font-variant-numeric: tabular-nums`. Cantidades, edades, series y horas siempre así.

**Escala con salto real, no con cambios de grosor:** 40 / 22 / 16 / 11 px.
**Espaciado** base 4 con saltos grandes: 4, 8, 12, 16, 24, 40, 64.
**Radios casi planos:** 3 px en fichas, botones y campos; 4 px como máximo.

## Reglas de estética, y son las que deciden si sirve

1. **Filas regladas, no tarjetas.** Los datos se separan con una línea de 1 px, nunca
   con una tarjeta con sombra. **Cero `box-shadow` en todo el archivo.** Esto es un acta
   de campo, no un panel de control: un acta no flota.
2. **El color significa.** El acento solo en lo que se puede pulsar. El ámbar solo
   cuando el código corrigió algo. El rojo solo cuando dos personas no coinciden. Si un
   color aparece decorando, está mal.
3. **La marca de procedencia es la pieza central.** Ficha pequeña, monoespaciada, 10 px,
   versalitas, radio 3 px. Cuatro variantes:
   - `.marca.dicho` — sin fondo, borde `--linea`, texto `--suave`. Es lo normal, no grita.
   - `.marca.leido` — fondo `--metal`, borde `--linea`, texto `--tinta`.
   - `.marca.deducido` — fondo `--ambar-tenue`, borde y texto `--ambar`.
   - `.marca.manual` — fondo `--sello-tenue`, borde y texto `--sello`.
4. **Cuando dos personas no coinciden, se enseñan los dos números**, no uno. La celda
   tiene que estar dimensionada para dos desde el principio, no apretarse cuando aparece
   el segundo.

## Lo que NO quiero, y lo digo porque es lo que sale por defecto

- Tarjetas con sombra y esquinas muy redondeadas como contenedor de todo.
- Azul corporativo, y especialmente el azul de Philips: parecernos al cliente es un error.
- Degradados de cualquier tipo, y sobre todo morado o violeta.
- Rejilla de tres columnas con un icono en un círculo de color y dos líneas debajo.
- Todo centrado. Barra de color en el borde izquierdo de una tarjeta.
- Iconos decorativos, emoji, formas flotantes, líneas onduladas.
- `system-ui` como tipografía principal.

## Identificadores obligatorios, exactos

El JavaScript ya escrito busca **estos 28 `id`**. Tienen que existir, escritos igual, y
en un elemento del tipo que se indica. Es la parte más importante del encargo:

| id | qué es |
|---|---|
| `modelo` | línea de texto en el encabezado |
| `observador` | `input type="text"` |
| `texto` | `textarea` |
| `grabar` `subir` `analizar` `foto` | `button` |
| `archivo` | `input type="file"` oculto, para audio |
| `imagen` | `input type="file"` oculto, para la foto |
| `mic` | `select` |
| `nivelBarra` | elemento interno de la barra de nivel del micrófono |
| `estado` | línea de estado |
| `tarjetaPlaca` | bloque de la placa, empieza oculto |
| `placaCampos` `placaEstado` `placaTexto` | contenedores dentro de ese bloque |
| `aplicarPlaca` | `button` |
| `resultado` | bloque del resultado, empieza oculto |
| `transcripcion` `lugar` | contenedores de texto |
| `equipos` | **`tbody` de la tabla de equipos** |
| `descartes` `pregunta` | contenedores de aviso |
| `guardar` `guardado` | `button` y su línea de estado |
| `crudo` | `pre` dentro de un `details` |
| `base` | contenedor del Cliente 360 |
| `reiniciar` | `button` |

Los bloques que empiezan ocultos llevan `class="oculto"` y en el CSS `.oculto{display:none}`.

## Clases que hay que estilar aunque no las veas en el HTML

Esto es lo que se le escapa a todo el mundo: **el JavaScript genera HTML dentro de esos
contenedores usando estas clases**. Tienen que estar estiladas aunque no aparezcan en el
archivo estático. Inclúyelas en el CSS igualmente:

- `.mono` — monoespaciada con cifras tabulares.
- `.porque` — texto secundario pequeño, 12,5 px, color `--suave`, en su propia línea.
- `.vacio` — color `--suave`, para «nadie lo ha reportado».
- `.marca.dicho` `.marca.leido` `.marca.deducido` `.marca.manual` — las cuatro fichas.
- `.chip.Alta` `.chip.Media` `.chip.Baja` `.chip.Conflicto` — ficha de confianza en el
  Cliente 360. Alta es neutra (fondo `--metal`), Media y Baja son ámbar, Conflicto es rojo.
- `.pugna` — el segundo número cuando dos personas no coinciden: monoespaciada, 15 px,
  peso 700, color `--rojo`.
- `tr.clic` — fila pulsable del 360, con `:hover` de fondo `--metal`.
- `tr.abierta` — fila abierta, fondo `--metal`.
- `.rastro` y dentro `.r` — el rastro que se despliega **dentro de la fila**, nunca en un
  modal. Cada `.r` separado por una línea de 1 px.
- `.aviso.descartes` — bloque ámbar. `.aviso.pregunta` — la pregunta de seguimiento, sin
  fondo, en tipografía de título 18 px, con un rótulo pequeño en versalitas encima.

## La pantalla

Encabezado a lo ancho, y debajo dos columnas por encima de 900 px: a la izquierda la
captura y el resultado, a la derecha el Cliente 360. En móvil, una sola columna en ese
mismo orden.

### Encabezado

**Consta** grande, al lado «Que conste quién lo vio» en texto secundario, y a la derecha
en monoespaciada pequeña color acento:
`Whisper small + Qwen3 1.7B · todo en el dispositivo`.

### Captura

Etiqueta «Quién observa» + campo de texto con «Field User 01».
Etiqueta «Lo que vio (dictado o escrito)» + textarea con este marcador de posición:
«Estoy en Hospital DemoCare Pacific, en Panamá. Tienen dos resonadores y un tomógrafo.
Uno de los resonadores parece de unos ocho años.»
Fila de botones: **Grabar** (primario), **Subir audio**, **Analizar texto** y
**Foto de la placa** (los tres secundarios). En móvil ocupan el ancho.
Debajo: etiqueta «Micrófono», un `select`, y una barra de nivel delgada (8 px de alto,
fondo `--linea`, relleno `--sello`).
Debajo, la línea de estado.

### Placa del equipo (empieza oculta)

Título «Placa del equipo». Lista de campos en filas regladas, etiqueta a la izquierda y
valor a la derecha: Marca, Modelo, Nº de serie, Fabricado en, Modalidad según la placa.
Un botón **Aplicar a la observación** y una línea de estado al lado.
Al final un `<details>` cerrado: «Lo que leyó VisionPsy, tal cual» con un `<pre>`.

### Lo que entendió (empieza oculto)

Título «Lo que entendió». Debajo la transcripción, y el nombre del hospital con su
ciudad y país en texto secundario.

Una tabla con seis columnas: **Equipo · Cantidad · Marca · Modelo · Antigüedad ·
Procedencia**. Rellénala con este ejemplo real:

```
MR   1   Philips   Ingenia Ambition 1.5T   9 años (placa, 2017)   leído en la placa
     ↑ mono        SN 12345XY en .porque   ↑ mono                 ↑ .marca.leido
MR   1   Unknown   Unknown                 —                      dicho
CT   1   Unknown   Unknown                 —                      dicho
```

Debajo, el bloque ámbar de avisos con este texto real:
«**El código corrigió 2 datos leyendo la frase, no al modelo:** MR: la frase dice 2 y el
modelo extrajo 1; el código añade 1. CT: la frase dice 1 y el modelo extrajo 2; el
código quita 1.»

Debajo, la pregunta de seguimiento: rótulo pequeño «SIGUIENTE PREGUNTA» y, en grande,
«¿Sabes la marca del otro resonador?»

Botón **Guardar observación** y su línea de estado. Y un `<details>` cerrado: «JSON
crudo del modelo y verificado».

### Cliente 360

Título «Cliente 360». Dentro, para el hospital: nombre grande, y en secundario
«Panamá · 2 observaciones · 2 personas».

Tabla de cuatro columnas: **Equipo · Cantidad · Antigüedad · Confianza**, con dos filas:

- **MR** (resonador) · cantidad **2** y al lado **o 3** en `.pugna` rojo · «9 años» con
  «de la placa» en `.porque` · ficha `.chip.Conflicto` que dice «Conflicto» y debajo en
  `.porque` «2 observadores, no coinciden». La fila es pulsable (`tr.clic`).
- **CT** (tomógrafo) · cantidad **1** · «—» en `.vacio` con «nadie lo ha dicho» en
  `.porque` · ficha `.chip.Alta` que dice «Alta» y debajo «las dos personas coinciden».

Enseña también, **desplegado dentro de la fila del MR y no en un modal**, el bloque
`.rastro` con dos entradas `.r`:

- «**OBS-001** · Field User 01 · 8 sep · voz — *dos resonadores y un tomógrafo, uno de
  unos ocho años*»
- «**OBS-002** · Sales User 02 · hoy · voz — *creo que tienen tres resonadores*»

Y al final del bloque, en texto normal: «No se elige un número. Se guardan los dos, y la
siguiente persona que entre recibe la pregunta.»

Abajo del todo, alineado a la derecha, un botón discreto en rojo con borde y sin fondo:
**Volver a las observaciones de ejemplo**.

Devuélveme solo el archivo HTML completo, sin explicaciones.
