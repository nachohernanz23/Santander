// Backend mínimo de la web del viaje: votos, comentarios, tareas y restaurantes compartidos.
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
const MAX_PERSONAS = 30, MAX_COMENTARIOS = 3000, MAX_TEXTO = 800, MAX_RESTAURANTES = 300;

fs.mkdirSync(DATA_DIR, { recursive: true });
let estado = { votos: {}, comentarios: [], tareas: {}, restaurantes: [], rev: 0 };
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

function texto(v, max) { return typeof v === "string" ? v.replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max) : ""; }

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
  // { nombre, r: { n, lugar, tipo, precio, nota, resenas, maps, recomienda, texto } }  añade un restaurante
  restaurante(b) {
    const nombre = limpiarNombre(b.nombre), r = b.r || {};
    const n = texto(r.n, 60);
    if (!nombre || !n) return [400, "falta el nombre del restaurante"];
    if (estado.restaurantes.length >= MAX_RESTAURANTES) return [400, "demasiados restaurantes"];
    const maps = texto(r.maps, 400);
    const nota = Number(r.nota), resenas = parseInt(r.resenas, 10);
    estado.restaurantes.push({
      id: "u-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      n, lugar: texto(r.lugar, 60), tipo: texto(r.tipo, 60), precio: texto(r.precio, 20),
      nota: nota >= 1 && nota <= 5 ? Math.round(nota * 10) / 10 : null,
      resenas: resenas > 0 ? Math.min(resenas, 10000000) : null,
      maps: /^https:\/\//.test(maps) ? maps : "", recomienda: texto(r.recomienda, 60), texto: texto(r.texto, 400),
      autor: nombre, ts: Date.now()
    });
    return [200];
  },
  // { nombre, id }  solo quien lo añadió puede borrarlo
  borrarRestaurante(b) {
    const nombre = limpiarNombre(b.nombre);
    const i = estado.restaurantes.findIndex(x => x.id === b.id && x.autor === nombre);
    if (i < 0) return [404, "no encontrado"];
    estado.restaurantes.splice(i, 1);
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
