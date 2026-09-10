// Pruebas de la identidad del técnico y de lo que el sistema le devuelve. Todo esto es
// código determinista: ningún modelo interviene, corre en milisegundos.
import { PIN, hashDePin, nuevaSal, pinCorrecto, esperaTras, ESPERAS, tecnicoPublico, registrar, observadorDe, contrastar, coberturaDe, conflictosDe } from "./tecnicos.mjs";
import { cantidadesPorModalidad } from "./extraer.mjs";

let ok = 0, fallo = 0;
const igual = (nombre, a, b) => {
  const x = JSON.stringify(a), y = JSON.stringify(b);
  if (x === y) { ok++; console.log(`  ok   ${nombre}`); }
  else { fallo++; console.log(`  FALLA ${nombre}\n        dio      ${x}\n        esperaba ${y}`); }
};

// ---------------------------------------------------------------- el PIN
console.log("PIN: cuatro dígitos, ni más ni menos");
igual("4 dígitos vale", PIN.test("2468"), true);
igual("3 no vale", PIN.test("246"), false);
igual("5 no vale", PIN.test("24680"), false);
igual("letras no valen", PIN.test("24a8"), false);
igual("espacios no valen", PIN.test(" 246"), false);

console.log("\nhashDePin: la sal es lo que impide la tabla precalculada");
igual("mismo par, mismo hash", hashDePin("sal1", "2468"), hashDePin("sal1", "2468"));
igual("distinta sal, distinto hash", hashDePin("sal1", "2468") === hashDePin("sal2", "2468"), false);
igual("distinto PIN, distinto hash", hashDePin("sal1", "2468") === hashDePin("sal1", "2469"), false);
igual("el hash no contiene el PIN", hashDePin("sal1", "2468").includes("2468"), false);
igual("sha256 son 64 hex", /^[0-9a-f]{64}$/.test(hashDePin(nuevaSal(), "0000")), true);
igual("dos sales seguidas no se repiten", nuevaSal() === nuevaSal(), false);

const sal = nuevaSal();
const marta = { id: "T-01", nombre: "Marta Gómez", zona: "Panamá", sal, pinHash: hashDePin(sal, "2468") };

console.log("\npinCorrecto");
igual("el PIN bueno entra", pinCorrecto(marta, "2468"), true);
igual("el PIN malo no entra", pinCorrecto(marta, "2469"), false);
igual("el PIN como número también entra", pinCorrecto(marta, 2468), true);
igual("vacío no entra", pinCorrecto(marta, ""), false);
igual("sin PIN no entra", pinCorrecto(marta, null), false);
igual("un técnico sin sal no entra nunca", pinCorrecto({ id: "T-9", pinHash: "" }, "2468"), false);
igual("un hash vacío no deja pasar a nadie", pinCorrecto({ sal, pinHash: "" }, "2468"), false);
// El hash de otra persona con el mismo PIN no sirve: para eso está la sal por técnico.
const luis = { id: "T-02", nombre: "Luis Ortega", sal: nuevaSal(), pinHash: hashDePin(sal, "2468") };
igual("hash prestado de otra sal no entra", pinCorrecto(luis, "2468"), false);

console.log("\nesperaTras: probar diez mil combinaciones deja de salir gratis");
igual("primer fallo, sin espera", esperaTras(1), 0);
igual("tercer fallo, sin espera", esperaTras(2), 0);
igual("cuarto fallo, 5 s", esperaTras(3), 5000);
igual("sexto fallo, un minuto", esperaTras(5), 60000);
igual("de ahí no sube más", esperaTras(99), ESPERAS.at(-1) * 1000);
igual("cero fallos, sin espera", esperaTras(0), 0);
igual("un negativo no rompe nada", esperaTras(-3), 0);

console.log("\ntecnicoPublico: el secreto no viaja al navegador");
const publico = tecnicoPublico(marta);
igual("no lleva sal", "sal" in publico, false);
igual("no lleva hash", "pinHash" in publico, false);
igual("sí lleva quién es", [publico.id, publico.nombre, publico.zona], ["T-01", "Marta Gómez", "Panamá"]);
igual("sin técnico, null", tecnicoPublico(null), null);

