// Puntúa la lectura de placas contra la verdad conocida de placas/verdad.json, y deja
// el registro de rendimiento (carga, TTFT, tokens, throughput) que pide el reto Psy.
import { readFileSync, writeFileSync } from "node:fs";
import { loadModel, unloadModel, VISIONPSY_NANO_460M_MULTIMODAL_Q4_K_M_1, MMPROJ_VISIONPSY_NANO_460M_MULTIMODAL_Q8_0_1 } from "@qvac/sdk";
import { leerPlaca } from "./placa.mjs";
import { plano } from "./verificar.mjs";

const verdad = JSON.parse(readFileSync(new URL("./placas/verdad.json", import.meta.url), "utf-8"));
const ruta = (id) => new URL(`./placas/${id}.png`, import.meta.url).pathname.slice(1);

const t0 = Date.now();
const modelId = await loadModel({
  modelSrc: VISIONPSY_NANO_460M_MULTIMODAL_Q4_K_M_1,
  modelConfig: { ctx_size: 4096, projectionModelSrc: MMPROJ_VISIONPSY_NANO_460M_MULTIMODAL_Q8_0_1 },
});
const cargaMs = Date.now() - t0;
console.log(`VisionPsy-Nano-460M (q4_k_m + mmproj q8) cargado en ${(cargaMs / 1000).toFixed(1)} s\n`);

const registro = { modelo: "VisionPsy-Nano-460M", cuantizacion: "q4_k_m (+ mmproj q8_0)", cargaMs, placas: [] };
let ok = 0;
for (const p of verdad) {
  const r = await leerPlaca(modelId, ruta(p.id));
  const c = r.campos;
  const fallos = [];
  if (plano(c.marca) !== plano(p.marca)) fallos.push(`marca «${c.marca}»`);
  if (!plano(c.modelo).includes(plano(p.modelo)) && !plano(p.modelo).includes(plano(c.modelo))) fallos.push(`modelo «${c.modelo}»`);
  if (plano(c.serie) !== plano(p.serie)) fallos.push(`serie «${c.serie}»`);
  if (c.anioFabricacion !== p.anio) fallos.push(`año ${c.anioFabricacion}`);
  const pasa = fallos.length === 0; if (pasa) ok++;

  console.log(`${pasa ? "✅" : "❌"} ${p.id.padEnd(17)} ${String(r.ms).padStart(6)} ms  ${c.marca} · ${c.modelo} · SN ${c.serie || "—"} · ${c.anioFabricacion || "—"} (${c.edadAnios} años) · ${c.modalidad}`);
  if (!pasa) console.log(`   fallos: ${fallos.join("; ")}
   texto leido: ${JSON.stringify(r.textoLeido)}`);
  registro.placas.push({ id: p.id, ms: r.ms, campos: c, textoLeido: r.textoLeido, stats: r.stats, correcto: pasa });
}
console.log(`\nRESULTADO: ${ok}/${verdad.length} placas leídas sin un solo campo mal`);
const ttft = registro.placas.flatMap((x) => x.stats.map((s) => s.timeToFirstToken));
const tps = registro.placas.flatMap((x) => x.stats.map((s) => s.tokensPerSecond));
console.log(`TTFT medio ${(ttft.reduce((a, b) => a + b, 0) / ttft.length).toFixed(0)} ms · ${(tps.reduce((a, b) => a + b, 0) / tps.length).toFixed(1)} tok/s · ${registro.placas[0].stats[0].backendDevice}`);
writeFileSync(new URL("./placas/rendimiento.json", import.meta.url), JSON.stringify(registro, null, 2) + "\n");
console.log("registro de rendimiento en placas/rendimiento.json");
await unloadModel({ modelId, clearStorage: false });
