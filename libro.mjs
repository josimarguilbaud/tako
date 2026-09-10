// El libro, y cómo dos libros se hacen uno.
//
// Tako corría dentro del dispositivo, que no es lo mismo que ser descentralizado: lo que
// veía Marta se quedaba en la tablet de Marta y lo de Luis en la suya. El desacuerdo entre
// dos personas, que es la única cosa que Tako hace y nadie más hace, solo aparecía cuando
// las dos observaciones estaban en el mismo archivo. En campo no se habrían encontrado
// nunca.
//
// Aquí viven las reglas para que se encuentren sin servidor y sin nube: un libro se
// exporta a un archivo, el archivo viaja como quiera (USB, correo, el chat que sea) y el
// otro equipo lo funde con el suyo. La fusión es la UNIÓN de los dos, nunca una
// sustitución: no se pisa nada, no se pierde nada y el desacuerdo se conserva, que es
// exactamente lo que el Cliente 360 ya sabía hacer cuando los dos números estaban juntos.
import { createHash } from "node:crypto";

export const VERSION_LIBRO = 1;

// Serialización canónica: las claves ordenadas, siempre. JSON.stringify respeta el orden
// en que se insertaron, así que el mismo dato escrito por dos caminos distintos daría dos
// huellas distintas, y entonces la misma observación entraría dos veces al fundir.
export function canonico(v) {
  if (v === null || typeof v !== "object") return JSON.stringify(v ?? null);
  if (Array.isArray(v)) return `[${v.map(canonico).join(",")}]`;
  const claves = Object.keys(v).sort();
  return `{${claves.map((k) => `${JSON.stringify(k)}:${canonico(v[k])}`).join(",")}}`;
}

const sha = (s) => createHash("sha256").update(s, "utf-8").digest("hex");

// La identidad de una observación es su CONTENIDO, no el número que le tocó en el equipo
// donde nació. «OBS-003» en la tablet de Marta y «OBS-003» en la de Luis son dos cosas
// distintas; si la identidad fuera esa etiqueta, fundir dos libros perdería una de las
// dos. El uid sale de quién la firmó, cuándo, qué dijo y qué se extrajo.
export function uidDe(o) {
  return sha(canonico({
    observador: o?.observador?.uid ?? o?.observador?.id ?? o?.observador ?? null,
    fecha: o?.fecha ?? null,
    fuente: o?.fuente ?? null,
    texto: o?.texto ?? null,
    json: o?.json ?? null,
  })).slice(0, 16);
}

// Las observaciones guardadas antes de que existiera el uid se leen igual: se les calcula
// al vuelo y sale el mismo siempre, porque sale del contenido.
export const conUid = (obs) => (obs ?? []).map((o) => (o?.uid ? o : { ...o, uid: uidDe(o) }));

// La etiqueta OBS-NNN es DERIVADA, no es la identidad: se recalcula por orden de fecha
// cada vez que el libro se escribe. Así, después de fundir, el libro se lee 001, 002,
// 003… sin repetidos ni huecos, y nadie tiene que confiar en la numeración del otro.
export function etiquetar(obs) {
  return [...(obs ?? [])]
    .sort((a, b) => (a.fecha === b.fecha ? a.uid.localeCompare(b.uid) : a.fecha < b.fecha ? -1 : 1))
    .map((o, i) => ({ ...o, id: `OBS-${String(i + 1).padStart(3, "0")}` }));
}

// El sello dice que el libro llegó ENTERO, no quién lo escribió. Es integridad, no
// autoría: detecta un archivo cortado o cambiado por el camino, y nada más. Firmar de
// verdad cada observación es otra cosa y todavía no está hecha; decirlo importa, porque
// el argumento de esta app es saber de dónde salió cada número.
export const selloDe = (obs) => sha(canonico(conUid(obs).map((o) => o.uid).sort()));

// Lo que sale del equipo cuando alguien exporta su libro.
export function empaquetar(obs, quien, hoy = new Date()) {
  const libro = etiquetar(conUid(obs));
  return {
    formato: "tako-libro",
    version: VERSION_LIBRO,
    exportadoPor: quien ? { id: quien.id, uid: quien.uid ?? null, nombre: quien.nombre } : null,
    exportadoEl: hoy.toISOString(),
    observaciones: libro,
    sello: selloDe(libro),
  };
}

// Antes de fundir nada, comprobar que lo que llegó es un libro de Tako y que está entero.
export function revisarPaquete(p) {
  if (!p || typeof p !== "object" || p.formato !== "tako-libro") return { error: "Eso no es un libro de Tako." };
  if (p.version > VERSION_LIBRO) return { error: `Ese libro es de una versión más nueva (v${p.version}). Actualiza Tako antes de fundirlo.` };
  if (!Array.isArray(p.observaciones)) return { error: "Ese libro no trae observaciones." };
  const mal = p.observaciones.find((o) => !o?.fecha || !o?.json?.cliente);
  if (mal) return { error: "Ese libro trae una observación incompleta; no se funde a medias." };
  const libro = conUid(p.observaciones);
  if (p.sello && selloDe(libro) !== p.sello) {
    return { error: "El sello no cuadra: ese archivo cambió después de exportarse. No se funde." };
  }
  return { libro, selloAusente: !p.sello };
}

// Fundir es UNIR, nunca sustituir. Si el uid ya está, la observación es la misma y no
// entra dos veces; si no está, entra tal cual, con la firma de quien la levantó. Ninguna
// se modifica y ninguna se descarta. Da igual el orden en que lleguen los libros y da
// igual cuántas veces se funda el mismo: el resultado es el mismo.
export function fundir(mias, ajenas) {
  const propio = conUid(mias);
  const tengo = new Set(propio.map((o) => o.uid));
  const nuevas = [];
  const repetidas = [];
  for (const o of conUid(ajenas)) {
    if (tengo.has(o.uid)) { repetidas.push(o.uid); continue; }
    tengo.add(o.uid);
    nuevas.push(o);
  }
  return { libro: etiquetar([...propio, ...nuevas]), nuevas, repetidas };
}

// Qué desacuerdos ABRIÓ la fusión: los que no existían en el libro propio y existen en el
// fundido. Es la razón de fundir, así que se dice con nombre y número en vez de dejarlo
// enterrado en una tabla.
export function pugnasNuevas(antes, despues, conflictosDe) {
  const clave = (c) => `${c.cliente}|${c.modalidad}`;
  const ya = new Set(conflictosDe(antes).map(clave));
  return conflictosDe(despues).filter((c) => !ya.has(clave(c)));
}
