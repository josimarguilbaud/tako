// Version 4: el harness entra por el MISMO codigo que la app (extraerVerificado de
// extraer.mjs). Antes tenia su propia copia de SISTEMA y de la logica de repregunta,
// asi que durante horas midio un prompt que el laboratorio ya no usaba: el 10/11 no
// describia lo que corria. Un solo camino de codigo, o la medicion no vale.
// QMODEL=4b usa Qwen3 4B; por defecto 1.7B, que es el que arranca el servidor.
// Argumentos: numeros de prueba a correr.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { loadModel, unloadModel, QWEN3_4B_INST_Q4_K_M, QWEN3_1_7B_INST_Q4 } from "@qvac/sdk";
import { extraerVerificado, faltantesDe, preguntaDe, SISTEMA } from "./extraer.mjs";
import { plano } from "./verificar.mjs";

const ES_4B = process.env.QMODEL === "4b";
const MODELO = ES_4B ? QWEN3_4B_INST_Q4_K_M : QWEN3_1_7B_INST_Q4;
const pruebas = JSON.parse(readFileSync(new URL("./pruebas-philips.json", import.meta.url), "utf-8"));
const solo = process.argv[2] ? new Set(process.argv.slice(2).map(Number)) : null;

const t0 = Date.now();
const modelId = await loadModel({ modelSrc: MODELO });
const cargaMs = Date.now() - t0;
console.log(`modelo ${ES_4B ? "Qwen3 4B" : "Qwen3 1.7B"} cargado en ${(cargaMs / 1000).toFixed(1)} s\n`);

// Registro de rendimiento reproducible: modelo, cuantizacion, carga, prompt del sistema,
// tokens, TTFT y throughput por caso. Es lo que exige el reto Psy y lo que otro jurado
// puede repetir en su propia maquina.
const registro = { modelo: MODELO.name, archivo: MODELO.modelId, cuantizacion: MODELO.quantization, cargaMs, sistema: SISTEMA, casos: [] };

let ok = 0, total = 0, sumaMs = 0, totalDescartes = 0, totalAjustes = 0;
for (const p of pruebas) {
  if (solo && !solo.has(p.n)) continue;
  total++;
  let r;
  try {
    r = await extraerVerificado(modelId, p.entrada);
  } catch (e) {
    console.log(`#${p.n}  ERROR ${e?.message ?? e}\n`);
    continue;
  }
  const { json, descartes, ajustes, ms, stats } = r;
  sumaMs += ms; totalDescartes += descartes.length; totalAjustes += ajustes.length;
  registro.casos.push({ n: p.n, entrada: p.entrada, ms, stats });

  // El harness no prueba el emparejador de clientes (eso es clientes.mjs): da el
  // hospital por confirmado para que la repregunta sea la del equipo, no la del sitio.
  const pregunta = preguntaDe(faltantesDe({ ...json, clienteConfirmado: true }), p.entrada);

  // ---- puntuacion sobre el resultado verificado ----
  const fallos = [];
  const e = p.espera;
  const nucleo = plano(e.cliente).replace(/^(hospital|clinica|centro medico|instituto) /, "");
  if (e.cliente && !plano(json.cliente).includes(nucleo)) fallos.push(`cliente: «${json.cliente}»`);
  if (e.pais && !plano(json.pais).startsWith(plano(e.pais).slice(0, 5))) fallos.push(`pais: «${json.pais}»`);
  const suma = {};
  for (const q of json.equipos) suma[q.modalidad] = (suma[q.modalidad] ?? 0) + q.cantidad;
  for (const [mod, n] of Object.entries(e.equipos ?? {})) if (suma[mod] !== n) fallos.push(`${mod}: ${suma[mod] ?? "—"} (esperaba ${n})`);
  for (const mod of Object.keys(suma)) if (e.equipos?.[mod] === undefined) fallos.push(`${mod}: ${suma[mod]} (no esperaba ninguno)`);
  if (e.marca && !json.equipos.some((q) => plano(q.marca) === plano(e.marca))) fallos.push(`marca: ${JSON.stringify(json.equipos.map((q) => q.marca))}`);
  if (e.modelo === "Unknown" && !json.equipos.some((q) => plano(q.modelo) === "unknown")) fallos.push("modelo no marcado Unknown");
  if (e.edad && !json.equipos.some((q) => q.edadAnios === e.edad)) fallos.push(`edad: ${JSON.stringify(json.equipos.map((q) => q.edadAnios))} (esperaba ${e.edad})`);
  // Un calificativo ("very old", "mostly new") es el unico dato de edad que hay en esa
  // frase: si se pierde, Philips se queda sin el estado Estimado y sin la repregunta.
  if (e.edadCualitativa && !json.equipos.some((q) => plano(q.edadCualitativa).includes(plano(e.edadCualitativa)))) fallos.push(`edadCualitativa: ${JSON.stringify(json.equipos.map((q) => q.edadCualitativa))} (esperaba «${e.edadCualitativa}»)`);
  // Reparto por edad: "uno de los dos resonadores tiene 8 anos" son dos filas, no una
  // de dos unidades con la edad puesta a las dos. Philips pregunta por la que falta.
  if (e.filas) {
    const vistas = json.equipos.map((q) => `${q.modalidad}:${q.cantidad}:${q.edadAnios}`).sort().join(" ");
    const esperadas = [...e.filas].sort().join(" ");
    if (vistas !== esperadas) fallos.push(`filas: ${vistas} (esperaba ${esperadas})`);
  }

  const pasa = fallos.length === 0; if (pasa) ok++;
  const resumen = json.equipos.map((q) => `${q.modalidad}=${q.cantidad}${q.cantidadAproximada ? "~" : ""}${q.marca !== "Unknown" ? " " + q.marca : ""}${q.edadAnios ? " " + q.edadAnios + "a" : q.edadCualitativa ? " " + q.edadCualitativa : ""}`).join(" · ");
  console.log(`#${String(p.n).padStart(2)} ${pasa ? "✅" : "❌"} ${String(ms).padStart(5)} ms  ${json.cliente} | ${json.ciudad}/${json.pais} | ${resumen}`);
  console.log(`      pregunta: «${pregunta}»`);
  if (descartes.length) console.log(`      verificación descartó: ${descartes.join("; ")}`);
  if (ajustes.length) console.log(`      cantidades corregidas: ${ajustes.join("; ")}`);
  if (!pasa) console.log(`      fallos: ${fallos.join("; ")}`);
}
console.log(`\nRESULTADO: ${ok}/${total} pasan · ${Math.round(sumaMs / total)} ms de media · la verificación descartó ${totalDescartes} inventos y corrigió ${totalAjustes} cantidades`);
const ttft = registro.casos.map((c) => c.stats.timeToFirstToken);
const tps = registro.casos.map((c) => c.stats.tokensPerSecond);
console.log(`TTFT medio ${Math.round(ttft.reduce((a, b) => a + b, 0) / ttft.length)} ms · ${(tps.reduce((a, b) => a + b, 0) / tps.length).toFixed(1)} tok/s · ${registro.casos[0].stats.backendDevice}`);
mkdirSync(new URL("./rendimiento/", import.meta.url), { recursive: true });
writeFileSync(new URL("./rendimiento/texto.json", import.meta.url), JSON.stringify(registro, null, 2) + "\n");
console.log("registro de rendimiento en rendimiento/texto.json");
await unloadModel({ modelId });
