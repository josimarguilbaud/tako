// Pruebas de la capa de codigo de la placa: anclar la marca y parsear los campos del
// texto que devuelve VisionPsy. Sin modelo, corre en milisegundos.
import { anclarFabricante, camposDePlaca, modalidadDePlaca, sinPensamiento } from "./placa.mjs";

let ok = 0, fallo = 0;
const igual = (nombre, a, b) => {
  const x = JSON.stringify(a), y = JSON.stringify(b);
  if (x === y) { ok++; console.log(`  ok   ${nombre}`); }
  else { fallo++; console.log(`  FALLA ${nombre}\n        dio      ${x}\n        esperaba ${y}`); }
};

console.log("anclarFabricante: la marca leida cae siempre en el mismo cliente");
igual("PHILIPS", anclarFabricante("PHILIPS"), "Philips");
igual("minusculas y coma", anclarFabricante("Philips, Achieva 3.0T"), "Philips");
igual("GE basta para GE HealthCare", anclarFabricante("GE\nRevolution CT"), "GE HealthCare");
igual("errata del modelo", anclarFabricante("PHIUPS Ingenia"), "Philips");
igual("marca desconocida da null", anclarFabricante("ACME Imaging Corp"), null);
igual("«GE» dentro de otra palabra no cuenta", anclarFabricante("IMAGE Systems"), null);

console.log("\nmodalidadDePlaca: solo desde datos fisicos impresos");
igual("los teslas son resonancia", modalidadDePlaca("Ingenia Ambition 1.5T"), "MR");
igual("CT escrito", modalidadDePlaca("Revolution CT MODEL 5827411"), "CT");
igual("sin dato fisico, Unknown", modalidadDePlaca("SOMATOM go.Top TYPE 11045622"), "Unknown");

console.log("\ncamposDePlaca: el codigo parsea, el modelo solo transcribe");
const ge = camposDePlaca("GE HealthCare\nRevolution CT", "MODEL 5827411\nSERIAL NO GE-99213\nDATE OF MFG 2021-03\nRATING 480V 60Hz");
igual("GE: la marca entera se quita del nombre", [ge.marca, ge.modelo], ["GE HealthCare", "Revolution CT"]);
igual("GE: serie y ano", [ge.serie, ge.anioFabricacion], ["GE-99213", 2021]);

// El fallo visto el 9 sep: VisionPsy pego el «NO» de la etiqueta al numero de serie.
const pegado = camposDePlaca("GE HealthCare\nRevolution CT", "MODEL 5827411\nSERIAL NOGE-99213\nDATE OF MFG 2021-03");
igual("«SERIAL NOGE-99213» se lee bien", pegado.serie, "GE-99213");
igual("pero «SN NO4471X» no pierde el NO", camposDePlaca("Philips\nAchieva", "SN NO4471X").serie, "NO4471X");

const si = camposDePlaca("SIEMENS Healthineers\nSOMATOM go.Top", "TYPE 11045622\nSN SI-77120\nBAUJAHR 2019-11\nNETZ 400V 3N~");
igual("Siemens en aleman", [si.marca, si.modelo, si.serie, si.anioFabricacion], ["Siemens Healthineers", "SOMATOM go.Top", "SI-77120", 2019]);

const ph = camposDePlaca("PHILIPS Ingenia Ambition 1.5T", "MODEL 781342\nSN: 12345XY\nMFG DATE 2017-06");
igual("marca y producto en una sola linea", [ph.marca, ph.modelo, ph.modalidad], ["Philips", "Ingenia Ambition 1.5T", "MR"]);
igual("la edad sale de la fecha impresa", ph.edadAnios, new Date().getFullYear() - 2017);

igual("sin fecha no se inventa edad", camposDePlaca("Philips\nAchieva", "SN 88231AB").edadAnios, 0);
igual("se ignora el razonamiento del modelo", sinPensamiento("<think>miro la imagen</think>\nPHILIPS"), "PHILIPS");

console.log(`\n${ok} ok, ${fallo} fallan`);
process.exit(fallo ? 1 : 0);
