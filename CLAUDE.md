# Tako

Captura de base instalada hospitalaria, entera en el dispositivo. Ver `README.md` para
qué es, cómo correrlo y los números medidos.

## Design System

Always read DESIGN.md before making any visual or UI decisions.
All font choices, colors, spacing, and aesthetic direction are defined there.
Do not deviate without explicit user approval.
In QA mode, flag any code that doesn't match DESIGN.md.

## Reglas de este repositorio

- **Las tipografías van empaquetadas, nunca enlazadas.** Están en `tipografias/` con sus
  licencias OFL. Enlazar un CDN rompe el diseño justo donde se demuestra el proyecto: sin
  conexión. Si añades una cara, tiene que ser redistribuible y bajarse al repo.
- **`datos/` no se publica.** Lleva grabaciones de voz reales y observaciones con nombres
  de personas. Está en `.gitignore` y ahí se queda.
- **Antes de decir que algo funciona, córrelo.** `node prueba-cantidades.mjs` y
  `node prueba-placa-campos.mjs` tardan milisegundos y no cargan ningún modelo. Los de
  modelo (`prueba-extraccion3.mjs`, `prueba-placas.mjs`) tardan minutos pero son los que
  producen los registros de `rendimiento/`.
- **El arnés entra por el mismo código que la app** (`extraerVerificado` en `extraer.mjs`).
  Si alguna vez vuelve a tener su propia copia del prompt, la medición deja de valer.
- **VisionPsy no es determinista ni a temperatura 0.** Si una lectura de placa falla,
  mira primero `textoLeido` en `rendimiento/placas.json` antes de tocar el modelo: casi
  siempre el fallo está en el parseo, no en la lectura.
