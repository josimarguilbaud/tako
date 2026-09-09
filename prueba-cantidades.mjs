// Pruebas de la capa de codigo: leer cantidades de la frase y corregir el reparto del
// modelo. No carga ningun modelo, corre en milisegundos: `node prueba-cantidades.mjs`.
import { cantidadesEn, edadesEn, calificativosEn, verificar } from "./verificar.mjs";

let ok = 0, fallo = 0;
const igual = (nombre, a, b) => {
  const x = JSON.stringify(a), y = JSON.stringify(b);
  if (x === y) { ok++; console.log(`  ok   ${nombre}`); }
  else { fallo++; console.log(`  FALLA ${nombre}\n        dio      ${x}\n        esperaba ${y}`); }
};

console.log("cantidadesEn: que dice la frase");
igual("dos resonadores y un tomografo", cantidadesEn("Tienen dos resonadores y un tomógrafo."), { MR: 2, CT: 1 });
igual("el partitivo no cuenta", cantidadesEn("Tienen dos resonadores. Uno de los resonadores tiene ocho años."), { MR: 2 });
igual("one of them tampoco", cantidadesEn("They have three MR systems. One of them is old."), { MR: 3 });
igual("errata del transcriptor", cantidadesEn("tienen dos resonadores y un tomografón"), { MR: 2, CT: 1 });
igual("hasta tres palabras de distancia", cantidadesEn("two old CTs and one recently installed MR"), { CT: 2, MR: 1 });
igual("edad no es cantidad", cantidadesEn("one MR, maybe ten years old, plus three CT scanners"), { MR: 1, CT: 3 });
igual("sin numero pegado, no se lee", cantidadesEn("many ultrasound systems, maybe eight"), {});
igual("aproximado si cuenta", cantidadesEn("about six ultrasound units, mostly new"), { Ultrasound: 6 });
igual("frase sin equipos", cantidadesEn("Estoy en el hospital DemoCare en Panamá."), {});

console.log("\nedadesEn: que numeros son edades");
igual("ocho anios si", [...edadesEn("Uno de los resonadores parece de unos ocho años.")], [8]);
igual("eleven years old si", [...edadesEn("two CT scanners, around eleven years old")], [11]);
igual("una cantidad no es una edad", [...edadesEn("three MR systems. Two seem old and one looks much newer.")], []);
igual("about six units no son seis anios", [...edadesEn("about six ultrasound units, mostly new")], []);
igual("rango 8-10 anios", [...edadesEn("the CTs are 8-10 years old")].sort((a, b) => a - b), [8, 9, 10]);

console.log("\ncalificativosEn: edad sin numero");
igual("one very old CT", calificativosEn("Clinica DemoCare Andes has one very old CT and two MR systems."), { CT: "very old" });
igual("mostly new ultrasound", calificativosEn("Hospital DemoCare North has about six ultrasound units, mostly new."), { Ultrasound: "mostly new" });
igual("old CTs y recently MR", calificativosEn("Instituto DemoCare Lima has two old CTs and one recently installed MR."), { CT: "old", MR: "recently" });
igual("«ten years old» no es calificativo del CT", calificativosEn("one MR, maybe ten years old, plus three CT scanners"), {});
igual("frase sin edad", calificativosEn("They have two MR systems and one CT."), {});

console.log("\nverificar: corrige el reparto del modelo");
const frase = "Estoy en el hospital DemoCare en Punta Pacífica. Tienen dos resonadores y un tomógrafo. Uno de los resonadores parece de tener siete años.";
const fila = (modalidad, cantidad, edadAnios = 0) => ({ modalidad, cantidad, cantidadAproximada: false, marca: "Unknown", modelo: "Unknown", edadAnios, edadCualitativa: "" });
const resumen = (j) => j.equipos.map((q) => `${q.modalidad}:${q.cantidad}:${q.edadAnios}`).join(" ");

// El fallo real guardado como OBS-001 el 8 sep: MR 1 + CT 1 + CT 1.
const r1 = verificar({ cliente: "Hospital DemoCare", ciudad: "Unknown", pais: "Unknown", equipos: [fila("MR", 1, 7), fila("CT", 1), fila("CT", 1)] }, frase);
igual("OBS-001 queda MR 1/7a + MR 1 + CT 1", resumen(r1.json), "MR:1:7 MR:1:0 CT:1:0");
igual("y lo dice en el rastro", r1.ajustes.length, 2);

// Modalidad omitida entera: la frase dice "un tomografo" y el modelo no lo saco.
const r2 = verificar({ cliente: "Hospital DemoCare", ciudad: "Unknown", pais: "Unknown", equipos: [fila("MR", 2, 7)] }, frase);
igual("recupera el tomografo omitido", resumen(r2.json), "MR:1:7 MR:1:0 CT:1:0");

// Reparto ya correcto: no se toca nada.
const r3 = verificar({ cliente: "Hospital DemoCare", ciudad: "Unknown", pais: "Unknown", equipos: [fila("MR", 1, 7), fila("MR", 1), fila("CT", 1)] }, frase);
igual("un reparto correcto no se toca", r3.ajustes, []);

// Sin lectura clara de cantidad, el codigo no corrige: se respeta al modelo.
const r4 = verificar({ cliente: "Clinica DemoCare Central", ciudad: "Unknown", pais: "Unknown", equipos: [fila("Ultrasound", 8)] }, "Clinica DemoCare Central has many ultrasound systems, maybe eight, all Aurelia Health.");
igual("sin numero legible, no corrige", [resumen(r4.json), r4.ajustes.length], ["Ultrasound:8:0", 0]);

console.log(`\n${ok} ok, ${fallo} fallan`);
process.exit(fallo ? 1 : 0);
