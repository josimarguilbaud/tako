// Lectura de la placa de identificación de un equipo con VisionPsy-Nano-460M (modelo
// Psy de QVAC, 460M + proyector multimodal), todo en el dispositivo.
//
// Por qué existe: la voz casi nunca da marca ni modelo. El colaborador dice "dos
// resonadores" y esos campos quedan en Unknown para siempre. La placa los tiene
// impresos, y además trae la FECHA DE FABRICACIÓN: una edad exacta en vez de "parece
// de unos ocho años". Esa fila deja de ser Estimada y pasa a Confirmada.
//
// Cómo: dos preguntas cortas, no una larga. Medido el 9 sep sobre 4 placas: preguntarle
// "lee todo" se come la cabecera (pierde la marca en 3 de 4) o se come los valores de
// las filas. Una pregunta por bloque acierta 4 de 4 en ambos. Un modelo de 460M
// responde bien a preguntas concretas y mal a encargos amplios.
import { completion } from "@qvac/sdk";
import { plano } from "./verificar.mjs";

export const PREGUNTA_CABECERA = "What manufacturer brand name and what product name are printed on this nameplate? Answer with two lines: the brand, then the product name.";
export const PREGUNTA_FILAS = "This is the identification nameplate of a medical imaging system. Transcribe every line of text exactly as printed, one line per row. Do not explain, do not add anything.";

// Fabricantes de imagen médica conocidos. La marca leída se ancla aquí: así una errata
// del modelo ("PHIUPS", "Siemens Healthineers" en minúsculas) sigue cayendo en el mismo
// cliente del CRM en vez de crear una marca nueva por cada foto.
export const FABRICANTES = [
  "Philips", "GE HealthCare", "Siemens Healthineers", "Canon Medical", "Hitachi",
  "Fujifilm", "Mindray", "Samsung Medison", "Toshiba", "Esaote", "Carestream",
  "Shimadzu", "Agfa", "Konica Minolta", "United Imaging", "Neusoft",
  // Marcas de la hoja de pruebas de Philips, para que el laboratorio case con ellas.
  "Orion Imaging", "Aurelia Health",
];

