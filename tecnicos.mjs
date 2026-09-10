// Quién levanta la observación.
//
// El lema de Tako es «Quién lo vio, y cuándo». El «cuándo» siempre fue la fecha del
// sistema; el «quién» era un campo de texto con un valor ya escrito dentro, o sea nadie.
// Aquí vive el «quién», y aquí se comprueba.
//
// Se comprueba con un PIN de cuatro dígitos DENTRO del dispositivo: sha256(sal + pin)
// contra el hash guardado, con una sal distinta por persona. No sale una sola llamada de
// red, que es la condición de todo el sistema. Y hay que decirlo tal cual: esto no es el
// directorio corporativo de Philips ni pretende serlo. Es la prueba más fuerte que se
// puede dar sin salir del equipo, y el padrón guarda de cada quien si venía en la lista o
// se dio de alta solo. Igual que con los conflictos de cantidad: se enseña lo que se
// sabe, no se aparenta saber más.
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { plano } from "./verificar.mjs";
import { cantidadesPorModalidad } from "./extraer.mjs";

export const PIN = /^\d{4}$/;

export const nuevaSal = () => randomBytes(16).toString("hex");

export const hashDePin = (sal, pin) => createHash("sha256").update(`${sal}:${pin}`, "utf-8").digest("hex");

// Comparación de tiempo constante. Comparar hashes con === se rinde en el primer carácter
// distinto, y ese tiempo es información. Cuesta tres líneas; se ponen.
export function pinCorrecto(tecnico, pin) {
  if (!tecnico?.sal || !PIN.test(String(pin ?? ""))) return false;
  const a = Buffer.from(hashDePin(tecnico.sal, String(pin)), "hex");
  const b = Buffer.from(String(tecnico.pinHash ?? ""), "hex");
  return a.length > 0 && a.length === b.length && timingSafeEqual(a, b);
}

// Cuatro dígitos son diez mil combinaciones: a mano no se prueban, con un script sí. La
// espera crece con los fallos para que probarlas todas deje de salir gratis. Se cuenta
// por técnico y no por dispositivo: si fuera por dispositivo, el primero que se equivoca
// deja esperando a todos los demás.
export const ESPERAS = [0, 0, 0, 5, 15, 60, 300];
export const esperaTras = (fallos) => ESPERAS[Math.min(Math.max(0, fallos | 0), ESPERAS.length - 1)] * 1000;

// Nunca salen del servidor la sal ni el hash. El PIN de nadie viaja al navegador.
export function tecnicoPublico(t) {
  if (!t) return null;
  const { sal, pinHash, ...resto } = t;
  return resto;
}

const numeroDeId = (id) => Number(String(id ?? "").replace(/[^0-9]/g, "")) || 0;

// El alta queda escrita: «padrón» es alguien que ya venía en la lista del equipo, «alta
// local» es alguien que se registró en este dispositivo. No son la misma garantía y el
// panel no los enseña igual.
export function registrar(padron, { nombre, zona, pin, origen = "alta local", hoy = new Date() }) {
  const n = String(nombre ?? "").trim().replace(/\s+/g, " ");
  if (n.length < 3) return { error: "El nombre necesita al menos 3 letras." };
  if (!PIN.test(String(pin ?? ""))) return { error: "El PIN son exactamente cuatro dígitos." };
  // Se responde con el nombre como está escrito en el padrón, no como lo acaban de
  // teclear: quien lo lee necesita reconocer a quién se refiere.
  const ya = padron.find((t) => plano(t.nombre) === plano(n));
  if (ya) return { error: `${ya.nombre} ya está en el padrón de este equipo.` };
  const sal = nuevaSal();
  const id = `T-${String(Math.max(0, ...padron.map((t) => numeroDeId(t.id))) + 1).padStart(2, "0")}`;
  return {
    tecnico: {
      id, nombre: n,
      zona: String(zona ?? "").trim() || "Sin zona",
      origen, alta: hoy.toISOString(),
      sal, pinHash: hashDePin(sal, String(pin)),
    },
  };
}

// ---------- quién firma una observación ----------
// Las observaciones de antes guardaban al observador como un texto suelto («Field User
// 01»). Se siguen leyendo, y se marcan «sin verificar», que es la verdad sobre ellas: ese
// nombre lo escribió alguien a mano y nadie lo comprobó. No se borran ni se disimulan.
export function observadorDe(o) {
  const v = o?.observador;
  if (v && typeof v === "object") {
    return { id: String(v.id ?? "?"), nombre: String(v.nombre ?? "Sin nombre"), verificado: v.verificado !== false };
  }
  const nombre = String(v ?? "").trim() || "Sin nombre";
  return { id: `libre:${plano(nombre)}`, nombre, verificado: false };
}

