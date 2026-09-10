---
# gstack: design-md-format=spec
name: Tako
description: Acta de campo. Papel de acero, tinta fría y una sola marca de color, la que dice que un dato fue corregido.
colors:
  primary: "#075A63"
  on-primary: "#FFFFFF"
  surface: "#FFFFFF"
  background: "#F1F4F4"
  text: "#14181A"
  text-muted: "#5E696D"
  text-faint: "#8A9498"
  line: "#D3DADC"
  line-hairline: "#E4E9EA"
  metal: "#E7ECED"
  accent: "#075A63"
  accent-wash: "#E2EEEF"
  success: "#14603A"
  warning: "#8A5A00"
  warning-wash: "#FAF0DC"
  error: "#8D3030"
  error-wash: "#F9EBEA"
typography:
  display:
    fontFamily: Archivo
    fontWeight: 700
    fontSize: clamp(34px, 6vw, 44px)
    letterSpacing: -0.022em
  body:
    fontFamily: Public Sans
    fontSize: 1rem
    lineHeight: 1.55
  label:
    fontFamily: Public Sans
    fontSize: 0.6875rem
    letterSpacing: 0.14em
  mono:
    fontFamily: JetBrains Mono
    fontFeature: tnum
rounded:
  sm: 3px
  md: 4px
  lg: 6px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  2xl: 64px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.sm}"
  button-primary-hover:
    backgroundColor: "#04454C"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.primary}"
    borderColor: "{colors.primary}"
    rounded: "{rounded.sm}"
  input:
    borderColor: "{colors.line}"
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.sm}"
  row:
    borderColor: "{colors.line-hairline}"
    backgroundColor: "transparent"
  tag-dicho:
    borderColor: "{colors.line}"
    textColor: "{colors.text-faint}"
    rounded: "{rounded.sm}"
  tag-leido:
    backgroundColor: "{colors.metal}"
    borderColor: "{colors.line}"
    textColor: "{colors.text}"
    rounded: "{rounded.sm}"
  tag-deducido:
    backgroundColor: "{colors.warning-wash}"
    borderColor: "{colors.warning}"
    textColor: "{colors.warning}"
    rounded: "{rounded.sm}"
  tag-manual:
    backgroundColor: "{colors.accent-wash}"
    borderColor: "{colors.accent}"
    textColor: "{colors.accent}"
    rounded: "{rounded.sm}"
---

# Tako

## Overview

**Creative North Star:** Un acta de campo, no un panel de control. Un documento que se
va firmando mientras se llena, donde cada dato lleva encima de dónde salió.

**Product context:** Captura de base instalada hospitalaria para ingenieros de servicio.
La persona sale de una visita y dicta lo que vio, o fotografía la chapa del equipo. El
sistema extrae, verifica contra lo dicho, corrige lo que el modelo inventó, y guarda
quién lo vio y cuándo. Todo dentro del dispositivo. Los pares del sector son las apps de
servicio de campo (ServiceMax, Fiix) y las consolas de equipo médico.

**Mode per surface:** Captura → Operate, de pie y con una mano. Cliente 360 → Read, se
consulta y se compara. Manual → Read, con una cita y su fuente. No hay superficie de
Persuade: nadie vende nada aquí dentro.

**Key characteristics:**
- Cada valor lleva una marca de procedencia. Son cuatro y solo cuatro.
- Filas regladas por una línea de 1 px. Ni una tarjeta, ni una sombra.
- El ámbar aparece solo cuando el código corrigió algo, y no se puede ocultar.
- Cuando dos personas no coinciden, la celda enseña los dos números.
- Los números van en monoespaciada con cifras tabulares, siempre.

## Colors

**Strategy:** Restringido. Un acento y neutros fríos con sesgo acero. El color tiene que
quedar libre para significar: si el ámbar decorase algo, dejaría de avisar de nada.

**Light or dark:** Claro por defecto, porque la escena dominante es un pasillo de
hospital con fluorescentes y el teléfono a un brazo de distancia. El oscuro existe para
el sótano y está **rediseñado**, no invertido: los neutros se vuelven a elegir y el ámbar
sube a `#D9A64E` para seguir siendo el que grita sobre fondo oscuro.

Named rules: `primary` es lo único interactivo, y no aparece en ningún sitio que no se
pueda pulsar. `warning` es exclusivo de «el código corrigió esto». `error` es exclusivo
de «dos personas no coinciden». `metal` es el fondo de la marca «leído en la placa» y de
nada más. Los neutros derivan de un gris con sesgo cian, no de un gris puro.

## Typography

Las caras salen del mundo que esta persona ya lee: chapas grabadas, partes de trabajo y
etiquetas de calibración.

- **Archivo** (display, 500/700). Grotesca de Omnibus-Type dibujada para texto muy
  legible en formularios impresos y en pantallas densas de datos. Ese es exactamente el
  mundo del parte de trabajo. Solo en títulos, nombres de sitio, modalidad y la pregunta
  de seguimiento.
- **Public Sans** (cuerpo e interfaz, 400/500/600). Es la cara del sistema de diseño del
  gobierno de Estados Unidos, hecha para interfaces oficiales que tiene que poder leer
  cualquiera. Un acta de campo es un documento oficial: encaja de origen. Y en una
  superficie de trabajo la personalidad va en la estructura, no en el texto de apoyo.
- **JetBrains Mono** (datos, 500). Series, cantidades, edades, fechas y horas, con
  `font-variant-numeric: tabular-nums`. Los números tienen que alinearse en columna.

