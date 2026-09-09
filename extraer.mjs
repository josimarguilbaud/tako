// Extracción estructurada de una observación de campo (texto → JSON) con un
// modelo local vía QVAC, seguida de la verificación contra la propia frase.
// Compartido por el laboratorio y por el harness de las pruebas de Philips.
import { completion } from "@qvac/sdk";
import { verificar } from "./verificar.mjs";
import { emparejarCliente } from "./clientes.mjs";

export const MODALIDADES = ["MR", "CT", "Ultrasound", "X-Ray", "Patient Monitoring", "Image Guided Therapy", "Unknown"];

export const esquema = {
  type: "object",
  properties: {
    cliente: { type: "string" },
    ciudad: { type: "string" },
    pais: { type: "string" },
    equipos: {
      type: "array",
      items: {
        type: "object",
        properties: {
          modalidad: { type: "string", enum: MODALIDADES },
          cantidad: { type: "integer" },
          cantidadAproximada: { type: "boolean" },
          marca: { type: "string" },
          modelo: { type: "string" },
          edadAnios: { type: "integer" },
          edadCualitativa: { type: "string" },
        },
        required: ["modalidad", "cantidad", "cantidadAproximada", "marca", "modelo", "edadAnios", "edadCualitativa"],
      },
    },
  },
  required: ["cliente", "ciudad", "pais", "equipos"],
};

// Reglas tomadas de la hoja "Agent Question Logic" del reto de Philips.
export const SISTEMA = `You extract hospital equipment observations from a field colleague's message into JSON. Extract only what the message states; do not ask questions and do not infer.
Rules:
- cliente: the facility name exactly as written in the message (e.g. "Hospital DemoCare Pacific", "Clinica DemoCare Light"), with no surrounding words.
- ciudad / pais: ONLY from an explicit location phrase such as "in Panama", "en Panamá", "in São Paulo". A country name alone goes in pais. NEVER take a word from the facility name as a place. If there is no explicit location phrase, write "Unknown" for both.
- Modality synonyms: MRI/resonador(es) -> MR; scanner/tomógrafo/tomografía -> CT; ecógrafo/ultrasonido/ultrasound units -> Ultrasound.
- Quantity: exact number if stated. If approximate ("about", "maybe", "many", "unos", "roughly"), use the number given and set cantidadAproximada=true.
- Age: edadAnios MUST be a number that appears in the message ("eight" -> 8, "maybe ten" -> 10; a range 8-10 -> 9). If the message gives no number for that group, edadAnios = 0. NEVER invent a number.
- edadCualitativa: only a word the message uses for that group ("old", "new", "very old", "newer"); empty string if the message says nothing about age. If the message describes age with words and no number ("one very old CT", "mostly new", "recently installed"), you MUST copy that word here: it is the only age datum there is.
- One entry per modality with the total stated. Do NOT split a modality into several entries: if only some units have a stated age, put the age on that entry and let the count be the total. (verificar.mjs reparte esas filas después, leyendo el partitivo de la frase.)
- NEVER guess a brand or model: write "Unknown" unless the message states it. A brand stated for all units applies to each entry.
Output only JSON matching the schema.`;

// Modelo + verificación, sin la lista de clientes. El harness de las pruebas de Philips
// entra por aquí: un solo camino de código, para que el prompt que se mide sea el que corre.
export async function extraerVerificado(modelId, texto) {
  const t0 = Date.now();
  const run = completion({
    modelId,
    history: [{ role: "system", content: SISTEMA }, { role: "user", content: texto + " /no_think" }],
    responseFormat: { type: "json_schema", json_schema: { name: "observacion", strict: true, schema: esquema } },
    temperature: 0, max_tokens: 400, captureThinking: false,
  });
  const crudo = JSON.parse(await run.text);
  // stats trae TTFT, tokens y throughput: es el registro que pide el reto Psy.
  return { crudo, ...verificar(crudo, texto), ms: Date.now() - t0, stats: await run.stats };
}