// ---------- lo que el técnico recibe a cambio ----------
// Antes de guardar, el sistema mira si de ese mismo hospital y esa misma modalidad ya hay
// un número puesto por OTRA persona, y se lo dice mientras todavía está parado en el
// pasillo y puede ir a contar. Es la diferencia entre un formulario, que solo le quita
// tiempo, y algo que sabe de la cuenta más de lo que él recuerda. El desacuerdo no se
// resuelve solo: se enseña, con nombre y fecha, y él decide.
export function contrastar(observaciones, borrador, yoId) {
  const cliente = borrador?.cliente;
  if (!cliente) return [];
  const previas = (observaciones ?? []).filter((o) => o?.json?.cliente === cliente && observadorDe(o).id !== yoId);
  const salida = [];
  for (const [modalidad, mia] of Object.entries(cantidadesPorModalidad(borrador))) {
    // De cada persona, solo su último reporte de esa modalidad: lo que dijo hace un año
    // no discute con lo que otro vio ayer.
    const ultimo = {};
    for (const o of previas) {
      const n = cantidadesPorModalidad(o.json)[modalidad];
      if (n === undefined) continue;
      const quien = observadorDe(o);
      if (!ultimo[quien.id] || o.fecha > ultimo[quien.id].fecha) {
        ultimo[quien.id] = { ...quien, cantidad: n, fecha: o.fecha, texto: o.texto, obs: o.id };
      }
    }
    const otros = Object.values(ultimo).sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
    if (otros.length) salida.push({ modalidad, mia, otros, discrepa: otros.some((r) => r.cantidad !== mia) });
  }
  // Primero lo que no cuadra: es lo único que le pide una decisión.
  return salida.sort((a, b) => Number(b.discrepa) - Number(a.discrepa) || a.modalidad.localeCompare(b.modalidad));
}

// ---------- el panel ----------
// Qué ha cubierto cada quien. Sale de las observaciones y no de un contador aparte: si un
// número del panel no se puede rastrear hasta una observación con id, no debería estar.
export function coberturaDe(observaciones, padron = []) {
  const filas = new Map();
  const anota = (quien, base = {}) => {
    if (!filas.has(quien.id)) {
      filas.set(quien.id, { ...quien, ...base, observaciones: 0, hospitales: [], fuentes: {}, ultima: null, conflictos: [] });
    }
    return filas.get(quien.id);
  };
  // El padrón entra completo, aunque alguien no haya levantado nada todavía: un técnico
  // con cero observaciones es justo el dato que un gerente de cuentas quiere ver.
  for (const t of padron) anota({ id: t.id, nombre: t.nombre, verificado: true }, { zona: t.zona, origen: t.origen, alta: t.alta });
  for (const o of observaciones ?? []) {
    const f = anota(observadorDe(o));
    f.observaciones++;
    const fuente = o.fuente ?? "texto";
    f.fuentes[fuente] = (f.fuentes[fuente] ?? 0) + 1;
    if (o.json?.cliente && !f.hospitales.includes(o.json.cliente)) f.hospitales.push(o.json.cliente);
    if (!f.ultima || o.fecha > f.ultima) f.ultima = o.fecha;
  }
  // Un conflicto no es de una observación: es de dos personas que no coinciden. Se le
  // apunta a las dos, porque cualquiera de las dos puede ir a resolverlo.
  for (const c of conflictosDe(observaciones ?? [])) {
    for (const r of c.reportes) {
      filas.get(r.id)?.conflictos.push({ cliente: c.cliente, modalidad: c.modalidad, cantidades: c.cantidades });
    }
  }
  return [...filas.values()].sort((a, b) => b.observaciones - a.observaciones || a.nombre.localeCompare(b.nombre));
}

// Dónde hay dos personas con números distintos, ahora mismo. Mismo criterio que el
// Cliente 360: de cada quien manda su último reporte.
export function conflictosDe(observaciones) {
  const grupos = new Map();
  for (const o of observaciones ?? []) {
    if (!o?.json?.cliente) continue;
    const quien = observadorDe(o);
    for (const [modalidad, n] of Object.entries(cantidadesPorModalidad(o.json))) {
      const clave = `${o.json.cliente}|${modalidad}`;
      if (!grupos.has(clave)) grupos.set(clave, { cliente: o.json.cliente, modalidad, ultimo: {} });
      const g = grupos.get(clave);
      if (!g.ultimo[quien.id] || o.fecha > g.ultimo[quien.id].fecha) g.ultimo[quien.id] = { ...quien, cantidad: n, fecha: o.fecha };
    }
  }
  const salida = [];
  for (const g of grupos.values()) {
    const reportes = Object.values(g.ultimo);
    const cantidades = [...new Set(reportes.map((r) => r.cantidad))].sort((a, b) => a - b);
    if (cantidades.length > 1) salida.push({ cliente: g.cliente, modalidad: g.modalidad, cantidades, reportes });
  }
  return salida;
}
