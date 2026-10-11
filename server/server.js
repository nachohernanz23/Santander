// Backend mínimo de la web del viaje: votos, comentarios y tareas compartidas.
// Sin dependencias. Guarda todo en un JSON (DATA_DIR/estado.json).
// Caddy le pasa /api/*; los archivos estáticos los sirve Caddy directamente.
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = +process.env.PORT || 8797;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", ".datos");
const FILE = path.join(DATA_DIR, "estado.json");

const VOTOS_OK = new Set(["si", "quiza", "no"]);
const ID_OK = /^[a-z0-9-]{1,40}$/;
const MAX_PERSONAS = 30, MAX_COMENTARIOS = 3000, MAX_TEXTO = 800;

fs.mkdirSync(DATA_DIR, { recursive: true });
let estado = { votos: {}, comentarios: [], tareas: {}, rev: 0 };
try { estado = Object.assign(estado, JSON.parse(fs.readFileSync(FILE, "utf8"))); } catch (e) {}

let guardando = null;
function guardar() {
  estado.rev++;
  clearTimeout(guardando);
  guardando = setTimeout(() => {
    const tmp = FILE + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(estado));
    fs.renameSync(tmp, FILE);
  }, 200);
}

function limpiarNombre(n) {
  if (typeof n !== "string") return "";
  n = n.normalize("NFC").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 24);
  return n;
}

function responder(res, code, obj) {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(obj));
}

function leerCuerpo(req) {
  return new Promise((ok, mal) => {
    let datos = "";
    req.on("data", c => { datos += c; if (datos.length > 4096) { mal(new Error("demasiado grande")); req.destroy(); } });
    req.on("end", () => { try { ok(JSON.parse(datos || "{}")); } catch (e) { mal(e); } });
  });
}

const acciones = {
  // { nombre, id, v }  v vacío borra el voto
  voto(b) {
    const nombre = limpiarNombre(b.nombre);
    if (!nombre || !ID_OK.test(b.id || "")) return [400, "datos no válidos"];
    if (!estado.votos[nombre] && Object.keys(estado.votos).length >= MAX_PERSONAS) return [400, "demasiadas personas"];
    const mios = estado.votos[nombre] || (estado.votos[nombre] = {});
    if (VOTOS_OK.has(b.v)) mios[b.id] = b.v; else delete mios[b.id];
    return [200];
  },
  // { nombre, id, texto }
  comentario(b) {
    const nombre = limpiarNombre(b.nombre);
    const texto = typeof b.texto === "string" ? b.texto.trim().slice(0, MAX_TEXTO) : "";
    if (!nombre || !texto || !ID_OK.test(b.id || "")) return [400, "datos no válidos"];
    if (estado.comentarios.length >= MAX_COMENTARIOS) return [400, "demasiados comentarios"];
    estado.comentarios.push({ c: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), id: b.id, autor: nombre, texto, ts: Date.now() });
    return [200];
  },
  // { nombre, c }  solo el autor puede borrar
  borrarComentario(b) {
    const nombre = limpiarNombre(b.nombre);
    const i = estado.comentarios.findIndex(x => x.c === b.c && x.autor === nombre);
    if (i < 0) return [404, "no encontrado"];
    estado.comentarios.splice(i, 1);
    return [200];
  },
  // { nombre, id, hecho }
  tarea(b) {
    const nombre = limpiarNombre(b.nombre);
    if (!nombre || !ID_OK.test(b.id || "")) return [400, "datos no válidos"];
    if (b.hecho) estado.tareas[b.id] = { por: nombre, ts: Date.now() }; else delete estado.tareas[b.id];
    return [200];
  },
  // { nombre }  borra todos los votos de esa persona
  borrarVotos(b) {
    const nombre = limpiarNombre(b.nombre);
    delete estado.votos[nombre];
    return [200];
  }
};

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  if (req.method === "GET" && url.pathname === "/api/estado") {
    if (url.searchParams.get("rev") === String(estado.rev)) return responder(res, 200, { rev: estado.rev, igual: true });
    return responder(res, 200, estado);
  }
  const accion = req.method === "POST" && url.pathname.startsWith("/api/") && acciones[url.pathname.slice(5)];
  if (!accion) return responder(res, 404, { error: "no existe" });
  let cuerpo;
  try { cuerpo = await leerCuerpo(req); } catch (e) { return responder(res, 400, { error: "JSON no válido" }); }
  const [code, error] = accion.call(acciones, cuerpo);
  if (code === 200) guardar();
  responder(res, code, code === 200 ? estado : { error });
}).listen(PORT, "127.0.0.1", () => console.log(`API del viaje en 127.0.0.1:${PORT}, datos en ${FILE}`));
