// Laboratorio de Tako. Junta en un solo proceso las piezas probadas por separado:
// voz -> texto (Whisper), texto -> JSON (Qwen3 con esquema), verificacion contra la
// frase, repregunta en codigo, guardado con procedencia, y el Cliente 360 que conserva
// los conflictos en vez de elegir un numero. Sin dependencias fuera de Node y QVAC.
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync, rmSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { loadModel, transcribe, WHISPER_BASE_Q8_0, WHISPER_SMALL_Q8_0, QWEN3_1_7B_INST_Q4, QWEN3_4B_INST_Q4_K_M, VISIONPSY_NANO_460M_MULTIMODAL_Q4_K_M_1, MMPROJ_VISIONPSY_NANO_460M_MULTIMODAL_Q8_0_1 } from "@qvac/sdk";
import { extraer, faltantesDe, preguntaDe, cantidadesPorModalidad } from "./extraer.mjs";
import { leerPlaca } from "./placa.mjs";
import { transcripcionSospechosa } from "./verificar.mjs";
import { pinCorrecto, esperaTras, tecnicoPublico, registrar, observadorDe, contrastar, coberturaDe, conflictosDe } from "./tecnicos.mjs";
import { conUid, etiquetar, empaquetar, revisarPaquete, fundir, pugnasNuevas } from "./libro.mjs";

const DIR = path.dirname(fileURLToPath(import.meta.url));

// Se puede levantar un SEGUNDO equipo en la misma maquina, con su propio libro y su propio
// padron, para ensenar la fusion de verdad en vez de contarla:
//
//   node servidor.mjs --puerto=3211 --datos=datos-equipo-2
//
// Van como banderas y no solo como variables de entorno porque en PowerShell, que es donde
// esto se usa, `DATOS=x node servidor.mjs` no hace lo que parece: no existe el prefijo de
// variable en linea. Las variables de entorno siguen valiendo para quien use bash.
const BANDERAS = Object.fromEntries(
  process.argv.slice(2)
    .filter((a) => a.startsWith("--"))
    .map((a) => { const i = a.indexOf("="); return i < 0 ? [a.slice(2), "true"] : [a.slice(2, i), a.slice(i + 1)]; })
);
const opcion = (nombre, env) => BANDERAS[nombre] ?? process.env[env] ?? "";

const carpetaDatos = opcion("datos", "DATOS") || "datos";
const DATOS = path.isAbsolute(carpetaDatos) ? carpetaDatos : path.join(DIR, carpetaDatos);
mkdirSync(DATOS, { recursive: true });
const ARCHIVO = path.join(DATOS, "observaciones.json");
const PUERTO = Number(opcion("puerto", "PUERTO") || 3210);
// Extracción: por defecto se cargan LOS DOS Qwen3. Se extrae con el 1.7B (rápido) y, si el
// verificador detecta que omitió un equipo mencionado, se reintenta con el 4B (fiable).
// QMODEL=4b usa solo el grande; QMODEL=1.7b usa solo el rápido.
const USA_4B = opcion("qmodel", "QMODEL") === "4b";
const SOLO_RAPIDO = opcion("qmodel", "QMODEL") === "1.7b";
// Voz: "small" por defecto. El "base" (81 MB) se equivoca con vocabulario técnico en
// español hablado real ("resornadores", "tomohorazo"); QVOZ=base lo vuelve a activar.
const VOZ_BASE = opcion("qvoz", "QVOZ") === "base";
const NOMBRE_MODELO = `Whisper ${VOZ_BASE ? "base" : "small"} + Qwen3 ${USA_4B ? "4B" : SOLO_RAPIDO ? "1.7B" : "1.7B (→ 4B si omite algo)"}`;
// Glosario que sesga a Whisper hacia las palabras del dominio (nombres, modalidades).
const VOCABULARIO = "Hospital DemoCare Pacific, Clínica DemoCare Light, Centro Médico DemoCare Valley. Resonadores, resonancia magnética, tomógrafo, tomografía, ecógrafos, ultrasonido, rayos X, MR, CT. Marcas: NovaMed, Aurelia Health, Orion Imaging, HelixCare. En Panamá.";