// ---------------------------------------------------------------- el padrón
console.log("\nregistrar: dar de alta a alguien en este dispositivo");
const hoy = new Date("2026-09-10T15:00:00.000Z");
const padron = [marta];
const alta = registrar(padron, { nombre: "  Ana   Ruiz ", zona: "Colón", pin: "1357", hoy });
igual("el nombre se limpia", alta.tecnico.nombre, "Ana Ruiz");
igual("el id sigue al mayor del padrón", alta.tecnico.id, "T-02");
igual("queda escrito cómo entró", alta.tecnico.origen, "alta local");
igual("y cuándo", alta.tecnico.alta, "2026-09-10T15:00:00.000Z");
igual("el PIN queda comprobable", pinCorrecto(alta.tecnico, "1357"), true);
igual("y solo ese PIN", pinCorrecto(alta.tecnico, "1358"), false);
igual("nombre corto, no", registrar(padron, { nombre: "Al", pin: "1111" }).error, "El nombre necesita al menos 3 letras.");
igual("PIN de 3, no", registrar(padron, { nombre: "Carlos Vega", pin: "111" }).error, "El PIN son exactamente cuatro dígitos.");
igual("nombre repetido, no", registrar(padron, { nombre: "marta gomez", pin: "1111" }).error, "Marta Gómez ya está en el padrón de este equipo.");
igual("sin zona, no queda vacío", registrar(padron, { nombre: "Carlos Vega", pin: "1111", hoy }).tecnico.zona, "Sin zona");
// Un padrón con ids sueltos no debe reciclar un número ya usado.
igual("el id no se recicla", registrar([{ id: "T-07", nombre: "X" }, { id: "T-02", nombre: "Y" }], { nombre: "Nuevo Uno", pin: "1111", hoy }).tecnico.id, "T-08");

// ---------------------------------------------------------------- el observador
console.log("\nobservadorDe: lo viejo se lee, y se dice que no está verificado");
igual("texto suelto de antes", observadorDe({ observador: "Field User 01" }), { id: "libre:field user 01", nombre: "Field User 01", verificado: false });
igual("firmado de verdad", observadorDe({ observador: { id: "T-01", nombre: "Marta Gómez", verificado: true } }), { id: "T-01", nombre: "Marta Gómez", verificado: true });
igual("sin observador no se inventa nombre", observadorDe({}).nombre, "Sin nombre");
igual("dos textos iguales son la misma persona", observadorDe({ observador: "Field User 01" }).id === observadorDe({ observador: "field user 01" }).id, true);

// ---------------------------------------------------------------- cantidades
console.log("\ncantidadesPorModalidad: se suma en un solo sitio");
igual("dos filas MR se suman", cantidadesPorModalidad({ equipos: [{ modalidad: "MR", cantidad: 1 }, { modalidad: "MR", cantidad: 1 }, { modalidad: "CT", cantidad: 1 }] }), { MR: 2, CT: 1 });
igual("sin equipos, nada", cantidadesPorModalidad({ equipos: [] }), {});
igual("sin json, nada", cantidadesPorModalidad(null), {});

// ---------------------------------------------------------------- el contraste
const obs = (id, quien, fecha, cliente, equipos, texto = "") => ({ id, fecha, observador: quien, fuente: "voz", texto, json: { cliente, ciudad: "Panamá", pais: "Panamá", equipos } });
const eq = (modalidad, cantidad) => ({ modalidad, cantidad, cantidadAproximada: false, marca: "Unknown", modelo: "Unknown", edadAnios: 0, edadCualitativa: "" });

const base = [
  obs("OBS-001", { id: "T-01", nombre: "Marta Gómez" }, "2026-09-03T14:00:00.000Z", "Hospital DemoCare Pacific", [eq("MR", 2), eq("CT", 1)], "Dos resonadores y un tomógrafo."),
  obs("OBS-002", { id: "T-02", nombre: "Luis Ortega" }, "2026-09-05T10:00:00.000Z", "Clínica DemoCare Light", [eq("Ultrasound", 4)]),
];

