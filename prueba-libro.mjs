// Pruebas de la fusión de libros. Todo determinista: ningún modelo, milisegundos.
import { canonico, uidDe, conUid, etiquetar, selloDe, empaquetar, revisarPaquete, fundir, pugnasNuevas, VERSION_LIBRO } from "./libro.mjs";
import { conflictosDe } from "./tecnicos.mjs";

let ok = 0, fallo = 0;
const igual = (nombre, a, b) => {
  const x = JSON.stringify(a), y = JSON.stringify(b);
  if (x === y) { ok++; console.log(`  ok   ${nombre}`); }
  else { fallo++; console.log(`  FALLA ${nombre}\n        dio      ${x}\n        esperaba ${y}`); }
};

const eq = (modalidad, cantidad) => ({ modalidad, cantidad, cantidadAproximada: false, marca: "Unknown", modelo: "Unknown", edadAnios: 0, edadCualitativa: "" });
const obs = (etiqueta, quien, fecha, cliente, equipos, texto = "") => ({
  id: etiqueta, fecha, observador: quien, fuente: "voz", texto,
  json: { cliente, ciudad: "Panamá", pais: "Panamá", equipos },
});
const MARTA = { id: "T-01", uid: "u-marta", nombre: "Marta Gómez", verificado: true };
const LUIS = { id: "T-02", uid: "u-luis", nombre: "Luis Ortega", verificado: true };

// ---------------------------------------------------------------- canónico
console.log("canonico: la misma cosa da el mismo texto, escríbase como se escriba");
igual("el orden de las claves no importa", canonico({ b: 1, a: 2 }), canonico({ a: 2, b: 1 }));
igual("y en lo anidado tampoco", canonico({ x: { z: 1, y: 2 } }), canonico({ x: { y: 2, z: 1 } }));
igual("el orden del array SÍ importa", canonico([1, 2]) === canonico([2, 1]), false);
igual("null y undefined se escriben igual", canonico(null), canonico(undefined));
igual("los tipos no se confunden", canonico("1") === canonico(1), false);

// ---------------------------------------------------------------- uid
console.log("\nuidDe: la identidad sale del contenido, no del número que le tocó");
const a1 = obs("OBS-001", MARTA, "2026-09-03T14:00:00.000Z", "Hospital DemoCare Pacific", [eq("MR", 2)], "Dos resonadores.");
const a2 = { ...a1, id: "OBS-047" };
igual("la etiqueta no cambia el uid", uidDe(a1), uidDe(a2));
igual("son 16 hex", /^[0-9a-f]{16}$/.test(uidDe(a1)), true);
igual("otra persona, otro uid", uidDe(a1) === uidDe({ ...a1, observador: LUIS }), false);
igual("otra hora, otro uid", uidDe(a1) === uidDe({ ...a1, fecha: "2026-09-03T14:00:01.000Z" }), false);
igual("otro número, otro uid", uidDe(a1) === uidDe({ ...a1, json: { ...a1.json, equipos: [eq("MR", 3)] } }), false);
igual("el mismo dato dos veces da lo mismo", uidDe(a1), uidDe(JSON.parse(JSON.stringify(a1))));
// Dos equipos numerando por su cuenta: mismas etiquetas, observaciones distintas.
const choque = obs("OBS-001", LUIS, "2026-09-05T10:00:00.000Z", "Clínica DemoCare Light", [eq("CT", 1)]);
igual("dos OBS-001 de dos equipos NO son la misma", uidDe(a1) === uidDe(choque), false);

console.log("\nconUid: lo guardado antes de que existiera el uid se lee igual");
igual("se lo calcula al vuelo", conUid([a1])[0].uid, uidDe(a1));
igual("y no se lo cambia si ya lo trae", conUid([{ ...a1, uid: "yaLoTenia" }])[0].uid, "yaLoTenia");
igual("una lista vacía no rompe", conUid([]), []);
igual("sin lista tampoco", conUid(undefined), []);

// ---------------------------------------------------------------- etiquetas
console.log("\netiquetar: la etiqueta es derivada, se recalcula por fecha");
const desordenado = conUid([
  obs("OBS-009", LUIS, "2026-09-05T10:00:00.000Z", "Clínica DemoCare Light", [eq("CT", 1)]),
  obs("OBS-002", MARTA, "2026-09-03T14:00:00.000Z", "Hospital DemoCare Pacific", [eq("MR", 2)]),
]);
const puestas = etiquetar(desordenado);
igual("la más vieja es la 001", [puestas[0].id, puestas[0].observador.nombre], ["OBS-001", "Marta Gómez"]);
igual("y no quedan huecos ni repetidas", puestas.map((o) => o.id), ["OBS-001", "OBS-002"]);
igual("etiquetar dos veces da lo mismo", etiquetar(puestas).map((o) => o.id), puestas.map((o) => o.id));
// Dos observaciones exactamente a la misma hora: el desempate tiene que ser estable.
const gemelas = conUid([
  obs("A", MARTA, "2026-09-05T10:00:00.000Z", "H1", [eq("MR", 1)]),
  obs("B", LUIS, "2026-09-05T10:00:00.000Z", "H2", [eq("CT", 1)]),
]);
igual("misma hora: el orden es estable", etiquetar(gemelas).map((o) => o.uid), etiquetar([...gemelas].reverse()).map((o) => o.uid));