// La primera vez, el laboratorio arranca con UNA observacion: la que levanto la gente de
// este equipo. Antes arrancaba con dos que no coincidian entre si, y eso era hacer trampa
// con la propia tesis: en campo las dos personas no comparten tablet, asi que el
// desacuerdo NO puede estar servido al abrir la app. Aparece cuando se funden los dos
// libros, y para eso viene datos-ejemplo/libro-de-luis.json en el repositorio.
const EJEMPLO = path.join(DIR, "datos-ejemplo", "observaciones.json");
// El libro siempre se lee y se escribe con uid puesto y etiquetado por fecha. La etiqueta
// OBS-NNN es derivada: despues de fundir el libro de otro equipo se renumera sola, sin
// huecos ni repetidas, y nadie tiene que fiarse de la numeracion ajena.
function leer() {
  if (!existsSync(ARCHIVO) && existsSync(EJEMPLO)) copyFileSync(EJEMPLO, ARCHIVO);
  return existsSync(ARCHIVO) ? etiquetar(conUid(JSON.parse(readFileSync(ARCHIVO, "utf-8")))) : [];
}
const escribir = (obs) => writeFileSync(ARCHIVO, JSON.stringify(etiquetar(conUid(obs)), null, 2));

// Cuales de las guardadas vinieron sembradas con el laboratorio. Se sabe por su uid y no
// por la etiqueta: la etiqueta se renumera al fundir el libro de otro equipo, el uid sale
// del contenido y no cambia nunca.
const IDS_SEMBRADOS = new Set(
  existsSync(EJEMPLO) ? conUid(JSON.parse(readFileSync(EJEMPLO, "utf-8"))).map((o) => o.uid) : []
);

// ---------- el padron ----------
// Quien puede firmar una observacion en este equipo. Se siembra la primera vez con la
// cuadrilla de ejemplo; a partir de ahi el archivo es del dispositivo. Las sales y los
// hashes viven SOLO aqui: al navegador nunca le llega mas que id, nombre y zona.
const PADRON = path.join(DATOS, "tecnicos.json");
const PADRON_EJEMPLO = path.join(DIR, "datos-ejemplo", "tecnicos.json");
function leerPadron() {
  if (!existsSync(PADRON) && existsSync(PADRON_EJEMPLO)) copyFileSync(PADRON_EJEMPLO, PADRON);
  return existsSync(PADRON) ? JSON.parse(readFileSync(PADRON, "utf-8")) : [];
}
const escribirPadron = (p) => writeFileSync(PADRON, JSON.stringify(p, null, 2));

// La sesion vive en memoria y se muere con el proceso: no hay cookie, no hay disco, no
// hay red. Existe para que POST /guardar no se pueda firmar con el nombre de otro solo
// por escribirlo en el cuerpo de la peticion; sin esto la identidad seria decorado.
const SESIONES = new Map();
const FALLOS = new Map(); // por tecnico: cuantos PIN malos seguidos, y hasta cuando espera
const quienEs = (req) => SESIONES.get(String(req.headers["x-tako-sesion"] ?? ""));

console.log("cargando modelos…");
const t0 = Date.now();
const whisper = await loadModel({ modelSrc: VOZ_BASE ? WHISPER_BASE_Q8_0 : WHISPER_SMALL_Q8_0, modelConfig: { detect_language: true } });
const llmRapido = USA_4B ? null : await loadModel({ modelSrc: QWEN3_1_7B_INST_Q4 });
const llmGrande = SOLO_RAPIDO ? null : await loadModel({ modelSrc: QWEN3_4B_INST_Q4_K_M });
console.log(`modelos listos en ${((Date.now() - t0) / 1000).toFixed(1)} s · ${NOMBRE_MODELO}`);

// Primero el rápido; si omitió un equipo que la frase menciona (o no sacó ninguno), el grande.
async function extraerConReintento(texto) {
  let r = await extraer(llmRapido ?? llmGrande, texto);
  const omitio = r.omisiones.length > 0 || r.json.equipos.length === 0;
  if (omitio && llmRapido && llmGrande) {
    const r2 = await extraer(llmGrande, texto);
    r = { ...r2, ms: r.ms + r2.ms, reintento: `El modelo rápido omitió algo (${r.omisiones.join("; ") || "ningún equipo"}); se reintentó con el modelo grande.` };
  }
  return r;
}

