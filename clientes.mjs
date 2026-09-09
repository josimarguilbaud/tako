// Paso 1 de la hoja de Philips: "Match against customer list if available". El
// transcriptor destroza los nombres propios ("fiscal democrae Pacific", "MoCare
// Pacific"); aquí se emparejan contra la lista de clientes conocidos por parecido
// entre palabras, ignorando las genéricas (hospital, clínica, de...). Si no hay un
// candidato claro, no se adivina: se deja lo que dijo la persona.
import { readFileSync } from "node:fs";
import { plano } from "./verificar.mjs";

export const CLIENTES = JSON.parse(readFileSync(new URL("./clientes.json", import.meta.url), "utf-8"));

const GENERICAS = new Set(["hospital", "clinica", "centro", "medico", "instituto", "diagnostico", "el", "la", "de", "del", "en", "un", "una", "al"]);

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
const tokens = (s) => plano(s).split(" ").filter((w) => w && !GENERICAS.has(w));
const parecido = (a, b) => (a === b ? 1 : 1 - distancia(a, b) / Math.max(a.length, b.length));

// Devuelve el cliente canónico si UNO destaca claramente; si no, null.
export function emparejarCliente(dicho) {
  const td = tokens(dicho);
  if (!td.length) return null;
  const puntuados = CLIENTES.map((c) => {
    const tc = tokens(c.nombre);
    const suma = tc.reduce((acc, t) => acc + Math.max(...td.map((d) => parecido(d, t))), 0);
    return { cliente: c, score: suma / tc.length };
  }).sort((a, b) => b.score - a.score);
  const [mejor, segundo] = puntuados;
  if (!mejor || mejor.score < 0.75) return null;
  if (segundo && segundo.score > mejor.score - 0.1) return null; // empate: no adivinar
  return { ...mejor.cliente, score: Math.round(mejor.score * 100) / 100 };
}