**Loading strategy: empaquetadas en el repo, nunca enlazadas.** Una aplicación que
presume de funcionar sin conexión no puede pedirle las tipografías a un CDN: en el
sótano caen a la cara de sistema y el diseño se desmonta justo donde se demuestra. Los
woff2 viven en `tipografias/`, solo los subconjuntos latin y latin-ext, 391 KB en total.

**Y por eso la licencia manda sobre el gusto.** La primera elección fueron Cabinet
Grotesk y General Sans, de Fontshare. Se descartaron al comprobar la licencia: la ITF
Free Font License permite auto-hospedarlas pero **restringe redistribuirlas**, y este
repositorio es público. Archivo, Public Sans y JetBrains Mono están las tres bajo SIL
Open Font License 1.1, que sí permite redistribuirlas junto al software. El texto
completo de las tres licencias está en `tipografias/LICENCIAS.md`.

**Scale:** 44 / 22 / 16 / 11. Entre nivel y nivel hay salto de tamaño, no un cambio de
grosor. La escala anterior estaba a un paso de distancia y no se leía como jerarquía.

## Layout

Una columna hasta 720 px; a partir de ahí captura a la izquierda y expediente a la
derecha, con un ancho máximo de 1080. La unidad es la fila reglada, no la tarjeta: 12 px
de aire arriba y abajo y una línea de 1 px que separa.

El ritmo del espaciado tiene salto grande a propósito (16 → 24 → 40): la jerarquía tiene
que leerse de un vistazo saliendo de una visita, no estudiarse.

Lo que rompe la rejilla a propósito: la celda en conflicto, que se dimensiona para dos
valores desde el principio en vez de apretarse cuando aparece el segundo.

## Elevation & Depth

No hay elevación. La profundidad se muestra con líneas y con un cambio de fondo
(`surface` sobre `background`), nunca con sombra. Un acta no flota.

## Shapes

Radios pequeños y casi planos: 3 px en fichas, botones y campos; 4 px en la envolvente de
una pantalla; 6 px como máximo. Nada redondeado del todo salvo que sea un control
circular. El radio grande y uniforme es lo que hace que todo parezca la misma app de
siempre.

## Components

- **Fila** (`row`): línea inferior de 1 px en `line-hairline`; la última no la lleva.
  Estado abierto: el rastro se despliega dentro, no en un modal.
- **Marca de procedencia** (`tag-*`): monoespaciada, 10,5 px, versalitas, radio 3 px.
  `dicho` no lleva fondo porque es lo normal. `leido` lleva fondo metal. `deducido`
  lleva ámbar y borde ámbar. `manual` lleva el acento.
- **Botón primario**: ancho completo en móvil, `primary` sólido, sin degradado. Foco
  visible con contorno de 2 px del propio acento y 2 px de separación.
- **Botón fantasma**: para lo secundario. Nunca dos botones sólidos juntos.
- **Campo**: borde `line`, fondo `surface`. En foco, borde `primary`.
- Estados obligatorios en todos: hover, focus-visible, activo, deshabilitado, y el
  estado vacío honesto («nadie lo ha reportado» no es lo mismo que cero).

## Do's and Don'ts

- **Do:** toda cifra en `mono` con `tabular-nums`.
- **Do:** todo valor lleva su marca de procedencia; si no se sabe de dónde salió, no se enseña.
- **Do:** separar con una línea de 1 px.
- **Do:** empaquetar las tipografías; comprobar el diseño con el modo avión puesto.
- **Do:** enseñar los dos valores cuando dos personas no coinciden.
- **Don't:** tarjetas con sombra como contenedor de todo. Es la categoría entera y es de lo que huimos.
- **Don't:** azul corporativo, y menos el azul de Philips: parecernos al cliente es un error de tono.
- **Don't:** esconder una corrección detrás de un icono o un desplegable.
- **Don't:** elegir un número cuando hay desacuerdo.
- **Don't:** color decorativo. Si aparece ámbar o rojo es porque significa algo.

## Motion

- **Approach:** minimal-functional.
- **Easing:** enter(ease-out) exit(ease-in) move(ease-in-out)
- **Duration:** micro(80ms) short(180ms) medium(250ms) long(400ms)
- **The one authored moment:** cuando el verificador corrige un valor, el viejo no
  desaparece. Se tacha y el nuevo se asienta, una vez, en 250 ms. Es la tesis del
  proyecto convertida en animación. Todo lo demás es instantáneo. Respetar
  `prefers-reduced-motion`: sin el movimiento, el tachado se queda igual.

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-09-09 | Sistema de diseño inicial | Creado por /design-consultation. Lo memorable elegido: «sabe de dónde salió cada número» |
| 2026-09-09 | Claro por defecto, oscuro rediseñado | La escena manda: pasillo con fluorescentes. El oscuro es para el sótano |
| 2026-09-09 | Tipografías empaquetadas, no enlazadas | Sin conexión no hay CDN: enlazarlas rompe el diseño justo donde se demuestra |
| 2026-09-09 | Fuera Cabinet Grotesk y General Sans; entran Archivo y Public Sans | La ITF Free Font License de Fontshare restringe la redistribución y el repo es público. Las tres caras nuevas son OFL |
| 2026-09-09 | Acento petróleo, no azul | Evitar el azul del sector y sobre todo el de Philips |
| 2026-09-09 | Filas regladas, sin tarjetas | La categoría entera es de tarjetas; un acta no lo es |
| 2026-09-09 | La celda enseña dos valores en conflicto | No elegir por el usuario es la tesis del producto |
