// Verificación determinista contra la transcripción. El modelo propone; el código
// comprueba que cada dato "duro" (números, lugares, marcas, modelos, calificativos
// de edad, y las propias modalidades) esté de verdad en lo que la persona dijo. Lo
// que no está se descarta y se anota, así "no inventar" es una propiedad del sistema
// y no una esperanza del prompt. Esto es código del producto: el harness solo lo usa.

const PALABRAS = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, twenty: 20,
  un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8,
  nueve: 9, diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, veinte: 20,
};

// Calificativos de edad: el modelo los devuelve en inglés; la frase puede venir en español.
const EQUIVALENTES = {
  old: ["old", "viejo", "vieja", "viejos", "viejas", "antiguo", "antigua", "antiguos"],
  new: ["new", "nuevo", "nueva", "nuevos", "nuevas", "reciente", "recientes"],
  newer: ["newer", "mas nuevo", "mas nueva", "mas reciente"],
  older: ["older", "mas viejo", "mas vieja", "mas antiguo"],
  very: ["very", "muy"],
  mixed: ["mixed", "mixto", "mixtos", "mezcla", "distintas", "diferentes"],
  recent: ["recent", "recently", "reciente", "recientemente"],
};

// Cómo se nombra cada modalidad en una frase, en español o en inglés.
const MENCIONES = {
  MR: /\b(mri?|resonador(es)?|resonancia|magnetic)\b/,
  CT: /\b(cts?|tomograf\w*|scanners?|tac)\b/,
  Ultrasound: /\b(ultrasound|ultrasonido|ecograf\w*)\b/,
  "X-Ray": /\b(x-?ray|rayos x|radiograf\w*)\b/,
  "Patient Monitoring": /\bmonitor\w*\b/,
  "Image Guided Therapy": /\b(image[- ]guided|angiograf\w*|terapia guiada)\b/,
};