// ---------- Cliente 360 ----------
// Agrupa por hospital y modalidad. Por cada observador toma su ultimo reporte; si los
// observadores no coinciden en la cantidad, se muestran TODOS los valores y se marca
// conflicto. Nadie decide en silencio cual es la verdad.
function resumen(observaciones) {
  const porCliente = {};
  for (const o of observaciones) {
    const c = (porCliente[o.json.cliente] ??= { cliente: o.json.cliente, ciudad: o.json.ciudad, pais: o.json.pais, modalidades: {}, observaciones: 0 });
    if (c.ciudad === "Unknown" && o.json.ciudad !== "Unknown") c.ciudad = o.json.ciudad;
    if (c.pais === "Unknown" && o.json.pais !== "Unknown") c.pais = o.json.pais;
    c.observaciones++;
    for (const [mod, n] of Object.entries(cantidadesPorModalidad(o.json))) {
      const filas = o.json.equipos.filter((q) => q.modalidad === mod);
      const m = (c.modalidades[mod] ??= { modalidad: mod, reportes: [] });
      m.reportes.push({
        id: o.id, observador: observadorDe(o), fecha: o.fecha, fuente: o.fuente, texto: o.texto,
        cantidad: n,
        aproximada: filas.some((q) => q.cantidadAproximada),
        marcas: [...new Set(filas.map((q) => q.marca).filter((x) => x !== "Unknown"))],
        edades: filas.map((q) => (q.edadAnios ? `${q.edadAnios} años` : q.edadCualitativa)).filter(Boolean),
      });
    }
  }
  for (const c of Object.values(porCliente)) {
    for (const m of Object.values(c.modalidades)) {
      const ultimoPorObservador = {};
      for (const r of m.reportes) {
        const q = r.observador.clave;
        if (!ultimoPorObservador[q] || r.fecha > ultimoPorObservador[q].fecha) ultimoPorObservador[q] = r;
      }
      const ultimos = Object.values(ultimoPorObservador);
      m.observadores = ultimos.length;
      m.cantidades = [...new Set(ultimos.map((r) => r.cantidad))].sort((a, b) => a - b);
      m.conflicto = m.cantidades.length > 1;
      m.marca = [...new Set(m.reportes.flatMap((r) => r.marcas))].join(" / ") || "Unknown";
      m.edad = [...new Set(m.reportes.flatMap((r) => r.edades))].join(", ") || "—";
      m.ultimaVez = m.reportes.map((r) => r.fecha).sort().at(-1);
      const completa = m.marca !== "Unknown" && m.edad !== "—";
      m.confianza = m.conflicto ? "Conflicto" : m.observadores >= 2 && completa ? "Alta" : m.observadores >= 2 || completa ? "Media" : "Baja";
      m.porque = m.conflicto
        ? `${m.observadores} observadores, no coinciden (${m.cantidades.join(" o ")})`
        : m.observadores >= 2 ? `confirmado por ${m.observadores} personas` : `1 observador${completa ? "" : ", datos incompletos"}`;
      m.reportes.sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
    }
    c.modalidades = Object.values(c.modalidades);
  }
  return Object.values(porCliente);
}

// VisionPsy se carga la primera vez que alguien manda una foto, no al arrancar: son
// 411 MB más y la mayoría de las visitas se capturan hablando. La primera foto paga
// 4 s de carga; las siguientes, no.
let visionpsy = null;
async function modeloDePlacas() {
  if (visionpsy) return visionpsy;
  const t = Date.now();
  visionpsy = await loadModel({
    modelSrc: VISIONPSY_NANO_460M_MULTIMODAL_Q4_K_M_1,
    modelConfig: { ctx_size: 4096, projectionModelSrc: MMPROJ_VISIONPSY_NANO_460M_MULTIMODAL_Q8_0_1 },
  });
  console.log(`VisionPsy-Nano-460M cargado en ${((Date.now() - t) / 1000).toFixed(1)} s`);
  return visionpsy;
}

// ---------- HTTP ----------
const cuerpo = (req) => new Promise((res, rej) => {
  const trozos = []; let n = 0;
  req.on("data", (t) => { n += t.length; if (n > 30e6) { rej(new Error("cuerpo demasiado grande")); req.destroy(); } else trozos.push(t); });
  req.on("end", () => res(Buffer.concat(trozos)));
  req.on("error", rej);
});
const json = (res, codigo, obj) => { res.writeHead(codigo, { "content-type": "application/json; charset=utf-8" }); res.end(JSON.stringify(obj)); };

