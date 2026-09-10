// Laboratorio de Tako. Junta en un solo proceso las piezas probadas por separado:
// voz -> texto (Whisper), texto -> JSON (Qwen3 con esquema), verificacion contra la
// frase, repregunta en codigo, guardado con procedencia, y el Cliente 360 que conserva
// los conflictos en vez de elegir un numero. Sin dependencias fuera de Node y QVAC.
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadModel, transcribe, WHISPER_BASE_Q8_0, WHISPER_SMALL_Q8_0, QWEN3_1_7B_INST_Q4, QWEN3_4B_INST_Q4_K_M, VISIONPSY_NANO_460M_MULTIMODAL_Q4_K_M_1, MMPROJ_VISIONPSY_NANO_460M_MULTIMODAL_Q8_0_1 } from "@qvac/sdk";
import { extraer, faltantesDe, preguntaDe } from "./extraer.mjs";
import { leerPlaca } from "./placa.mjs";
import { transcripcionSospechosa } from "./verificar.mjs";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const DATOS = path.join(DIR, "datos");
mkdirSync(DATOS, { recursive: true });
const ARCHIVO = path.join(DATOS, "observaciones.json");
const PUERTO = Number(process.env.PUERTO || 3210);
// Extracción: por defecto se cargan LOS DOS Qwen3. Se extrae con el 1.7B (rápido) y, si el
// verificador detecta que omitió un equipo mencionado, se reintenta con el 4B (fiable).
// QMODEL=4b usa solo el grande; QMODEL=1.7b usa solo el rápido.
const USA_4B = process.env.QMODEL === "4b";
const SOLO_RAPIDO = process.env.QMODEL === "1.7b";
// Voz: "small" por defecto. El "base" (81 MB) se equivoca con vocabulario técnico en
// español hablado real ("resornadores", "tomohorazo"); QVOZ=base lo vuelve a activar.
const VOZ_BASE = process.env.QVOZ === "base";
const NOMBRE_MODELO = `Whisper ${VOZ_BASE ? "base" : "small"} + Qwen3 ${USA_4B ? "4B" : SOLO_RAPIDO ? "1.7B" : "1.7B (→ 4B si omite algo)"}`;
// Glosario que sesga a Whisper hacia las palabras del dominio (nombres, modalidades).
const VOCABULARIO = "Hospital DemoCare Pacific, Clínica DemoCare Light, Centro Médico DemoCare Valley. Resonadores, resonancia magnética, tomógrafo, tomografía, ecógrafos, ultrasonido, rayos X, MR, CT. Marcas: NovaMed, Aurelia Health, Orion Imaging, HelixCare. En Panamá.";

// La primera vez, el laboratorio arranca con dos observaciones de ejemplo que NO coinciden
// en la cantidad de resonadores. Un Cliente 360 vacío no enseña lo único que hace distinto
// a esto: conservar el desacuerdo en vez de elegir un número. Se copian una sola vez; a
// partir de ahí son tuyas, y «Borrar todas las observaciones» las quita para siempre.
const EJEMPLO = path.join(DIR, "datos-ejemplo", "observaciones.json");
function leer() {
  if (!existsSync(ARCHIVO) && existsSync(EJEMPLO)) copyFileSync(EJEMPLO, ARCHIVO);
  return existsSync(ARCHIVO) ? JSON.parse(readFileSync(ARCHIVO, "utf-8")) : [];
}
const escribir = (obs) => writeFileSync(ARCHIVO, JSON.stringify(obs, null, 2));

// Cuales de las guardadas vinieron sembradas. Se sabe por su id, que es el del archivo
// de ejemplo: asi sigue funcionando aunque encima ya haya observaciones de verdad.
const IDS_SEMBRADOS = new Set(
  existsSync(EJEMPLO) ? JSON.parse(readFileSync(EJEMPLO, "utf-8")).map((o) => o.id) : []
);

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
    const total = {};
    for (const q of o.json.equipos) total[q.modalidad] = (total[q.modalidad] ?? 0) + q.cantidad;
    for (const [mod, n] of Object.entries(total)) {
      const filas = o.json.equipos.filter((q) => q.modalidad === mod);
      const m = (c.modalidades[mod] ??= { modalidad: mod, reportes: [] });
      m.reportes.push({
        id: o.id, observador: o.observador, fecha: o.fecha, fuente: o.fuente, texto: o.texto,
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
      for (const r of m.reportes) if (!ultimoPorObservador[r.observador] || r.fecha > ultimoPorObservador[r.observador].fecha) ultimoPorObservador[r.observador] = r;
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
      const ejemplos = obs.filter((o) => IDS_SEMBRADOS.has(o.id)).map((o) => o.id);
      return json(res, 200, { modelo: NOMBRE_MODELO, total: obs.length, ejemplos, resumen: resumen(obs) });
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
      const { observador, texto, fuente, json: datos } = JSON.parse((await cuerpo(req)).toString("utf-8"));
      if (!datos?.cliente) return json(res, 400, { error: "falta la observación" });
      const obs = leer();
      const nueva = { id: `OBS-${String(obs.length + 1).padStart(3, "0")}`, fecha: new Date().toISOString(), observador: observador?.trim() || "Sin nombre", fuente: fuente || "texto", texto, json: datos };
      obs.push(nueva); escribir(obs);
      return json(res, 200, { ok: true, id: nueva.id });
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