// Minúsculas, sin acentos y sin puntuación: "Pacific, en Panamá." -> "pacific en panama".
export const plano = (s) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[.,;:!?¿¡"«»()]+/g, " ").replace(/\s+/g, " ").trim();

// Distancia de edición, para tolerar erratas del transcriptor ("resornadores", "tomohorazo").
function distancia(a, b) {
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
}
const RAICES = {
  MR: ["resonador", "resonadores", "resonancia"],
  CT: ["tomografo", "tomografos", "tomografia", "scanner", "scanners"],
  Ultrasound: ["ecografo", "ecografos", "ultrasonido", "ultrasound"],
  "X-Ray": ["radiografia", "radiografias"],
  "Patient Monitoring": ["monitores"],
  "Image Guided Therapy": ["angiografo", "angiografia"],
};
// ¿La frase (ya plana) menciona esta modalidad? Primero exacto; si no, una palabra larga
// a distancia corta de una raíz conocida. Devuelve la palabra que coincidió, o null.
export function mencionaModalidad(mod, textoPlano) {
  if (MENCIONES[mod]?.test(textoPlano)) return { exacta: true };
  for (const w of textoPlano.split(" ")) {
    if (w.length < 7) continue;
    const tope = w.length >= 10 ? 3 : 2;
    for (const raiz of RAICES[mod] ?? []) if (distancia(w, raiz) <= tope) return { exacta: false, palabra: w, raiz };
  }
  return null;
}

const escaparRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Qué números de la frase son EDADES. No basta con que el número esté ahí: "dos
// resonadores, dos parecen viejos" no dice que tengan dos años, y "about six ultrasound
// units" no dice seis años. Un número es una edad solo si lo sigue la palabra año(s).
const ANIO = /^(anos?|years?|ans)$/;
export function edadesEn(texto) {
  const tok = plano(texto).split(/[\s-]+/);
  const set = new Set();
  for (let i = 0; i < tok.length; i++) {
    const n = /^\d+$/.test(tok[i]) ? Number(tok[i]) : PALABRAS[tok[i]];
    if (n === undefined) continue;
    for (let j = i + 1; j <= i + 3 && j < tok.length; j++) {
      if (ANIO.test(tok[j])) { set.add(n); break; }
    }
  }
  // Un rango "8-10 años" también vale por su punto medio (9).
  for (const m of plano(texto).matchAll(/(\d+)\s*[-–]\s*(\d+)\s+(anos?|years?)/g)) set.add(Math.round((Number(m[1]) + Number(m[2])) / 2));
  return set;
}

// Un lugar cuenta solo si la frase lo introduce como lugar: "in Panama", "en Panamá",
// "in São Paulo". Una palabra dentro del nombre del hospital no es un lugar.
export function esLugarExplicito(texto, lugar) {
  const l = plano(lugar);
  if (!l || l === "unknown") return false;
  return new RegExp(`\\b(in|en|at|de)\\s+(la\\s+ciudad\\s+de\\s+|the\\s+city\\s+of\\s+)?${escaparRegex(l)}\\b`).test(plano(texto));
}

function calificativoPresente(calificativo, textoPlano) {
  const palabras = plano(calificativo).split(/\s+/).filter((w) => w.length > 2);
  if (!palabras.length) return false;
  return palabras.every((w) => (EQUIVALENTES[w] ?? [w]).some((alt) => textoPlano.includes(alt)));
}

// Omisiones: el verificador solo puede descartar lo que SÍ está; esto avisa de lo que
// la frase menciona y el modelo dejó fuera. Es aviso, no corrección: no se inventa la fila.
export function omisionesEn(json, texto) {
  const t = plano(texto);
  const presentes = new Set((json.equipos ?? []).map((q) => q.modalidad));
  return Object.keys(MENCIONES)
    .filter((mod) => !presentes.has(mod) && mencionaModalidad(mod, t))
    .map((mod) => `la frase menciona ${mod} y el modelo no lo extrajo`);
}

// ¿Qué modalidad nombra esta palabra suelta? Exacto primero; si no, erratas del
// transcriptor a distancia corta de una raíz conocida ("tomografón" ≈ tomógrafo).
function modalidadDeToken(tok) {
  for (const [mod, re] of Object.entries(MENCIONES)) if (re.test(tok)) return mod;
  if (tok.length >= 7) {
    const tope = tok.length >= 10 ? 3 : 2;
    for (const [mod, raices] of Object.entries(RAICES)) {
      for (const raiz of raices) if (distancia(tok, raiz) <= tope) return mod;
    }
  }
  return null;
}

// Cuántas unidades de cada modalidad dice la frase: "dos resonadores y un tomógrafo"
// -> { MR: 2, CT: 1 }. Un número cuenta si va hasta tres palabras antes del equipo
// ("one recently installed MR"). Se ignora el partitivo: "uno de los resonadores" NO
// dice cuántos hay, habla de uno de ellos. Si no hay número pegado a la modalidad
// ("many ultrasound systems, maybe eight"), esa modalidad no se devuelve: sin lectura
// clara, el código no corrige nada.
export function cantidadesEn(texto) {
  const tok = plano(texto).split(" ");
  const out = {};
  for (let i = 0; i < tok.length; i++) {
    const n = /^\d+$/.test(tok[i]) ? Number(tok[i]) : PALABRAS[tok[i]];
    if (!n) continue;
    if (tok[i + 1] === "de" || tok[i + 1] === "of") continue;
    for (let j = i + 1; j <= i + 3 && j < tok.length; j++) {
      const mod = modalidadDeToken(tok[j]);
      if (mod) {
        if (out[mod] === undefined) out[mod] = n;
        break;
      }
    }
  }
  return out;
}

// Palabras de edad sin número: "one very old CT", "mostly new", "recently installed MR".
// Es el único dato de antigüedad que da esa frase, y es lo que Philips guarda como
// Estimado. El modelo se las salta la mitad de las veces; la frase no.
const CALIFICATIVOS = new Set(["old", "new", "newer", "older", "recent", "recently", "viejo", "vieja", "viejos", "viejas", "antiguo", "antigua", "antiguos", "nuevo", "nueva", "nuevos", "nuevas", "reciente", "recientes"]);
const INTENSIFICADORES = new Set(["very", "muy", "much", "mostly", "quite"]);
export function calificativosEn(texto) {
  const tok = plano(texto).split(" ");
  const out = {};
  for (let i = 0; i < tok.length; i++) {
    if (!CALIFICATIVOS.has(tok[i])) continue;
    // "ten years old" es una edad en números, no un calificativo: ya la lee edadesEn.
    if (ANIO.test(tok[i - 1] ?? "")) continue;
    const palabra = INTENSIFICADORES.has(tok[i - 1] ?? "") ? `${tok[i - 1]} ${tok[i]}` : tok[i];
    let mejor = null, cerca = Infinity;
    for (let j = Math.max(0, i - 4); j <= i + 4 && j < tok.length; j++) {
      const mod = modalidadDeToken(tok[j]);
      if (!mod) continue;
      const d = Math.abs(j - i);
      if (d < cerca) { cerca = d; mejor = mod; }
    }
    if (mejor && out[mejor] === undefined) out[mejor] = palabra;
  }
  return out;
}

// ¿De qué modalidades habla la frase en partitivo? "Uno de los resonadores tiene ocho
// años" dice que UNA unidad tiene esa edad, no las dos. Philips quiere justo eso: saber
// a cuál le falta el dato para preguntarlo. Repartir así es aritmética, no lenguaje, y
// un modelo de 1.7B la falla; el código no.
export function partitivosEn(texto) {
  const tok = plano(texto).split(" ");
  const out = new Set();
  for (let i = 0; i < tok.length; i++) {
    if (tok[i] !== "uno" && tok[i] !== "una" && tok[i] !== "one") continue;
    if (tok[i + 1] !== "de" && tok[i + 1] !== "of") continue;
    for (let j = i + 2; j <= i + 5 && j < tok.length; j++) {
      const mod = modalidadDeToken(tok[j]);
      if (mod) { out.add(mod); break; }
    }
  }
  return out;
}

// Una transcripción que no es voz: Whisper, ante silencio o ruido, se inventa subtítulos
// de YouTube o repite una frase. Se detecta antes de gastar una extracción en basura.
const FRASES_ALUCINADAS = /(subscribe to (our|the|my) channel|thanks? (you )?for watching|see you in the next video|like and subscribe|suscr[ií]b(e|ete|anse)|amara\.org|subt[ií]tulos (realizados|por)|www\.|gracias por ver)/i;
export function transcripcionSospechosa(texto) {
  const t = String(texto ?? "").trim();
  if (t.split(/\s+/).filter(Boolean).length < 3) return "la transcripción está casi vacía: parece que el micrófono no captó voz";
  if (FRASES_ALUCINADAS.test(t)) return "el texto parece inventado por el transcriptor ante silencio o ruido (frases típicas de subtítulos de video)";
  const frases = plano(t).split(/[.!?]+/).map((s) => s.trim()).filter((s) => s.length > 12);
  const conteo = {};
  for (const f of frases) conteo[f] = (conteo[f] ?? 0) + 1;
  if (Object.values(conteo).some((n) => n >= 3)) return "la misma frase se repite varias veces: típico de una grabación sin voz";
  return null;
}

export function verificar(json, texto) {
  const descartes = [], aproximadas = [];
  const t = plano(texto);
  const edades = edadesEn(texto);
  const out = { ...json, equipos: [] };

  for (const q0 of json.equipos ?? []) {
    const q = { ...q0 };
    // La modalidad tiene que estar mencionada en la frase; si no, la fila entera es invento.
    // Se toleran erratas del transcriptor ("resornadores" ≈ resonadores), y se anotan.
    const mencion = mencionaModalidad(q.modalidad, t);
    if (!mencion) {
      descartes.push(`fila ${q.modalidad} (${q.cantidad}): la frase no menciona ese equipo`);
      continue;
    }
    if (!mencion.exacta) aproximadas.push(`«${mencion.palabra}» se tomó como ${q.modalidad} (≈ ${mencion.raiz})`);
    if (q.edadAnios > 0 && !edades.has(q.edadAnios)) {
      descartes.push(`edad ${q.edadAnios} (${q.modalidad}): la frase no lo da como años`);
      q.edadAnios = 0;
    }
    if (q.marca && plano(q.marca) !== "unknown" && !t.includes(plano(q.marca))) {
      descartes.push(`marca «${q.marca}»: no está en la frase`);
      q.marca = "Unknown";
    }
    if (q.modelo && plano(q.modelo) !== "unknown" && !t.includes(plano(q.modelo))) {
      descartes.push(`modelo «${q.modelo}»: no está en la frase`);
      q.modelo = "Unknown";
    }
    if (q.edadCualitativa && !calificativoPresente(q.edadCualitativa, t)) {
      descartes.push(`edad «${q.edadCualitativa}» (${q.modalidad}): no está en la frase`);
      q.edadCualitativa = "";
    }
    out.equipos.push(q);
  }
  // La cantidad es el otro dato duro de la frase, y era el único que nadie comprobaba:
  // el modelo reparte las unidades entre filas y a veces pierde la cuenta o la modalidad
  // ("dos resonadores y un tomógrafo" -> MR 1, CT 1, CT 1). Aquí manda lo que dijo la
  // persona. El código no inventa datos: impone la cuenta que él mismo lee en la frase.
  const ajustes = [];
  for (const [mod, total] of Object.entries(cantidadesEn(texto))) {
    const filas = out.equipos.filter((q) => q.modalidad === mod);
    const suma = filas.reduce((s, q) => s + q.cantidad, 0);
    if (suma === total) continue;
    if (suma < total) {
      // Las unidades que faltan van a una fila sin edad: atribuirles la edad de otra
      // fila sería inventar. Si no hay ninguna, se crea.
      const sinEdad = filas.find((q) => !q.edadAnios && !q.edadCualitativa);
      if (sinEdad) sinEdad.cantidad += total - suma;
      else {
        const marca = filas.length && filas.every((q) => q.marca === filas[0].marca) ? filas[0].marca : "Unknown";
        const nueva = { modalidad: mod, cantidad: total - suma, cantidadAproximada: false, marca, modelo: "Unknown", edadAnios: 0, edadCualitativa: "" };
        const pos = out.equipos.map((q) => q.modalidad).lastIndexOf(mod);
        if (pos === -1) out.equipos.push(nueva); else out.equipos.splice(pos + 1, 0, nueva);
      }
      ajustes.push(suma === 0
        ? `${mod}: la frase dice ${total} y el modelo no extrajo ninguno; el código añade la fila`
        : `${mod}: la frase dice ${total} y el modelo extrajo ${suma}; el código añade ${total - suma}`);
    } else {
      // Sobran unidades: se quitan primero de las filas sin edad, que son las duplicadas.
      let sobra = suma - total;
      const orden = [...filas.filter((q) => !q.edadAnios && !q.edadCualitativa).reverse(),
                     ...filas.filter((q) => q.edadAnios || q.edadCualitativa).reverse()];
      for (const q of orden) {
        if (!sobra) break;
        const quita = Math.min(sobra, q.cantidad);
        q.cantidad -= quita;
        sobra -= quita;
      }
      out.equipos = out.equipos.filter((q) => q.cantidad > 0);
      ajustes.push(`${mod}: la frase dice ${total} y el modelo extrajo ${suma}; el código quita ${suma - total}`);
    }
  }

  // Un calificativo que la frase da y el modelo se dejó: se recupera, nunca se pisa lo
  // que el modelo sí extrajo, y solo va a filas que se quedaron sin ningún dato de edad.
  const califs = calificativosEn(texto);
  for (const q of out.equipos) {
    if (q.edadAnios || q.edadCualitativa || !califs[q.modalidad]) continue;
    q.edadCualitativa = califs[q.modalidad];
    ajustes.push(`${q.modalidad}: la frase dice «${q.edadCualitativa}» y el modelo no lo extrajo; el código lo recupera`);
  }

  // Una vez cuadran las cantidades, el partitivo separa la unidad con edad de las demás:
  // "dos resonadores, uno de ocho años" son 1 de 8 años + 1 de edad desconocida.
  for (const mod of partitivosEn(texto)) {
    const filas = out.equipos.filter((q) => q.modalidad === mod);
    const conEdad = filas.filter((q) => q.edadAnios || q.edadCualitativa);
    if (conEdad.length !== 1 || conEdad[0].cantidad < 2) continue;
    const q = conEdad[0];
    const resto = { ...q, cantidad: q.cantidad - 1, edadAnios: 0, edadCualitativa: "" };
    q.cantidad = 1;
    out.equipos.splice(out.equipos.indexOf(q) + 1, 0, resto);
    ajustes.push(`${mod}: «uno de los…» habla de una unidad; el código separa la que tiene edad de las otras ${resto.cantidad}`);
  }

  for (const campo of ["ciudad", "pais"]) {
    const v = out[campo];
    if (v && plano(v) !== "unknown" && !esLugarExplicito(texto, v)) {
      descartes.push(`${campo} «${v}»: no viene como lugar en la frase`);
      out[campo] = "Unknown";
    }
  }
  // El nombre del hospital también tiene que salir de la frase, no de la imaginación.
  if (out.cliente && plano(out.cliente) !== "unknown") {
    const nucleo = plano(out.cliente).replace(/^(hospital|clinica|centro medico|instituto)\s+/, "");
    if (nucleo.length > 2 && !t.includes(nucleo)) {
      descartes.push(`cliente «${out.cliente}»: no está en la frase`);
      out.cliente = "Unknown";
    }
  }
  return { json: out, descartes, omisiones: omisionesEn(out, texto), aproximadas, ajustes };
}