export async function extraer(modelId, texto) {
  const { crudo, json, descartes, omisiones, aproximadas, ajustes, ms } = await extraerVerificado(modelId, texto);
  // Paso 1 de Philips: emparejar el nombre dicho con la lista de clientes. La ciudad y el
  // país de la lista se anotan como referencia (lugarDeLista), no como algo observado.
  const emparejado = json.cliente !== "Unknown" ? emparejarCliente(json.cliente) : null;
  // Sin coincidencia clara en la lista, el hospital queda como "dicho pero no confirmado":
  // es dato obligatorio (paso 1 de Philips) y pasa a ser lo primero que se pregunta.
  json.clienteConfirmado = !!emparejado;
  if (emparejado) {
    json.clienteDicho = json.cliente;
    json.cliente = emparejado.nombre;
    if (json.ciudad === "Unknown" && emparejado.ciudad) { json.ciudad = emparejado.ciudad; json.lugarDeLista = true; }
    if (json.pais === "Unknown" && emparejado.pais) { json.pais = emparejado.pais; json.lugarDeLista = true; }
  }
  return { crudo, json, descartes, omisiones, aproximadas, ajustes, emparejado, ms };
}

// ---------- repregunta en código: qué falta y qué preguntar primero ----------
const ES = { MR: "resonadores", CT: "tomógrafos", Ultrasound: "ecógrafos", "X-Ray": "equipos de rayos X", "Patient Monitoring": "monitores", "Image Guided Therapy": "equipos de terapia guiada por imagen", Unknown: "equipos" };
const EN = { MR: "MR systems", CT: "CT scanners", Ultrasound: "ultrasound units", "X-Ray": "X-ray systems", "Patient Monitoring": "patient monitors", "Image Guided Therapy": "image-guided therapy systems", Unknown: "systems" };
export const esEspanol = (t) => /[áéíóúñ¿¡]|\b(estoy|tienen|hay|unos|tomógrafo|resonador)/i.test(t);

export function faltantesDe(json) {
  const f = [];
  // El hospital es obligatorio: si no se confirmó contra la lista, se pregunta antes que nada.
  if (!json.clienteConfirmado) f.push({ que: "customer", dicho: json.cliente });
  for (const q of json.equipos ?? []) {
    if (q.marca === "Unknown") f.push({ que: "brand", mod: q.modalidad });
    if (q.edadAnios === 0 && !q.edadCualitativa) f.push({ que: "age", mod: q.modalidad });
    else if (q.edadAnios === 0) f.push({ que: "age_years", mod: q.modalidad, dicho: q.edadCualitativa });
    if (q.cantidadAproximada) f.push({ que: "quantity_confirmation", mod: q.modalidad, n: q.cantidad });
  }
  for (const q of json.equipos ?? []) if (q.modelo === "Unknown" && q.marca !== "Unknown") f.push({ que: "model", mod: q.modalidad });
  if (json.pais === "Unknown" && json.ciudad === "Unknown") f.push({ que: "city" });
  return f;
}

export function preguntaDe(faltantes, entrada) {
  const es = esEspanol(entrada);
  if (!faltantes.length) return es ? "Todo capturado. ¿Confirmas el resumen?" : "All captured. Can you confirm the summary?";
  const N = es ? ES : EN;
  const primero = faltantes[0];
  const mods = [...new Set(faltantes.filter((x) => x.que === primero.que).map((x) => x.mod))];
  const nombre = mods.map((m) => N[m]).join(es ? " y " : " and ");
  const faltaEdadTambien = faltantes.some((x) => x.que === "age" && mods.includes(x.mod));
  switch (primero.que) {
    case "customer": {
      const dicho = primero.dicho && primero.dicho !== "Unknown" ? primero.dicho : null;
      return es
        ? `¿En qué hospital o clínica estás exactamente?${dicho ? ` Entendí «${dicho}», pero no coincide con ningún cliente de la lista.` : ""}`
        : `Which hospital or clinic are you at exactly?${dicho ? ` I heard "${dicho}", but it does not match any customer on the list.` : ""}`;
    }
    case "brand": return es
      ? `¿Sabes la marca${faltaEdadTambien ? " y la antigüedad aproximada" : ""} de los ${nombre}?`
      : `Do you know the brand${faltaEdadTambien ? " and approximate age" : ""} of the ${nombre}?`;
    case "age": return es ? `¿Aproximadamente cuántos años tienen los ${nombre}?` : `Approximately how old are the ${nombre}?`;
    case "age_years": return es ? `Dijiste que los ${nombre} son «${primero.dicho}»: ¿cuántos años, más o menos?` : `You said the ${nombre} are "${primero.dicho}": roughly how many years is that?`;
    case "quantity_confirmation": return es ? `¿Son exactamente ${primero.n} ${nombre} o es un estimado?` : `Is it exactly ${primero.n} ${nombre}, or an estimate?`;
    case "model": return es ? `¿Conoces el modelo de los ${nombre}?` : `Do you know the model of the ${nombre}?`;
    case "city": return es ? "¿En qué ciudad está el hospital?" : "Which city is the hospital in?";
  }
}