const servidor = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PUERTO}`);
    if (req.method === "GET" && url.pathname === "/") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      return res.end(readFileSync(path.join(DIR, "index.html")));
    }
    // Las tipografias se sirven desde el repo, no desde un CDN: una app que funciona
    // sin conexion no puede depender de una descarga externa para verse bien.
    if (req.method === "GET" && url.pathname.startsWith("/tipografias/")) {
      const nombre = path.basename(url.pathname);
      const ruta = path.join(DIR, "tipografias", nombre);
      if (!existsSync(ruta)) return json(res, 404, { error: "no existe" });
      const tipo = nombre.endsWith(".woff2") ? "font/woff2" : "text/css; charset=utf-8";
      res.writeHead(200, { "content-type": tipo, "cache-control": "public, max-age=604800" });
      return res.end(readFileSync(ruta));
    }
    if (req.method === "GET" && url.pathname === "/base") {
      const obs = leer();
      const ejemplos = obs.filter((o) => IDS_SEMBRADOS.has(o.uid)).map((o) => o.id);
      return json(res, 200, { modelo: NOMBRE_MODELO, total: obs.length, ejemplos, resumen: resumen(obs) });
    }

    // ---------- quien lo vio ----------
    // El padron y el panel. Va sin sesion a proposito: para elegir quien eres hay que
    // poder ver la lista antes de entrar, y aqui no viaja ni una sal ni un hash.
    if (req.method === "GET" && url.pathname === "/tecnicos") {
      const padron = leerPadron();
      return json(res, 200, { padron: padron.map(tecnicoPublico), cobertura: coberturaDe(leer(), padron) });
    }
    if (req.method === "POST" && url.pathname === "/entrar") {
      const { id, pin } = JSON.parse((await cuerpo(req)).toString("utf-8"));
      const tecnico = leerPadron().find((t) => t.id === id);
      // Mismo mensaje y mismo camino si el tecnico no existe o si el PIN esta mal: si
      // fueran distintos, probar ids seria una forma de averiguar quien esta en el padron.
      const estado = FALLOS.get(id) ?? { fallos: 0, hasta: 0 };
      const faltan = estado.hasta - Date.now();
      if (faltan > 0) return json(res, 429, { error: `Demasiados intentos. Espera ${Math.ceil(faltan / 1000)} s.`, esperaMs: faltan });
      if (!tecnico || !pinCorrecto(tecnico, pin)) {
        const fallos = estado.fallos + 1;
        FALLOS.set(id, { fallos, hasta: Date.now() + esperaTras(fallos) });
        return json(res, 401, { error: "Ese PIN no es." });
      }
      FALLOS.delete(id);
      const sesion = randomBytes(24).toString("hex");
      SESIONES.set(sesion, { id: tecnico.id, uid: tecnico.uid ?? null, clave: String(tecnico.uid ?? tecnico.id), nombre: tecnico.nombre, verificado: true });
      console.log(`entró ${tecnico.nombre} (${tecnico.id})`);
      return json(res, 200, { ok: true, sesion, tecnico: tecnicoPublico(tecnico) });
    }
    if (req.method === "POST" && url.pathname === "/registrar") {
      const { nombre, zona, pin } = JSON.parse((await cuerpo(req)).toString("utf-8"));
      const padron = leerPadron();
      const r = registrar(padron, { nombre, zona, pin });
      if (r.error) return json(res, 400, { error: r.error });
      padron.push(r.tecnico); escribirPadron(padron);
      const sesion = randomBytes(24).toString("hex");
      SESIONES.set(sesion, { id: r.tecnico.id, uid: r.tecnico.uid ?? null, clave: String(r.tecnico.uid ?? r.tecnico.id), nombre: r.tecnico.nombre, verificado: true });
      return json(res, 200, { ok: true, sesion, tecnico: tecnicoPublico(r.tecnico) });
    }
    if (req.method === "POST" && url.pathname === "/salir") {
      SESIONES.delete(String(req.headers["x-tako-sesion"] ?? ""));
      return json(res, 200, { ok: true });
    }
    // Lo que el tecnico recibe ANTES de guardar: que numero puso otra persona en ese
    // mismo hospital y esa misma modalidad. Se pregunta mientras todavia esta parado en
    // el pasillo y puede ir a contar.
    if (req.method === "POST" && url.pathname === "/contraste") {
      const yo = quienEs(req);
      if (!yo) return json(res, 401, { error: "Entra con tu PIN antes de guardar." });
      const { json: datos } = JSON.parse((await cuerpo(req)).toString("utf-8"));
      return json(res, 200, { contraste: contrastar(leer(), datos, yo.clave ?? yo.id) });
    }
    if (req.method === "POST" && url.pathname === "/transcribir") {
      const audio = await cuerpo(req);
      // Se guarda la última grabación para poder reproducir un fallo con la voz real.
      writeFileSync(path.join(DATOS, "ultimo-audio.wav"), audio);
      const t = Date.now();
      const texto = String(await transcribe({ modelId: whisper, audioChunk: audio, prompt: VOCABULARIO })).trim();
      // Whisper rellena el silencio con subtítulos inventados; se avisa antes de extraer nada.
      return json(res, 200, { texto, ms: Date.now() - t, sospechoso: transcripcionSospechosa(texto) });
    }
    if (req.method === "POST" && url.pathname === "/extraer") {
      const { texto } = JSON.parse((await cuerpo(req)).toString("utf-8"));
      if (!texto?.trim()) return json(res, 400, { error: "falta el texto" });
      const r = await extraerConReintento(texto.trim());
      const faltantes = faltantesDe(r.json);
      return json(res, 200, { ...r, faltantes, pregunta: preguntaDe(faltantes, texto) });
    }
    if (req.method === "POST" && url.pathname === "/guardar") {
      // El observador sale de la SESIÓN, nunca del cuerpo de la petición. Ese era el
      // agujero: el lema prometía «quién lo vio» y el quién era un campo de texto que
      // cualquiera reescribía. Si el nombre viniera en el cuerpo, firmar como otro sería
      // teclearlo.
      const yo = quienEs(req);
      if (!yo) return json(res, 401, { error: "Entra con tu PIN antes de guardar." });
      const { texto, fuente, json: datos } = JSON.parse((await cuerpo(req)).toString("utf-8"));
      if (!datos?.cliente) return json(res, 400, { error: "falta la observación" });
      const obs = leer();
      // Si al guardar ya había otro número puesto por otra persona, queda escrito que se
      // guardó sabiéndolo. Se calcula aquí y no se acepta del navegador: el desacuerdo no
      // se resuelve, se fecha.
      const roce = contrastar(obs, datos, yo.clave ?? yo.id).filter((c) => c.discrepa);
      const nueva = {
        id: `OBS-${String(obs.length + 1).padStart(3, "0")}`,
        fecha: new Date().toISOString(),
        observador: { id: yo.id, uid: yo.uid ?? null, nombre: yo.nombre, verificado: true },
        fuente: fuente || "texto",
        texto,
        json: datos,
        ...(roce.length ? {
          discrepancias: roce.map((c) => ({
            modalidad: c.modalidad, mia: c.mia,
            otros: c.otros.map((r) => ({ nombre: r.nombre, cantidad: r.cantidad, obs: r.obs })),
          })),
        } : {}),
      };
      obs.push(nueva); escribir(obs);
      return json(res, 200, { ok: true, id: nueva.id, discrepancias: nueva.discrepancias ?? [] });
    }
    // Foto de la placa del equipo: la voz casi nunca da marca ni modelo, y la placa
    // además trae la fecha de fabricación, o sea una edad exacta en vez de estimada.
    if (req.method === "POST" && url.pathname === "/placa") {
      const imagen = await cuerpo(req);
      if (!imagen.length) return json(res, 400, { error: "falta la imagen" });
      const ext = (req.headers["content-type"] || "").includes("jpeg") ? "jpg" : "png";
      // Se guarda la última foto para poder reproducir una lectura mala.
      const ruta = path.join(DATOS, `ultima-placa.${ext}`);
      writeFileSync(ruta, imagen);
      const r = await leerPlaca(await modeloDePlacas(), ruta, { imagen });
      return json(res, 200, r);
    }
    // Recalcular la repregunta cuando la placa rellena marca, modelo o edad. Va por el
    // servidor a propósito: la lógica de qué falta vive en extraer.mjs y no se duplica.
    if (req.method === "POST" && url.pathname === "/pregunta") {
      const { json: datos, texto } = JSON.parse((await cuerpo(req)).toString("utf-8"));
      if (!datos) return json(res, 400, { error: "falta la observación" });
      const faltantes = faltantesDe(datos);
      return json(res, 200, { faltantes, pregunta: preguntaDe(faltantes, texto ?? "") });
    }
    // ---------- el libro sale y entra ----------
    // Tako corria DENTRO del dispositivo, que no es lo mismo que ser descentralizado: lo
    // de Marta se quedaba en la tablet de Marta. Un libro se exporta a un archivo, el
    // archivo viaja como quiera (USB, correo, lo que sea) y el otro equipo lo funde con
    // el suyo. Sin servidor en medio y sin nube.
    if (req.method === "GET" && url.pathname === "/libro") {
      const yo = quienEs(req);
      const paquete = empaquetar(leer(), yo);
      res.writeHead(200, {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="tako-libro-${new Date().toISOString().slice(0, 10)}.json"`,
      });
      return res.end(JSON.stringify(paquete, null, 2));
    }
    if (req.method === "POST" && url.pathname === "/fundir") {
      const yo = quienEs(req);
      if (!yo) return json(res, 401, { error: "Entra con tu PIN antes de fundir un libro." });
      let paquete;
      try { paquete = JSON.parse((await cuerpo(req)).toString("utf-8")); }
      catch { return json(res, 400, { error: "Ese archivo no es JSON." }); }
      const revisado = revisarPaquete(paquete);
      if (revisado.error) return json(res, 400, { error: revisado.error });

      const antes = leer();
      const { libro, nuevas, repetidas } = fundir(antes, revisado.libro);
      // Las pugnas se calculan ANTES de escribir: son la razon por la que uno funde, y
      // hay que poder decirlas con nombre y numero en vez de dejarlas enterradas.
      const pugnas = pugnasNuevas(antes, libro, conflictosDe);
      escribir(libro);
      console.log(`fundido: ${nuevas.length} nuevas, ${repetidas.length} repetidas, ${pugnas.length} pugnas nuevas`);
      return json(res, 200, {
        ok: true,
        de: paquete.exportadoPor?.nombre ?? "un equipo sin firmar",
        exportadoEl: paquete.exportadoEl ?? null,
        selloAusente: !!revisado.selloAusente,
        nuevas: nuevas.length,
        repetidas: repetidas.length,
        total: libro.length,
        pugnas: pugnas.map((c) => ({
          cliente: c.cliente, modalidad: c.modalidad, cantidades: c.cantidades,
          quienes: c.reportes.map((r) => ({ nombre: r.nombre, cantidad: r.cantidad })),
        })),
      });
    }
    if (req.method === "POST" && url.pathname === "/reiniciar") {
      // Se BORRA el archivo, no se vacia: asi leer() vuelve a sembrar el ejemplo y el
      // Cliente 360 recupera el conflicto. Un tablero vacio no demuestra nada.
      if (existsSync(ARCHIVO)) rmSync(ARCHIVO);
      leer();
      return json(res, 200, { ok: true });
    }
    json(res, 404, { error: "no existe" });
  } catch (e) {
    console.error(e);
    json(res, 500, { error: e?.message ?? String(e) });
  }
});

// HOST=0.0.0.0 abre el laboratorio a la red local (otra PC en el mismo wifi). Ojo: el
// micrófono del navegador solo funciona en localhost o HTTPS; para que otra persona
// grabe, hace falta un túnel HTTPS (cloudflared) o un certificado.
const HOST = process.env.HOST || "127.0.0.1";
servidor.listen(PUERTO, HOST, () => {
  console.log(`laboratorio en http://localhost:${PUERTO}`);
  if (HOST === "0.0.0.0") {
    const ips = Object.values(os.networkInterfaces()).flat().filter((i) => i && i.family === "IPv4" && !i.internal).map((i) => i.address);
    for (const ip of ips) console.log(`  en la red local: http://${ip}:${PUERTO}  (sin micrófono; para grabar hace falta HTTPS)`);
  }
});