console.log("\ncontrastar: lo que el técnico recibe antes de guardar");
const c1 = contrastar(base, { cliente: "Hospital DemoCare Pacific", equipos: [eq("MR", 3)] }, "T-03");
igual("avisa del desacuerdo", [c1.length, c1[0].modalidad, c1[0].mia, c1[0].discrepa], [1, "MR", 3, true]);
igual("con nombre y fecha de quien lo dijo", [c1[0].otros[0].nombre, c1[0].otros[0].cantidad, c1[0].otros[0].obs], ["Marta Gómez", 2, "OBS-001"]);
const c2 = contrastar(base, { cliente: "Hospital DemoCare Pacific", equipos: [eq("MR", 2)] }, "T-03");
igual("si coincide, lo dice igual pero sin marcar conflicto", [c2.length, c2[0].discrepa], [1, false]);
igual("hospital nuevo: no hay nada que contrastar", contrastar(base, { cliente: "Centro Médico DemoCare Valley", equipos: [eq("MR", 1)] }, "T-03"), []);
igual("modalidad que nadie reportó, tampoco", contrastar(base, { cliente: "Hospital DemoCare Pacific", equipos: [eq("X-Ray", 2)] }, "T-03"), []);
igual("sin hospital no se contrasta nada", contrastar(base, { equipos: [eq("MR", 1)] }, "T-03"), []);
// Nadie discute consigo mismo: corregirse no es un conflicto entre dos personas.
igual("mi propio reporte anterior no me contradice", contrastar(base, { cliente: "Hospital DemoCare Pacific", equipos: [eq("MR", 5)] }, "T-01"), []);
// Lo que dije hace un año no discute con lo que otro vio ayer.
const conViejo = [...base, obs("OBS-003", { id: "T-01", nombre: "Marta Gómez" }, "2026-09-08T09:00:00.000Z", "Hospital DemoCare Pacific", [eq("MR", 3)])];
const c3 = contrastar(conViejo, { cliente: "Hospital DemoCare Pacific", equipos: [eq("MR", 3)] }, "T-09");
igual("de cada quien manda su último reporte", [c3[0].otros.length, c3[0].otros[0].cantidad, c3[0].discrepa], [1, 3, false]);
// Lo que no cuadra va primero: es lo único que le pide una decisión a la persona.
const c4 = contrastar(base, { cliente: "Hospital DemoCare Pacific", equipos: [eq("MR", 2), eq("CT", 9)] }, "T-03");
igual("primero lo que no cuadra", [c4[0].modalidad, c4[0].discrepa, c4[1].modalidad], ["CT", true, "MR"]);

// ---------------------------------------------------------------- conflictos y panel
console.log("\nconflictosDe: dos personas, dos números");
const enConflicto = [...base, obs("OBS-004", { id: "T-03", nombre: "Ana Ruiz" }, "2026-09-09T11:00:00.000Z", "Hospital DemoCare Pacific", [eq("MR", 3), eq("CT", 1)])];
const cf = conflictosDe(enConflicto);
igual("un conflicto, en MR", [cf.length, cf[0].modalidad, cf[0].cantidades], [1, "MR", [2, 3]]);
igual("CT coincide, no es conflicto", cf.some((c) => c.modalidad === "CT"), false);
igual("una sola persona nunca está en conflicto consigo misma", conflictosDe([base[0]]), []);

console.log("\ncoberturaDe: el panel sale de las observaciones, no de un contador aparte");
const cob = coberturaDe(enConflicto, [
  { id: "T-01", nombre: "Marta Gómez", zona: "Panamá", origen: "padrón" },
  { id: "T-02", nombre: "Luis Ortega", zona: "Panamá Oeste", origen: "padrón" },
  { id: "T-03", nombre: "Ana Ruiz", zona: "Colón", origen: "alta local" },
  { id: "T-04", nombre: "Carlos Vega", zona: "Chiriquí", origen: "padrón" },
]);
igual("sale todo el padrón, con observaciones o sin ellas", cob.length, 4);
const deMarta = cob.find((f) => f.id === "T-01");
igual("Marta: una observación, un hospital", [deMarta.observaciones, deMarta.hospitales.length], [1, 1]);
igual("Marta está metida en el conflicto de MR", [deMarta.conflictos.length, deMarta.conflictos[0].modalidad], [1, "MR"]);
igual("Ana también, es la otra mitad", cob.find((f) => f.id === "T-03").conflictos.length, 1);
igual("Luis no: su hospital es otro", cob.find((f) => f.id === "T-02").conflictos.length, 0);
const sinNada = cob.find((f) => f.id === "T-04");
igual("Carlos sale en cero, que es justo el dato", [sinNada.observaciones, sinNada.ultima, sinNada.hospitales], [0, null, []]);
igual("se cuenta por dónde entró la observación", deMarta.fuentes, { voz: 1 });
igual("la última actividad es la fecha real", cob.find((f) => f.id === "T-03").ultima, "2026-09-09T11:00:00.000Z");
// Alguien que firmó a mano antes de que existiera el padrón sigue apareciendo, marcado.
const conViejas = coberturaDe([...enConflicto, obs("OBS-005", "Field User 01", "2026-09-01T08:00:00.000Z", "Clínica DemoCare Light", [eq("CT", 1)])], []);
igual("el de antes aparece, sin verificar", conViejas.find((f) => f.nombre === "Field User 01").verificado, false);
igual("y los firmados sí verificados", conViejas.find((f) => f.id === "T-01").verificado, true);

console.log(`\n${ok} bien, ${fallo} mal`);
process.exit(fallo ? 1 : 0);