const distancia = (a, b) => {
  const f = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = f[0]; f[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = f[j];
      f[j] = Math.min(f[j] + 1, f[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return f[b.length];
};

// VisionPsy razona en voz alta; el bloque <think> no es texto de la placa.
export const sinPensamiento = (t) => String(t ?? "").replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

// La marca leída, anclada a la lista. Se compara token a token con tolerancia a erratas
// cortas: "GE" basta para GE HealthCare, "Philips," para Philips.
export function anclarFabricante(texto) {
  const t = plano(texto);
  const palabras = t.split(/[\s,;.]+/).filter(Boolean);
  for (const f of FABRICANTES) {
    const primera = plano(f).split(" ")[0];
    if (palabras.some((w) => w === primera)) return f;
  }
  for (const f of FABRICANTES) {
    const primera = plano(f).split(" ")[0];
    if (primera.length < 5) continue;
    // "PHIUPS" por PHILIPS son dos ediciones: una letra de más y otra cambiada. Se exige
    // además que la palabra tenga un largo parecido, para no casar cualquier cosa.
    const tope = primera.length >= 7 ? 2 : 1;
    if (palabras.some((w) => Math.abs(w.length - primera.length) <= 2 && distancia(w, primera) <= tope)) return f;
  }
  return null;
}

// Etiquetas de placa en inglés, español y alemán (las tres que se ven en Latinoamérica).
// El número de serie va aparte porque "SERIAL NO" lleva una palabra de relleno entre la
// etiqueta y el valor, y VisionPsy a veces la pega al valor ("SERIAL NOGE-99213"): el
// «NO» se traga explícitamente detrás de «serial», nunca detrás de «SN», donde un
// número de serie sí podría empezar por esas letras.
const ETIQUETAS = {
  serieCorta: /\b(?:sn|s\/n|serie|nr|no\.?\s*de\s*serie)\b[\s:.]*([A-Za-z0-9][A-Za-z0-9-]{3,})/i,
  serieLarga: /\bserial\b[\s:.]*(?:(?:no|number|n[ºo°])[\s:.]*)?([A-Za-z0-9][A-Za-z0-9-]{3,})/i,
  modelo: /\b(?:model|modelo|type|tipo|typ|ref|cat\.?\s*no)\b[\s:.]*([A-Za-z0-9][A-Za-z0-9.-]{2,})/i,
  fecha: /\b(?:mfg\s*date|date\s*of\s*mfg|manufactur\w*|baujahr|fecha\s*de\s*fabricaci\w*|fab)\b[\s:.]*((?:19|20)\d{2})/i,
};

// Modalidad desde datos físicos impresos, no desde una lista de nombres comerciales:
// los teslas solo existen en resonancia, y "CT"/"TC" va escrito. Lo demás queda Unknown
// y lo pregunta el sistema. No se adivina por el nombre del producto.
export function modalidadDePlaca(texto) {
  const t = plano(texto);
  if (/\b\d(\.\d)?\s*t\b/.test(t) || /\btesla\b/.test(t)) return "MR";
  if (/\bct\b/.test(t) || /\btc\b/.test(t) || /\btomograf/.test(t)) return "CT";
  if (/\bultrasound\b|\becograf/.test(t)) return "Ultrasound";
  return "Unknown";
}

// El código parsea; el modelo solo transcribe. Todo campo devuelto está literalmente en
// el texto leído, igual que en la ruta de voz: el modelo propone, el código comprueba.
export function camposDePlaca(cabecera, filas) {
  const todo = `${cabecera}\n${filas}`;
  const lineas = sinPensamiento(cabecera).split(/[\n,]/).map((l) => l.trim()).filter(Boolean);

  const marca = anclarFabricante(cabecera) ?? anclarFabricante(filas);
  // El nombre comercial es lo que queda de la cabecera al quitar la marca ENTERA. Con
  // solo la primera palabra, "GE HealthCare" dejaba "HealthCare" como nombre de producto.
  const partes = marca ? plano(marca).split(" ").map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) : [];
  let modeloComercial = "";
  for (const l of lineas) {
    let resto = l;
    for (const parte of partes) resto = resto.replace(new RegExp(`\\b${parte}\\b`, "ig"), " ");
    resto = resto.replace(/\s+/g, " ").replace(/^[,;:.\-\s]+|[,;:.\-\s]+$/g, "").trim();
    if (resto.length > 2) { modeloComercial = resto; break; }
  }

  const mSerie = ETIQUETAS.serieCorta.exec(filas) ?? ETIQUETAS.serieLarga.exec(filas);
  const mModelo = ETIQUETAS.modelo.exec(filas);
  const mFecha = ETIQUETAS.fecha.exec(filas);
  const anio = mFecha ? Number(mFecha[1]) : 0;

  return {
    marca: marca ?? "Unknown",
    marcaLeida: lineas[0] ?? "",
    modelo: modeloComercial || "Unknown",
    modeloCatalogo: mModelo ? mModelo[1] : "",
    serie: mSerie ? mSerie[1] : "",
    anioFabricacion: anio,
    // La edad deja de ser una estimación de la persona: sale de la fecha impresa.
    edadAnios: anio ? Math.max(0, new Date().getFullYear() - anio) : 0,
    modalidad: modalidadDePlaca(todo),
  };
}

export async function leerPlaca(modelId, rutaImagen) {
  const t0 = Date.now();
  const pase = async (prompt) => {
    const r = completion({
      modelId,
      history: [{ role: "user", content: prompt, attachments: [{ path: rutaImagen }] }],
      temperature: 0, max_tokens: 220, captureThinking: false,
    });
    const texto = sinPensamiento(await r.text);
    return { texto, stats: await r.stats };
  };
  const cabecera = await pase(PREGUNTA_CABECERA);
  const filas = await pase(PREGUNTA_FILAS);
  return {
    campos: camposDePlaca(cabecera.texto, filas.texto),
    textoLeido: `${cabecera.texto}\n${filas.texto}`.trim(),
    ms: Date.now() - t0,
    stats: [cabecera.stats, filas.stats],
  };
}