// ---------------------------------------------------------------- sello y paquete
console.log("\nselloDe y empaquetar: el libro llegó entero");
igual("el sello no depende del orden", selloDe(desordenado), selloDe([...desordenado].reverse()));
igual("si falta una, el sello cambia", selloDe(desordenado) === selloDe(desordenado.slice(1)), false);
const paquete = empaquetar(desordenado, MARTA, new Date("2026-09-10T20:00:00.000Z"));
igual("dice de dónde salió", [paquete.formato, paquete.version, paquete.exportadoPor.nombre], ["tako-libro", VERSION_LIBRO, "Marta Gómez"]);
igual("y cuándo", paquete.exportadoEl, "2026-09-10T20:00:00.000Z");
igual("va etiquetado y sellado", [paquete.observaciones.map((o) => o.id), paquete.sello === selloDe(paquete.observaciones)], [["OBS-001", "OBS-002"], true]);

console.log("\nrevisarPaquete: lo que no cuadra no se funde");
igual("un paquete bueno pasa", revisarPaquete(paquete).libro.length, 2);
igual("un archivo cualquiera, no", revisarPaquete({ hola: 1 }).error, "Eso no es un libro de Tako.");
igual("null, no", revisarPaquete(null).error, "Eso no es un libro de Tako.");
igual("otro formato, no", revisarPaquete({ formato: "otra-cosa" }).error, "Eso no es un libro de Tako.");
igual("un texto suelto, no", revisarPaquete("hola").error, "Eso no es un libro de Tako.");
igual("de una versión más nueva, no", revisarPaquete({ ...paquete, version: VERSION_LIBRO + 1 }).error.startsWith("Ese libro es de una versión más nueva"), true);
igual("sin observaciones, no", revisarPaquete({ ...paquete, observaciones: null }).error, "Ese libro no trae observaciones.");
igual("con una incompleta, no se funde a medias", revisarPaquete({ ...paquete, observaciones: [...paquete.observaciones, { fecha: "2026-09-09T00:00:00.000Z" }] }).error, "Ese libro trae una observación incompleta; no se funde a medias.");
// Alguien edita el número a mano en el archivo: el sello lo delata.
const tocado = JSON.parse(JSON.stringify(paquete));
tocado.observaciones[0].json.equipos[0].cantidad = 99;
delete tocado.observaciones[0].uid;
igual("un archivo cambiado por el camino, no", revisarPaquete(tocado).error, "El sello no cuadra: ese archivo cambió después de exportarse. No se funde.");
igual("un libro viejo sin sello pasa, pero se avisa", revisarPaquete({ ...paquete, sello: undefined }).selloAusente, true);

// ---------------------------------------------------------------- fundir
console.log("\nfundir: unir, nunca sustituir");
const mias = conUid([obs("OBS-001", MARTA, "2026-09-03T14:00:00.000Z", "Hospital DemoCare Pacific", [eq("MR", 2), eq("CT", 1)])]);
const suyas = conUid([
  obs("OBS-001", LUIS, "2026-09-05T10:00:00.000Z", "Hospital DemoCare Pacific", [eq("MR", 3), eq("CT", 1)]),
  obs("OBS-002", LUIS, "2026-09-06T09:00:00.000Z", "Clínica DemoCare Light", [eq("Ultrasound", 4)]),
]);
const f1 = fundir(mias, suyas);
igual("entran las dos que no tenía", [f1.libro.length, f1.nuevas.length, f1.repetidas.length], [3, 2, 0]);
igual("las etiquetas quedan limpias", f1.libro.map((o) => o.id), ["OBS-001", "OBS-002", "OBS-003"]);
igual("la mía sigue siendo mía", f1.libro[0].observador.nombre, "Marta Gómez");
igual("y las suyas siguen firmadas por él", f1.libro.slice(1).map((o) => o.observador.nombre), ["Luis Ortega", "Luis Ortega"]);
// Idempotencia: fundir dos veces el mismo libro no duplica nada.
const f2 = fundir(f1.libro, suyas);
igual("fundir dos veces no duplica", [f2.libro.length, f2.nuevas.length, f2.repetidas.length], [3, 0, 2]);
// Conmutatividad: da igual quién importa a quién, el libro resultante es el mismo.
igual("da igual quién funde a quién", fundir(mias, suyas).libro.map((o) => o.uid), fundir(suyas, mias).libro.map((o) => o.uid));
igual("fundir con un libro vacío no cambia nada", fundir(mias, []).libro.map((o) => o.uid), mias.map((o) => o.uid));
igual("un libro vacío que funde otro se lo queda entero", fundir([], suyas).libro.length, 2);
// Nada se modifica: el contenido de las ajenas entra tal cual.
igual("lo ajeno entra sin tocarse", f1.libro[1].json.equipos[0].cantidad, 3);

console.log("\npugnasNuevas: la razón por la que uno funde");
const nuevas = pugnasNuevas(mias, f1.libro, conflictosDe);
igual("aparece la de MR", [nuevas.length, nuevas[0].modalidad, nuevas[0].cantidades], [1, "MR", [2, 3]]);
igual("CT coincide, no es pugna", nuevas.some((c) => c.modalidad === "CT"), false);
igual("con quiénes, por nombre", nuevas[0].reportes.map((r) => r.nombre).sort(), ["Luis Ortega", "Marta Gómez"]);
igual("una pugna que YA tenía no se anuncia como nueva", pugnasNuevas(f1.libro, f1.libro, conflictosDe), []);
igual("fundir sin nada nuevo no abre pugnas", pugnasNuevas(f1.libro, fundir(f1.libro, suyas).libro, conflictosDe), []);

console.log(`\n${ok} bien, ${fallo} mal`);
process.exit(fallo ? 1 : 0);
