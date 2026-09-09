// Genera placas de identificación sintéticas para medir cuánto acierta VisionPsy.
// El navegador dibuja (Node no tiene canvas) y este servidor las escribe a disco con
// su verdad conocida al lado. Correr: preview de http://localhost:3211, se cierra solo.
import http from "node:http";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));

// La verdad de cada placa. Es lo que VisionPsy tiene que leer, y contra lo que se puntúa.
export const PLACAS = [
  { id: "philips-mr", marca: "PHILIPS", modelo: "Ingenia Ambition 1.5T", serie: "12345XY", anio: 2017,
    lineas: [["MODEL", "781342"], ["SN", "12345XY"], ["MFG DATE", "2017-06"], ["INPUT", "400V 3~ 50/60Hz"]],
    pie: "Made in the Netherlands", estilo: "limpia" },
  { id: "ge-ct", marca: "GE HealthCare", modelo: "Revolution CT", serie: "GE-99213", anio: 2021,
    lineas: [["MODEL", "5827411"], ["SERIAL NO", "GE-99213"], ["DATE OF MFG", "2021-03"], ["RATING", "480V 60Hz"]],
    pie: "Made in USA", estilo: "limpia" },
  { id: "siemens-ct", marca: "SIEMENS Healthineers", modelo: "SOMATOM go.Top", serie: "SI-77120", anio: 2019,
    lineas: [["TYPE", "11045622"], ["SN", "SI-77120"], ["BAUJAHR", "2019-11"], ["NETZ", "400V 3N~"]],
    pie: "Made in Germany", estilo: "limpia" },
  { id: "philips-gastada", marca: "PHILIPS", modelo: "Achieva 3.0T", serie: "88231AB", anio: 2012,
    lineas: [["MODEL", "459800"], ["SN", "88231AB"], ["MFG DATE", "2012-09"]],
    pie: "Made in the Netherlands", estilo: "gastada" },
];

const PAGINA = `<!doctype html><meta charset="utf-8"><body style="font:14px system-ui;padding:20px">
<h3>Generando placas…</h3><div id="log"></div><script>
const PLACAS = ${JSON.stringify(PLACAS)};
function dibujar(p) {
  const c = document.createElement("canvas"); c.width = 680; c.height = 420;
  const x = c.getContext("2d");
  const gastada = p.estilo === "gastada";
  x.fillStyle = gastada ? "#9aa0a3" : "#c9ccce"; x.fillRect(0, 0, 680, 420);
  x.fillStyle = gastada ? "#8d9396" : "#b3b7ba"; x.fillRect(0, 0, 680, 70);
  x.strokeStyle = "#6f7477"; x.lineWidth = 6; x.strokeRect(3, 3, 674, 414);
  x.fillStyle = gastada ? "#2c3033" : "#15181a";
  x.font = "bold 42px Arial"; x.fillText(p.marca, 30, 50);
  x.font = "bold 28px Arial"; x.fillText(p.modelo, 30, 122);
  let y = 172;
  for (const [k, v] of p.lineas) {
    x.font = "21px Arial"; x.fillStyle = gastada ? "#4a5053" : "#3a3f42"; x.fillText(k, 30, y);
    x.font = "bold 21px Arial"; x.fillStyle = gastada ? "#2c3033" : "#15181a"; x.fillText(v, 240, y);
    y += 40;
  }
  x.fillStyle = "#3a3f42"; x.font = "17px Arial"; x.fillText(p.pie, 30, 398);
  if (gastada) {
    // Desgaste: rayas, brillo y ruido, como una foto de una placa vieja con flash.
    const g = x.createLinearGradient(0, 0, 680, 420);
    g.addColorStop(0, "rgba(255,255,255,0.35)"); g.addColorStop(0.4, "rgba(255,255,255,0)");
    g.addColorStop(0.75, "rgba(255,255,255,0.22)"); g.addColorStop(1, "rgba(0,0,0,0.18)");
    x.fillStyle = g; x.fillRect(0, 0, 680, 420);
    x.strokeStyle = "rgba(0,0,0,0.12)"; x.lineWidth = 1;
    for (let i = 0; i < 60; i++) {
      x.beginPath(); const yy = Math.random() * 420;
      x.moveTo(0, yy); x.lineTo(680, yy + (Math.random() * 12 - 6)); x.stroke();
    }
    const d = x.getImageData(0, 0, 680, 420);
    for (let i = 0; i < d.data.length; i += 4) {
      const n = (Math.random() - 0.5) * 26;
      d.data[i] += n; d.data[i + 1] += n; d.data[i + 2] += n;
    }
    x.putImageData(d, 0, 0);
  }
  return c.toDataURL("image/png");
}
(async () => {
  for (const p of PLACAS) {
    const dataUrl = dibujar(p);
    await fetch("/guardar", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: p.id, png: dataUrl.slice(22) }) });
    document.getElementById("log").innerHTML += p.id + " ok<br>";
  }
  document.getElementById("log").innerHTML += "<b>LISTO</b>";
  await fetch("/fin", { method: "POST" });
})();
</script></body>`;

const servidor = http.createServer((req, res) => {
  if (req.method === "POST" && req.url === "/guardar") {
    let cuerpo = "";
    req.on("data", (c) => (cuerpo += c));
    req.on("end", () => {
      const { id, png } = JSON.parse(cuerpo);
      writeFileSync(path.join(DIR, `${id}.png`), Buffer.from(png, "base64"));
      console.log(`escrita ${id}.png`);
      res.writeHead(204).end();
    });
    return;
  }
  if (req.method === "POST" && req.url === "/fin") {
    writeFileSync(path.join(DIR, "verdad.json"), JSON.stringify(PLACAS, null, 2) + "\n");
    console.log("escrita verdad.json — listo");
    res.writeHead(204).end();
    setTimeout(() => process.exit(0), 300);
    return;
  }
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(PAGINA);
});
servidor.listen(3211, () => console.log("generador en http://localhost:3211"));
