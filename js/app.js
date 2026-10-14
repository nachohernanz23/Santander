"use strict";
// Lógica de la web del viaje. Datos en js/datos.js, js/generado.js y js/notas.js.

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const API = "api/";
const LS = "viajeCantabria2026";
const DIA_CORTO = { lun: "lun", mar: "mar", mie: "mié", jue: "jue", vie: "vie", sab: "sáb", dom: "dom" };

// ---------- Estado ----------
let local = { nombre: "", votos: {}, tema: "" };
try { Object.assign(local, JSON.parse(localStorage.getItem(LS) || "{}")); } catch (e) {}
local.votos = local.votos || {};
const guardarLocal = () => { try { localStorage.setItem(LS, JSON.stringify(local)); } catch (e) {} };

let remoto = { votos: {}, comentarios: [], tareas: {}, rev: -1 };
let online = null;          // null: sin saber; true: API ok; false: sin API (solo este navegador)
let primeraSync = true;
let tareasLocal = {};
try { tareasLocal = JSON.parse(localStorage.getItem(LS + "-tareas") || "{}"); } catch (e) {}

const yo = () => local.nombre;
function votos() {
  if (online) return remoto.votos;
  return local.nombre ? { [local.nombre]: local.votos } : (Object.keys(local.votos).length ? { "Tú": local.votos } : {});
}
const miVoto = id => (online && yo() ? (remoto.votos[yo()] || {})[id] : local.votos[id]) || "";
const tareas = () => online ? remoto.tareas : tareasLocal;

function resumen(id) {
  const r = { si: [], quiza: [], no: [] };
  for (const [n, vs] of Object.entries(votos())) if (vs && r[vs[id]]) r[vs[id]].push(n);
  r.score = r.si.length * 2 + r.quiza.length - r.no.length * 1.5;
  r.total = r.si.length + r.quiza.length + r.no.length;
  return r;
}
const votantes = () => Object.entries(votos()).filter(([, v]) => v && Object.keys(v).length).map(([n]) => n);

// ---------- Utilidades ----------
function color(n) { let h = 0; for (const c of n) h = (h * 31 + c.charCodeAt(0)) % 360; return `hsl(${h} 46% 40%)`; }
function iniciales(n) { const p = n.trim().split(/\s+/); return (p.length > 1 ? p[0][0] + p[1][0] : n.slice(0, 2)).toUpperCase(); }
const ETIQ = { si: "Me apetece", quiza: "Quizá", no: "Paso" };
const av = (n, cls = "") => `<span class="av ${cls}" style="background:${color(n)}" title="${esc(n)}${cls ? ": " + ETIQ[cls] : ""}">${esc(iniciales(n))}</span>`;
const estrellas = v => "★".repeat(v) + "☆".repeat(5 - v);
const fmtN = n => n >= 10000 ? Math.round(n / 1000) + " mil" : n >= 1000 ? (n / 1000).toFixed(1).replace(".", ",") + " mil" : String(n);
const fmtNota = n => n.toFixed(1).replace(".", ",");
const mapsQ = q => "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(q);
const comoLlegar = s => "https://www.google.com/maps/dir/?api=1&destination=" + encodeURIComponent(s.q);
function hace(ts) {
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return "ahora"; if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60); if (h < 24) return `hace ${h} h`;
  return new Date(ts).toLocaleDateString("es-ES", { weekday: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
function toast(t) { const el = $("#toast"); el.textContent = t; el.classList.add("ver"); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove("ver"), 2600); }
const hoyISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const horaMin = h => { const [a, b] = h.split(":").map(Number); return a * 60 + b; };
const minHora = m => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
function coefTxt(c) { return c >= 90 ? "muy alto" : c >= 70 ? "alto" : c >= 45 ? "medio" : "bajo"; }

// ---------- Mareas ----------
function bajamaresDia(p, n) {
  const d = MAREAS[p] && MAREAS[p][n]; if (!d) return [];
  return d.m.filter(([h, t]) => t === "b" && horaMin(h) >= 8 * 60 && horaMin(h) <= 20 * 60).map(([h]) => h);
}
function lineaMarea(p, n) {
  const d = MAREAS[p] && MAREAS[p][n]; if (!d) return "";
  const nombre = { santander: "Santander", bermeo: "Bermeo", zumaia: "Zumaia" }[p];
  const partes = d.m.filter(([h]) => horaMin(h) >= 6 * 60).map(([h, t]) => t === "b" ? `<span class="bm">bajamar ${h}</span>` : `pleamar ${h}`);
  return `🌊 Mareas en ${nombre}: ${partes.join(" · ")} · coeficiente ${d.coef} (${coefTxt(d.coef)})`;
}
function mareaSitio(id) {
  const s = S[id]; if (!s.marea) return "";
  const enDia = DIAS.filter(d => d.items.includes(id) || d.alt.includes(id)).map(d => d.n);
  const lista = DIAS.map(d => {
    const b = bajamaresDia(s.marea.p, d.n)[0]; if (!b) return "";
    const m = horaMin(b), ventana = `${minHora(m - 120)}–${minHora(m + 120)}`;
    const t = `${DIA_CORTO[d.k]} ${b} <small>(${ventana})</small>`;
    return enDia.includes(d.n) ? `<b>${t}</b>` : t;
  }).filter(Boolean);
  return `<div class="marea-sitio">🌊 <b>Depende de la marea.</b> ${esc(s.marea.txt)}<br>Bajamar de día: ${lista.join(" · ")}</div>`;
}

// ---------- Recomendaciones de la familia ----------
const famDe = id => (typeof FAMILIA === "undefined" ? [] : FAMILIA).filter(f => f.id === id);
const htmlFamilia = id => famDe(id).map(f => `<div class="familia">💬 <b>${esc(f.quien)}</b>: ${esc(f.txt)}</div>`).join("");
function enlaceFamilia(f) {
  if (f.id.startsWith("dia:")) { const d = DIAS.find(x => x.k === f.id.slice(4)); return `<a href="#" data-ir-dia="${d.k}">${d.d} ${d.n}</a>`; }
  return `<a href="#" ${S[f.id] ? "data-ir-sitio" : "data-ir-resto"}="${f.id}">${esc(nombreDe(f.id))}</a>`;
}

// ---------- Tarjeta de sitio ----------
function chipEntrada(t) {
  if (!t || t === "—") return "";
  if (/gratis/i.test(t) && !/€/.test(t)) return `<span class="chip-res gratis">Gratis</span>`;
  if (/€|entrada/i.test(t)) return `<span class="chip-res pago">Con entrada</span>`;
  return "";
}
const RES = { obligatoria: "Reserva obligatoria", recomendada: "Mejor reservar", no: "Sin reserva" };
function tarjeta(id) {
  const s = S[id], f = FOTOS[id] || [], g = NOTAS[id], i = s.info || {};
  const foto = f[0] ? `<img src="img/${f[0].f}-m.webp" alt="${esc(s.n)}" loading="lazy" decoding="async">` : `<div class="ph">${esc(s.n)}</div>`;
  const gIns = g ? `<span class="ins g" title="${esc(g.fuente)} («${esc(g.ficha)}»): ${fmtNota(g.nota)} con ${g.resenas} opiniones"><span class="est">★</span> ${fmtNota(g.nota)} <small>· ${fmtN(g.resenas)}${g.fuente === "Google" ? "" : " " + esc(g.fuente)}</small></span>` : "";
  const filas = [];
  if (i.entrada && i.entrada !== "—") filas.push(`<li><span>🎟</span><span>${chipEntrada(i.entrada)}${i.entrada === "Gratis" ? "" : esc(i.entrada)}</span></li>`);
  if (i.reserva && id !== "arenas") filas.push(`<li><span>📅</span><span><span class="chip-res ${i.reserva}">${RES[i.reserva]}</span>${i.reserva !== "no" && i.url ? `<a href="${esc(i.url)}" target="_blank" rel="noopener">reservar aquí</a>` : ""}</span></li>`);
  if (i.horario) filas.push(`<li><span>🕒</span><span>${esc(i.horario)}</span></li>`);
  return `<article class="sitio" data-card="${id}">
    <button class="foto" type="button" data-galeria="${id}" aria-label="Ver fotos de ${esc(s.n)}">${foto}
      <span class="insignias"><span class="ins v${s.val}">${"★".repeat(s.val)} ${VALORACION[s.val]}</span>${gIns}</span>
      <span class="fav" data-fav="${id}" hidden></span>
      ${f.length > 1 ? `<span class="nfotos">📷 ${f.length}</span>` : ""}
    </button>
    <div class="cuerpo">
      <h3>${esc(s.n)}</h3>
      <div class="meta"><span>${ZONAS[s.z]}</span><span>🚗 ${esc(s.t)}</span><span>⏱ ${esc(s.dur)}</span></div>
      <p>${esc(s.d)}</p>
      ${s.extra ? `<p style="font-size:14px;color:var(--muted)">💡 ${esc(s.extra)}</p>` : ""}
      <div class="veredicto"><span class="estrellas" aria-label="${s.val} de 5">${estrellas(s.val)}</span> <b>${VALORACION[s.val]}.</b> ${esc(s.por)}</div>
      ${htmlFamilia(id)}
      ${filas.length ? `<ul class="practico-lista">${filas.join("")}</ul>` : ""}
      ${i.aviso ? `<div class="aviso-sitio">⚠ ${esc(i.aviso)}</div>` : ""}
      ${mareaSitio(id)}
      <div class="enlaces">
        <a href="${mapsQ(s.q)}" target="_blank" rel="noopener">Reseñas en Maps</a>
        <a href="${comoLlegar(s)}" target="_blank" rel="noopener">Cómo llegar</a>
        ${i.url ? `<a href="${esc(i.url)}" target="_blank" rel="noopener">Web oficial</a>` : ""}
        <a href="https://www.google.com/search?tbm=isch&q=${encodeURIComponent(s.q)}" target="_blank" rel="noopener">Más fotos</a>
      </div>
      ${htmlVotoComs(id, s.n)}
    </div>
  </article>`;
}
function htmlVotoComs(id, nombre) {
  return `<div class="grupo" data-grupo="${id}"></div>
      <div class="voto" role="group" aria-label="¿Te apetece ${esc(nombre)}?">
        ${[["si", "👍 Me apetece"], ["quiza", "🤔 Quizá"], ["no", "👎 Paso"]].map(([k, l]) => `<button type="button" data-id="${id}" data-v="${k}" aria-pressed="false">${l}</button>`).join("")}
      </div>
      <details class="coms" data-coms="${id}">
        <summary>💬 Comentarios (<span data-ncom="${id}">0</span>)</summary>
        <div class="lista"></div>
        <form class="form-com" data-id="${id}"><input name="t" maxlength="800" placeholder="Escribe un comentario…" aria-label="Comentario sobre ${esc(nombre)}" autocomplete="off"><button class="btn peq" type="submit">Enviar</button></form>
      </details>`;
}
function pintarGrupo(el) {
  const id = el.dataset.grupo, r = resumen(id);
  if (!r.total) { el.innerHTML = `<span class="vacio">${online === false ? "Votos solo en este móvil" : "Nadie ha votado todavía"}</span>`; return; }
  el.innerHTML = `<span class="marcador">${r.si.length ? "👍" + r.si.length : ""} ${r.quiza.length ? "🤔" + r.quiza.length : ""} ${r.no.length ? "👎" + r.no.length : ""}</span>` +
    r.si.map(n => av(n, "si")).join("") + r.quiza.map(n => av(n, "quiza")).join("") + r.no.map(n => av(n, "no")).join("");
}
function pintarComs(id) {
  const lista = remoto.comentarios.filter(c => c.id === id);
  $$(`[data-ncom="${id}"]`).forEach(e => e.textContent = lista.length);
  const html = lista.length ? lista.map(c => htmlCom(c)).join("") : `<p class="vacio" style="margin:0 0 8px;color:var(--muted)">${online === false ? "Los comentarios necesitan conexión con el servidor." : "Sin comentarios. ¿Qué os parece?"}</p>`;
  $$(`[data-coms="${id}"] .lista`).forEach(e => e.innerHTML = html);
}
function htmlCom(c, sobre = false) {
  return `<div class="com">${av(c.autor)}<div class="txt"><span class="quien">${esc(c.autor)}</span><span class="cuando">${hace(c.ts)}</span>${c.autor === yo() ? `<button class="borrar" data-borrar="${esc(c.c)}">borrar</button>` : ""}
    ${sobre ? (planDe(c.id) ? `<div class="sobre">sobre el <a href="#" data-ir-dia="${planDe(c.id).d.k}">plan ${esc(planDe(c.id).p.letra)} del ${esc(planDe(c.id).d.d.toLowerCase())}</a></div>`
      : `<div class="sobre">sobre <a href="#" ${S[c.id] ? "data-ir-sitio" : "data-ir-resto"}="${esc(c.id)}">${esc(nombreDe(c.id))}</a></div>`) : ""}<div>${esc(c.texto)}</div></div></div>`;
}

// ---------- Actualizar todo lo que depende de votos ----------
function actualizar() {
  const firma = restosUsuario().map(r => r.id).join();
  if (firma !== firmaR) { firmaR = firma; pintarRestos(); return; }
  $$("[data-grupo]").forEach(pintarGrupo);
  $$(".voto button").forEach(b => b.setAttribute("aria-pressed", miVoto(b.dataset.id) === b.dataset.v));
  const n = votantes().length;
  $$("[data-fav]").forEach(e => {
    const r = resumen(e.dataset.fav), fav = n >= 2 && r.si.length * 2 > n;
    e.hidden = !fav; if (fav) e.textContent = `❤ Gusta a ${r.si.length} de ${n}`;
    e.closest(".sitio, .resto, .plan").classList.toggle("top", fav);
  });
  $$("[data-fuimos]").forEach(b => { const f = tareas()["f-" + b.dataset.fuimos]; b.setAttribute("aria-pressed", !!f); b.textContent = f ? `✔ Ya fuimos (lo marcó ${f.por})` : "Marcar que ya fuimos"; });
  [...Object.keys(S), ...idsRestos(), ...idsPlanes()].forEach(pintarComs);
  $$("[data-ganador]").forEach(pintarGanador);
  pintarYo(); renderGrupo(); renderReservas(); recolorearMapa();
}
function pintarYo() {
  $("#yo-av").textContent = yo() ? iniciales(yo()) : "?";
  $("#yo-av").style.background = yo() ? color(yo()) : "#667";
  $("#yo-txt").textContent = yo() ? yo() : "¿Quién eres?";
  const er = $("#estado-red");
  er.className = "estado-red " + (online ? "ok" : online === false ? "mal" : "");
  er.lastElementChild.innerHTML = online ? "En directo<span class='largo'>: votos del grupo</span>" : online === false ? "Sin conexión<span class='largo'>: votos solo aquí</span>" : "Conectando…";
}

// ---------- API ----------
async function api(accion, cuerpo) {
  const r = await fetch(API + accion, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || r.status);
  return r.json();
}
async function sync() {
  try {
    const r = await fetch(API + "estado?rev=" + remoto.rev, { cache: "no-store" });
    if (!r.ok) throw new Error(r.status);
    const j = await r.json();
    const antes = online; online = true;
    if (!j.igual) { remoto = j; }
    if (primeraSync) { primeraSync = false; await migrar(); renderPlan(); pintarIdeas(); }
    if (!j.igual || antes !== true) actualizar();
  } catch (e) {
    if (online !== false) { online = false; if (primeraSync) { primeraSync = false; } actualizar(); }
  }
}
// Sube los votos que se hicieron sin conexión (o con la web antigua) y no están en el servidor
async function migrar() {
  if (!yo()) return;
  const enServidor = remoto.votos[yo()] || {};
  const pendientes = Object.entries(local.votos).filter(([id, v]) => S[id] && !enServidor[id] && v);
  for (const [id, v] of pendientes) { try { remoto = await api("voto", { nombre: yo(), id, v }); } catch (e) {} }
  if (pendientes.length) toast(`Subidos ${pendientes.length} votos que tenías guardados`);
}
setInterval(() => { if (!document.hidden) sync(); }, 12000);
document.addEventListener("visibilitychange", () => { if (!document.hidden) sync(); });

// ---------- Nombre ----------
let trasNombre = null;
function pedirNombre(despues) {
  trasNombre = despues || null;
  const nombres = [...new Set([...VIAJE.personas, ...Object.keys(remoto.votos), ...remoto.comentarios.map(c => c.autor)])];
  $("#nombres").innerHTML = nombres.map(n => `<button type="button" data-nombre="${esc(n)}">${av(n)}${esc(n)}</button>`).join("");
  $("#nombre-in").value = "";
  $("#dlg-nombre").showModal();
}
function ponerNombre(n) {
  n = n.trim().slice(0, 24); if (!n) return;
  const cambio = local.nombre && local.nombre !== n;
  local.nombre = n;
  if (cambio) local.votos = Object.assign({}, remoto.votos[n] || {});
  guardarLocal(); $("#dlg-nombre").close();
  toast(`Hola, ${n}`);
  migrar().then(() => { actualizar(); if (trasNombre) { const f = trasNombre; trasNombre = null; f(); } });
}
$("#nombres").addEventListener("click", e => { const b = e.target.closest("[data-nombre]"); if (b) ponerNombre(b.dataset.nombre); });
$("#form-nombre").addEventListener("submit", e => {
  if (e.submitter && e.submitter.value === "cancelar") { trasNombre = null; return; }
  e.preventDefault(); const v = $("#nombre-in").value.trim();
  if (v) ponerNombre(v); else $("#nombre-in").focus();
});
$("#yo-pill").addEventListener("click", () => pedirNombre());

// ---------- Votar, comentar, tareas ----------
async function votar(id, v) {
  if (!yo()) return pedirNombre(() => votar(id, v));
  const nuevo = miVoto(id) === v ? "" : v;
  if (nuevo) local.votos[id] = nuevo; else delete local.votos[id];
  guardarLocal();
  if (online) {
    const mios = remoto.votos[yo()] || (remoto.votos[yo()] = {});
    if (nuevo) mios[id] = nuevo; else delete mios[id];
  }
  actualizar();
  if (online) { try { remoto = await api("voto", { nombre: yo(), id, v: nuevo }); actualizar(); } catch (e) { toast("No se ha podido guardar el voto. Reintentando…"); sync(); } }
}
async function comentar(id, texto) {
  if (!yo()) return pedirNombre(() => comentar(id, texto));
  if (!online) return toast("Para comentar hace falta conexión con el servidor");
  try { remoto = await api("comentario", { nombre: yo(), id, texto }); actualizar(); } catch (e) { toast("No se ha podido enviar el comentario"); }
}
async function marcarTarea(id, hecho) {
  if (!yo()) return pedirNombre(() => marcarTarea(id, hecho));
  if (!online) {
    if (hecho) tareasLocal[id] = { por: yo(), ts: Date.now() }; else delete tareasLocal[id];
    try { localStorage.setItem(LS + "-tareas", JSON.stringify(tareasLocal)); } catch (e) {}
    return renderReservas();
  }
  if (hecho) remoto.tareas[id] = { por: yo(), ts: Date.now() }; else delete remoto.tareas[id];
  renderReservas();
  try { remoto = await api("tarea", { nombre: yo(), id, hecho }); actualizar(); } catch (e) { toast("No se ha podido guardar"); sync(); }
}

// ---------- Semana y tiempo ----------
let METEO = null;
try { METEO = JSON.parse(localStorage.getItem(LS + "-meteo") || "null"); } catch (e) {}
const WX = c => c === 0 ? ["☀️", "Despejado"] : c === 1 ? ["🌤", "Poco nuboso"] : c === 2 ? ["⛅", "Nubes y claros"] : c === 3 ? ["☁️", "Nublado"] :
  c <= 48 ? ["🌫", "Niebla"] : c <= 57 ? ["🌦", "Llovizna"] : c <= 67 ? ["🌧", "Lluvia"] : c <= 77 ? ["🌨", "Nieve"] : c <= 82 ? ["🌦", "Chubascos"] : ["⛈", "Tormenta"];
function meteoDia(i) {
  if (!METEO || !METEO.dias || !METEO.dias[i]) return null;
  const m = METEO.dias[i]; return m && m.max != null ? m : null;
}
function gente(g) {
  const n = typeof g === "number" ? g : +String(g).split("→").pop();
  let h = ""; for (let i = 0; i < 6; i++) h += `<i class="${i < n ? "" : "fuera"}"></i>`; return h;
}
function renderSemana() {
  const hoy = hoyISO();
  $("#semana").innerHTML = DIAS.map((d, i) => {
    const m = meteoDia(i);
    const wx = m ? `<b>${WX(m.code)[0]}</b><span class="temp">${Math.round(m.max)}°</span><span style="color:var(--muted)">${Math.round(m.min)}°</span>` : `<b>${d.wx}</b>`;
    const p = m ? `${m.lluvia}% lluvia` : d.p;
    return `<button class="dia-btn${d.f === hoy ? " hoy" : ""}" data-ir="${d.k}">
      <div class="d">${d.d}</div><div class="n">${d.n}</div>
      <div class="wx" aria-hidden="true">${wx}</div><div class="p${(m ? m.lluvia : parseInt(d.p)) >= 60 ? " alta" : ""}">${p}</div>
      <div class="gente" aria-label="${d.gente} personas" title="${esc(d.quien || "")}">${gente(d.gente)}</div>
      <div class="t">${esc(d.t)}</div></button>`;
  }).join("");
  if (METEO) $("#fuente-meteo").textContent = `Previsión de Open-Meteo actualizada ${hace(METEO.ts)}. Cada día, en la zona donde estaréis`;
  DIAS.forEach((d, i) => { const el = $(`[data-meteo="${d.k}"]`); if (el) el.innerHTML = lineaMeteo(d, i); });
}
function lineaMeteo(d, i) {
  const m = meteoDia(i);
  const cielo = n => n == null ? "" : n < 30 ? "☀️ sol" : n < 70 ? "⛅ nubes y claros" : "☁️ nublado";
  let t = m ? `${WX(m.code)[0]} <b>${WX(m.code)[1]}</b> · ${Math.round(m.max)}° / ${Math.round(m.min)}° · lluvia ${m.lluvia}% · viento ${Math.round(m.viento)} km/h (rachas ${Math.round(m.rachas)})` +
      (m.nm != null ? `<br>Por la mañana ${cielo(m.nm)} · por la tarde ${cielo(m.nt)}` : "")
    : `${d.wx} ${esc(d.p)} <span style="color:var(--muted)">(AEMET, 11-oct)</span>`;
  if (d.monte && METEO && METEO.monte && METEO.monte[i]) {
    const a = METEO.monte[i];
    t += `<br>⛰ En la montaña (1.850 m): ${Math.round(a.max)}° / ${Math.round(a.min)}°, rachas de ${Math.round(a.rachas)} km/h` +
      (a.rachas >= 55 ? ` <b style="color:var(--rojo)">— viento fuerte: riesgo de que cierre el teleférico</b>` : "");
  }
  return t;
}
async function cargarMeteo() {
  if (METEO && METEO.dias && METEO.dias[0] && "nm" in METEO.dias[0] && Date.now() - METEO.ts < 30 * 60000) return;
  const base = "https://api.open-meteo.com/v1/forecast?daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max&hourly=cloud_cover&timezone=Europe%2FMadrid&start_date=2026-10-12&end_date=2026-10-18";
  // Nubosidad media de una franja horaria del día i (las horas vienen seguidas, 24 por día)
  const nubes = (j, i, h0, h1) => { const v = (j.hourly && j.hourly.cloud_cover || []).slice(i * 24 + h0, i * 24 + h1 + 1).filter(x => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  const leer = (j, i) => ({ code: j.daily.weather_code[i], max: j.daily.temperature_2m_max[i], min: j.daily.temperature_2m_min[i],
    lluvia: j.daily.precipitation_probability_max[i] ?? 0, viento: j.daily.wind_speed_10m_max[i], rachas: j.daily.wind_gusts_10m_max[i],
    nm: nubes(j, i, 9, 13), nt: nubes(j, i, 14, 19) });
  try {
    const lat = DIAS.map(d => d.meteo[0]).join(","), lon = DIAS.map(d => d.meteo[1]).join(",");
    const r = await fetch(`${base}&latitude=${lat}&longitude=${lon}`); if (!r.ok) throw 0;
    const arr = await r.json();
    const dias = DIAS.map((d, i) => leer(arr[i], i));
    const mt = DIAS.find(d => d.monte).monte;
    let monte = null;
    try { const r2 = await fetch(`${base}&latitude=${mt[0]}&longitude=${mt[1]}&elevation=${mt[2]}`); if (r2.ok) { const j2 = await r2.json(); monte = DIAS.map((d, i) => leer(j2, i)); } } catch (e) {}
    METEO = { ts: Date.now(), dias, monte };
    try { localStorage.setItem(LS + "-meteo", JSON.stringify(METEO)); } catch (e) {}
    renderSemana();
  } catch (e) { /* se queda la previsión guardada o la de AEMET */ }
}

// ---------- Planes alternativos de un día ----------
const planesDe = k => (typeof PLANES !== "undefined" && PLANES[k]) || [];
const idsPlanes = () => (typeof PLANES === "undefined" ? [] : Object.values(PLANES).flat().map(p => p.id));
const planDe = id => { for (const d of DIAS) { const p = planesDe(d.k).find(x => x.id === id); if (p) return { d, p }; } return null; };
function htmlPlanes(d) {
  const P = planesDe(d.k);
  if (!P.length) return "";
  return `<div class="sub-h">¿Qué plan hacemos? Votad 👍 el que os apetece</div>
    <div class="planes">${P.map(p => `<article class="plan${p.rec ? " rec" : ""}" data-card="${p.id}">
      <div class="plan-cab"><span class="letra">${esc(p.letra)}</span><div><h3>${esc(p.n)}</h3>
        <div class="meta"><span>⚡ Ritmo ${esc(p.ritmo.toLowerCase())}</span>${p.coche ? `<span>🚗 ${esc(p.coche)}</span>` : ""}</div></div></div>
      ${p.rec ? `<span class="rec-badge">⭐ Nuestra recomendación</span>` : ""}
      <span class="fav-r" data-fav="${p.id}" hidden></span>
      <p>${esc(p.lema)}</p>
      ${p.datos ? `<div class="plan-datos">${p.datos.map(x => `<span>${esc(x)}</span>`).join("")}</div>` : ""}
      ${p.fotos ? `<div class="plan-fotos">${p.fotos.map(([f, t]) => `<figure><a href="${esc(f)}" target="_blank" rel="noopener"><img src="${esc(f)}" alt="${esc(t)}" loading="lazy" decoding="async"></a><figcaption>${esc(t)}</figcaption></figure>`).join("")}</div>` : ""}
      ${p.mapa ? `<a class="plan-mapa" href="${esc(p.mapa)}" target="_blank" rel="noopener"><img src="${esc(p.mapa)}" alt="Mapa de la ruta" loading="lazy" decoding="async"><small>Toca para ver el mapa grande</small></a>` : ""}
      <ol class="plan-horario">${p.horario.map(([h, t]) => `<li><b>${esc(h)}</b><span>${esc(t)}</span></li>`).join("")}</ol>
      <ul class="pros">${p.pros.map(x => `<li>${esc(x)}</li>`).join("")}</ul>
      <ul class="contras">${p.contras.map(x => `<li>${esc(x)}</li>`).join("")}</ul>
      <div class="plan-links">📍 ${p.sitios.map(id => `<a href="#" data-ir-sitio="${id}">${esc(S[id].n)}</a>`).join(" · ")}</div>
      ${p.comer.length ? `<div class="plan-links">🍽 ${p.comer.filter(id => RESTAURANTES[id]).map(id => `<a href="#" data-ir-resto="${id}">${esc(RESTAURANTES[id].n)}</a>`).join(" · ")}</div>` : ""}
      ${p.gpx ? `<a class="btn peq" style="align-self:flex-start" href="${esc(p.gpx)}" download>⬇ Descargar la ruta (GPX)</a>` : `<a class="btn peq sec" style="align-self:flex-start" href="${rutaDia(d, p.sitios)}" target="_blank" rel="noopener">🗺 Ruta de este plan en Maps</a>`}
      ${htmlVotoComs(p.id, "el plan " + p.letra)}
    </article>`).join("")}</div>`;
}
function pintarGanador(el) {
  const P = planesDe(el.dataset.ganador).map(p => ({ p, r: resumen(p.id) })).sort((a, b) => b.r.score - a.r.score);
  if (!P.length || !P[0].r.total) { el.innerHTML = `Todavía nadie ha votado plan. ${yo() ? "" : "Di quién eres y vota."}`; return; }
  const empate = P[1] && P[1].r.score === P[0].r.score;
  el.innerHTML = empate ? `🤝 Empate entre el plan ${P[0].p.letra} y el ${P[1].p.letra}: falta que vote alguien más.`
    : `🏆 Va ganando el <b>plan ${P[0].p.letra}</b>: ${esc(P[0].p.n)} <small>(👍${P[0].r.si.length}${P[0].r.quiza.length ? " 🤔" + P[0].r.quiza.length : ""}${P[0].r.no.length ? " 👎" + P[0].r.no.length : ""})</small>`;
}

// ---------- Plan por días ----------
function ordenarPorGrupo(ids) {
  return ids.map((id, i) => [id, resumen(id).score, i]).sort((a, b) => b[1] - a[1] || a[2] - b[2]).map(x => x[0]);
}
function rutaDia(d, ids = d.items) {
  const casa = (d.k === "sab" || d.k === "dom") ? VIAJE.casas[1] : VIAJE.casas[0];
  const pts = ids.filter(id => S[id] && S[id].c && id !== "arenas" && id !== "cocido").map(id => S[id].c.join(","));
  if (!pts.length) return "";
  const u = new URL("https://www.google.com/maps/dir/");
  u.searchParams.set("api", "1"); u.searchParams.set("origin", casa.q); u.searchParams.set("destination", casa.q);
  u.searchParams.set("waypoints", pts.slice(0, 9).join("|")); u.searchParams.set("travelmode", "driving");
  return u.toString();
}
function renderPlan() {
  $("#p-plan").innerHTML = `<p class="intro">Propuesta para cada día con horarios, mareas, avisos y reservas. Los sitios de cada día se ordenan según los votos del grupo. Pulsad un día de la semana para saltar a él.</p>` +
    DIAS.map((d, i) => {
      const mp = d.marea || "santander", mm = MAREAS[mp][d.n];
      const ruta = rutaDia(d);
      return `<section class="dia" id="dia-${d.k}">
      <div class="dia-cab"><div class="num">${d.n}</div><h2>${d.d}: ${esc(d.t)}</h2>
        <div class="sub"><span>👥 ${typeof d.gente === "number" ? d.gente : d.gente.replace("→", " → ")} personas${d.quien ? ": " + esc(d.quien) : ""}</span><span>☀ Sale a las ${mm.sol[0]}, se pone a las ${mm.sol[1]}</span></div></div>
      <div class="dia-info">
        <div>
          <div class="meteo-linea" data-meteo="${d.k}">${lineaMeteo(d, i)}</div>
          ${d.marea ? `<div class="marea-linea">${lineaMarea(d.marea, d.n)}</div>` : ""}
          <p class="nota ${d.sol ? "sol" : ""}">${esc(d.nota)}</p>
          ${d.avisos && d.avisos.length ? `<ul class="avisos">${d.avisos.map(a => `<li>${esc(a)}</li>`).join("")}</ul>` : ""}
          ${htmlFamilia("dia:" + d.k)}
        </div>
        ${planesDe(d.k).length ? `<div class="agenda"><h3>Elegid el plan del día</h3>
          <p style="margin:0 0 10px;font-family:Archivo,sans-serif;font-size:14.5px">Debajo tenéis ${planesDe(d.k).length} planes completos con horario, pros y contras. Votad el que os apetece y comentad; aquí se ve cuál va ganando.</p>
          <div class="ganador" data-ganador="${d.k}"></div>` : `<div class="agenda"><h3>Horario orientativo</h3>
          <ol>${d.horario.map(([h, t]) => `<li><b>${esc(h)}</b><span>${esc(t)}</span></li>`).join("")}</ol>
          ${ruta ? `<div class="acciones"><a class="btn peq" href="${ruta}" target="_blank" rel="noopener">🗺 Ruta del día en Google Maps</a></div>` : ""}`}
          ${planesDe(d.k).length ? "" : comerDia(d)}
        </div>
      </div>
      ${htmlPlanes(d)}
      ${d.items.length ? `${planesDe(d.k).length ? `<div class="sub-h">Los sitios de estos planes</div>` : ""}<div class="grid">${ordenarPorGrupo(d.items).map(tarjeta).join("")}</div>` : ""}
      ${d.alt.length ? `<div class="sub-h">Alternativas para este día</div><div class="grid">${ordenarPorGrupo(d.alt).map(tarjeta).join("")}</div>` : ""}
    </section>`;
    }).join("");
  actualizar();
}

// ---------- Todos los sitios ----------
const FILTROS = [["todas", "Todo"], ["imp", "★ Imprescindibles"], ["familia", "💬 Recomienda la familia"], ["sinvoto", "Me falta votar"], ["lluvia", "Con lluvia"], ["gratis", "Gratis"], ["reserva", "Necesita reserva"], ["marea", "Depende de la marea"],
  ...Object.entries(ZONAS)];
let filtro = "todas";
function renderFiltros() {
  $("#filtros").innerHTML = FILTROS.map(([k, v]) => `<button class="chip" data-z="${k}" aria-pressed="${k === filtro}">${v}</button>`).join("");
}
function pintarIdeas() {
  const q = $("#buscar").value.trim().toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
  const norm = t => t.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
  const minutos = t => { if (/ciudad|lado de casa/i.test(t)) return 0; const h = /(\d+)\s*h/.exec(t), m = /(\d+)\s*min/.exec(t); return (h ? +h[1] * 60 : 0) + (m ? +m[1] : 0) || 999; };
  let ids = Object.keys(S).filter(id => {
    const s = S[id], i = s.info || {};
    if (q && !norm(s.n + " " + s.d + " " + ZONAS[s.z]).includes(q)) return false;
    switch (filtro) {
      case "todas": return true;
      case "imp": return s.val >= 5;
      case "familia": return famDe(id).length > 0;
      case "sinvoto": return !miVoto(id);
      case "lluvia": return s.tags.includes("lluvia ok");
      case "gratis": return /gratis/i.test(i.entrada || "") && !/€/.test(i.entrada || "");
      case "reserva": return i.reserva && i.reserva !== "no";
      case "marea": return !!s.marea;
      default: return s.z === filtro;
    }
  });
  const orden = $("#orden").value;
  const clave = {
    val: id => -S[id].val * 10 - (NOTAS[id] ? NOTAS[id].nota : 0),
    grupo: id => -resumen(id).score * 100 - S[id].val,
    google: id => NOTAS[id] ? -NOTAS[id].nota * 1000 - Math.log10(NOTAS[id].resenas + 1) : 0,
    cerca: id => minutos(S[id].t)
  }[orden];
  ids.sort((a, b) => clave(a) - clave(b));
  $("#resultado-n").textContent = `${ids.length} sitios`;
  $("#ideas-grid").innerHTML = ids.length ? ids.map(tarjeta).join("") : `<p class="vacio">No hay sitios con ese filtro.${filtro === "sinvoto" ? " ¡Ya lo has votado todo!" : ""}</p>`;
  actualizar();
}

// ---------- Votación del grupo ----------
function textoResumen() {
  const ids = Object.keys(S).filter(id => resumen(id).total).sort((a, b) => resumen(b).score - resumen(a).score);
  let t = `🗺️ Cantabria 12–18 oct: lo que más gusta al grupo (${votantes().join(", ")})\n\n`;
  ids.slice(0, 15).forEach((id, i) => { const r = resumen(id); t += `${i + 1}. ${S[id].n}  👍${r.si.length} 🤔${r.quiza.length} 👎${r.no.length}\n`; });
  return t + `\nVotad aquí: ${location.origin}${location.pathname}`;
}
function renderGrupo() {
  const el = $("#p-grupo"); if (!el) return;
  const V = votos(), personas = Object.keys(V);
  const ids = Object.keys(S).sort((a, b) => resumen(b).score - resumen(a).score || S[b].val - S[a].val);
  const total = Object.keys(S).length;
  const misVotados = Object.keys(S).filter(id => miVoto(id)).length;
  const coms = [...remoto.comentarios].sort((a, b) => b.ts - a.ts).slice(0, 40);
  const porDia = DIAS.filter(d => d.items.length).map(d => {
    const top = ordenarPorGrupo([...d.items, ...d.alt]).filter(id => resumen(id).score > 0).slice(0, 4);
    const gp = planesDe(d.k).map(p => ({ p, r: resumen(p.id) })).filter(x => x.r.total).sort((a, b) => b.r.score - a.r.score)[0];
    return `<li><b>${d.d} ${d.n}:</b> ${gp ? `<a href="#" data-ir-dia="${d.k}">plan ${esc(gp.p.letra)}</a> (👍${gp.r.si.length}) · ` : ""}${top.length ? top.map(id => `<a href="#" data-ir-sitio="${id}">${esc(S[id].n)}</a>`).join(", ") : "<span style='color:var(--muted)'>sin votos aún</span>"}</li>`;
  }).join("");
  el.innerHTML = `
    ${online === false ? `<p class="nota">No hay conexión con el servidor: aquí solo ves tus votos. Cuando vuelva la conexión se suben solos.</p>` : ""}
    <div class="dos-col">
      <div>
        <h2 class="sec">Quién ha votado</h2>
        <div class="personas">${personas.length ? personas.map(n => `<span class="persona">${av(n)}<span><b>${esc(n)}</b><br><small style="color:var(--muted)">${Object.keys(V[n] || {}).length} de ${total} votados</small></span></span>`).join("") : `<span style="color:var(--muted)">Todavía nadie.</span>`}</div>
        <p style="font-family:Archivo,sans-serif">${yo() ? `Tú llevas <b>${misVotados} de ${total}</b>.` : "Di quién eres para votar."}
          ${misVotados < total ? `<button class="btn peq" data-accion="faltan">Votar lo que me falta</button>` : "¡Lo has votado todo!"}
          <button class="btn peq sec" data-accion="copiar">Copiar resumen para WhatsApp</button></p>
        <h2 class="sec">Ranking del grupo</h2>
        <ol class="ranking">${ids.map((id, i) => {
          const r = resumen(id), s = S[id], f = FOTOS[id], g = NOTAS[id], tot = r.total || 1;
          return `<li class="rk" data-ir-sitio="${id}" tabindex="0">
            <span class="pos">${r.total ? i + 1 : "–"}</span>
            ${f ? `<img src="img/${f[0].f}-m.webp" alt="" loading="lazy">` : `<span class="mini"></span>`}
            <span><span class="nom">${esc(s.n)}</span><br><span class="det"><span style="color:var(--oro)">${"★".repeat(s.val)}</span> ${VALORACION[s.val]}${g ? ` · Google ${fmtNota(g.nota)}` : ""} · ${ZONAS[s.z]}</span>
              ${r.total ? `<span class="barra"><i style="width:${r.si.length / tot * 100}%;background:var(--monte)"></i><i style="width:${r.quiza.length / tot * 100}%;background:var(--quiza)"></i><i style="width:${r.no.length / tot * 100}%;background:var(--rojo)"></i></span>` : ""}</span>
            <span class="avs">${r.si.map(n => av(n, "si")).join("")}${r.quiza.map(n => av(n, "quiza")).join("")}${r.no.map(n => av(n, "no")).join("")}</span>
          </li>`;
        }).join("")}</ol>
      </div>
      <div>
        <h2 class="sec">Lo que más gusta cada día</h2>
        <ul style="font-family:Archivo,sans-serif;padding-left:18px;line-height:1.5">${porDia}</ul>
        <h2 class="sec">Lo que nos recomienda la familia</h2>
        ${(() => { const F = typeof FAMILIA === "undefined" ? [] : FAMILIA; const quienes = [...new Set(F.map(f => f.quien))];
          const deLista = q => Object.keys(RESTAURANTES).filter(id => RESTAURANTES[id].recomienda === q && !famDe(id).length).length;
          return quienes.length ? quienes.map(q => `<div class="caja" style="margin-bottom:10px"><h3>💬 ${esc(q)}</h3><ul style="font-family:Archivo,sans-serif;font-size:14px">${F.filter(f => f.quien === q).map(f => `<li>${enlaceFamilia(f)}: ${esc(f.txt)}</li>`).join("")}${deLista(q) ? `<li>🍽 <a href="#" data-accion="restos-familia">${deLista(q)} restaurantes de su lista</a></li>` : ""}</ul></div>`).join("")
            : `<p style="color:var(--muted)">Todavía nada.</p>`; })()}
        <h2 class="sec">Restaurantes que más gustan</h2>
        ${(() => { const top = idsRestos().filter(id => resumen(id).score > 0).sort((a, b) => resumen(b).score - resumen(a).score).slice(0, 8);
          return top.length ? `<ol style="font-family:Archivo,sans-serif;padding-left:22px;line-height:1.6">${top.map(id => { const r = resumen(id), x = resto(id); return `<li><a href="#" data-ir-resto="${id}">${esc(x.n)}</a> <small style="color:var(--muted)">${esc(x.pueblo || x.lugar || "")} · 👍${r.si.length}${r.quiza.length ? " 🤔" + r.quiza.length : ""}</small></li>`; }).join("")}</ol>`
            : `<p style="color:var(--muted)">Todavía nadie ha votado restaurantes.</p>`; })()}
        <h2 class="sec">Últimos comentarios</h2>
        <div class="feed">${coms.length ? coms.map(c => htmlCom(c, true)).join("") : `<p style="color:var(--muted)">Todavía no hay comentarios. Se escriben desde cada sitio.</p>`}</div>
      </div>
    </div>`;
}

// ---------- Mapa ----------
let mapa = null, marcadores = {}, capas = {}, yoPos = null, yoMarca = null, yoCirculo = null, yoWatch = null, centradoEnMi = false;
const CAPAS_MAPA = {
  pueblo: ["🏘", "Pueblos y ciudades"], costa: ["🌊", "Costa y playas"], monte: ["⛰", "Monte, rutas y miradores"],
  cultura: ["🏛", "Cuevas, museos y visitas"], salir: ["🍷", "Para tomar algo"], resto: ["🍽", "Restaurantes"], aparcar: ["🅿️", "Aparcar cerca de casa"], casa: ["🏠", "Casas"]
};
const CAT_SITIO = {
  arnia: "costa", urros: "costa", liencres: "costa", oyambre: "costa", sardinero: "costa", somo: "costa", gaztelugatxe: "costa",
  zumaia: "costa", zarautz: "costa", cabomayor: "costa", sonabia: "costa", faro: "monte", fuentede: "monte", horcados: "monte",
  cares: "monte", aliva: "monte", lagos: "monte", bulnes: "monte", covadonga: "cultura", santacatalina: "monte", iguedri: "monte", curenas: "monte", ebro: "monte", botin: "cultura", toribio: "cultura",
  sanmames: "cultura", guggenheim: "cultura", soplao: "cultura", castillo: "cultura", altamira: "cultura", cabarceno: "cultura",
  juliobriga: "cultura", magdalena: "cultura", rabas: "salir", cascoviejo: "salir", marzana: "salir"
};
const catSitio = id => CAT_SITIO[id] || "pueblo";
let filtroMapa = { capas: new Set(Object.keys(CAPAS_MAPA)), dia: "", q: "", rPrecio: 99, rNota: 0, rHoy: false, rFam: false, rChollo: false, rVotos: false };
const DIA_HOY = () => ["dom", "lun", "mar", "mie", "jue", "vie", "sab"][new Date().getDay()];
function colorMapa(id) {
  const r = resumen(id);
  if (!r.total) return "#7C8B93";
  if (r.si.length > r.no.length && r.si.length >= r.quiza.length) return "#2F6B3E";
  if (r.no.length > r.si.length) return "#C8102E";
  return "#B7862B";
}
function distKm(a, b) {
  const R = 6371, rad = x => x * Math.PI / 180, dLat = rad(b[0] - a[0]), dLon = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
const fmtKm = d => d < 1 ? `${Math.round(d * 1000)} m` : `${d < 10 ? d.toFixed(1).replace(".", ",") : Math.round(d)} km`;
const irA = c => `https://www.google.com/maps/dir/?api=1&destination=${c[0]},${c[1]}&travelmode=driving`;
function cargarScript(src) { return new Promise((ok, mal) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = mal; document.head.appendChild(s); }); }
function cargarCss(href) { const l = document.createElement("link"); l.rel = "stylesheet"; l.href = href; document.head.appendChild(l); }
function iconoSitio(id) {
  const s = S[id], tam = 26 + s.val * 2;
  return L.divIcon({ className: "", iconSize: [tam, tam], iconAnchor: [tam / 2, tam / 2], popupAnchor: [0, -tam / 2],
    html: `<span class="pin" style="width:${tam}px;height:${tam}px;font-size:${tam * .5}px;border-color:${colorMapa(id)}">${CAPAS_MAPA[catSitio(id)][0]}</span>` });
}
function iconoResto(id) {
  const r = RESTAURANTES[id], fam = r.recomienda || famDe(id).length, ch = esChollo(id);
  return L.divIcon({ className: "", iconSize: [54, 22], iconAnchor: [27, 11], popupAnchor: [0, -10],
    html: `<span class="pin-r${fam ? " fam" : ""}${ch ? " chollo" : ""}" style="border-color:${resumen(id).total ? colorMapa(id) : ""}">${ch ? "💎" : "🍽"} ${r.nota ? fmtNota(r.nota) : "?"}</span>` });
}
function popupSitio(id) {
  const s = S[id], f = FOTOS[id], g = NOTAS[id], i = s.info || {}, d = yoPos ? distKm(yoPos, s.c) : null;
  return `${f ? `<img src="img/${f[0].f}-m.webp" alt="">` : ""}<div class="pp-cat">${CAPAS_MAPA[catSitio(id)].join(" ")}</div>
    <b class="pp-t">${esc(s.n)}</b><div><span style="color:#D9A21B">${"★".repeat(s.val)}</span> ${VALORACION[s.val]}${g ? ` · Google ${fmtNota(g.nota)}` : ""}</div>
    <div class="pp-meta">⏱ ${esc(s.dur)}${i.entrada && i.entrada !== "—" ? ` · 🎟 ${esc(i.entrada)}` : ""}${d != null ? ` · 📍 a ${fmtKm(d)}` : ""}</div>
    ${famDe(id).map(x => `<div class="pp-fam">💬 ${esc(x.quien)}: ${esc(x.txt)}</div>`).join("")}
    <div class="pp-acc"><a class="btn peq" href="${irA(s.c)}" target="_blank" rel="noopener">🚗 Cómo llegar</a><a class="btn peq sec" href="#" data-ir-sitio="${id}">Ficha y votar</a></div>`;
}
function popupResto(id) {
  const r = RESTAURANTES[id], c = [r.lat, r.lon], d = yoPos ? distKm(yoPos, c) : null, hoy = DIA_HOY(), cierra = cierraDia(r, hoy);
  return `<div class="pp-cat">🍽 ${esc(r.tipo || "Restaurante")}</div><b class="pp-t">${esChollo(id) ? "💎 " : ""}${esc(r.n)}</b>
    <div>${r.nota ? `★ ${fmtNota(r.nota)}${r.resenas ? ` (${fmtN(r.resenas)})` : ""}` : "Sin nota"}${r.precio ? ` · 💶 ${esc(r.precio)}` : ""}</div>
    <div class="pp-meta">📍 ${esc(r.pueblo)}${d != null ? ` · a ${fmtKm(d)}` : ""}</div>
    ${cierra ? `<div class="pp-aviso">⚠ Hoy (${DIA_NOMBRE[hoy]}) cierra</div>` : r.cierre ? `<div class="pp-meta">🚪 ${esc(r.cierre)}</div>` : ""}
    ${r.pedir ? `<div class="pp-meta">Qué pedir: ${esc(r.pedir)}</div>` : ""}
    ${r.recomienda ? `<div class="pp-fam">💬 Lo recomienda ${esc(r.recomienda)}${r.nf ? `: «${esc(r.nf)}»` : ""}</div>` : ""}
    <div class="pp-acc"><a class="btn peq" href="${irA(c)}" target="_blank" rel="noopener">🚗 Cómo llegar</a><a class="btn peq sec" href="#" data-ir-resto="${id}">Ficha y votar</a></div>`;
}
async function abrirMapa() {
  if (mapa) { setTimeout(() => mapa.invalidateSize(), 50); return; }
  cargarCss("https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css");
  cargarCss("https://cdnjs.cloudflare.com/ajax/libs/leaflet.markercluster/1.5.3/MarkerCluster.min.css");
  cargarCss("https://cdnjs.cloudflare.com/ajax/libs/leaflet.markercluster/1.5.3/MarkerCluster.Default.min.css");
  try { await cargarScript("https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"); }
  catch (e) { $("#mapa").innerHTML = "<p style='padding:20px'>No se ha podido cargar el mapa.</p>"; return; }
  try { await cargarScript("https://cdnjs.cloudflare.com/ajax/libs/leaflet.markercluster/1.5.3/leaflet.markercluster.min.js"); } catch (e) {}
  mapa = L.map("mapa", { scrollWheelZoom: true, tap: true }).setView([43.3, -3.9], 8);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(mapa);
  for (const k of Object.keys(CAPAS_MAPA)) {
    capas[k] = k === "resto" && L.markerClusterGroup
      ? L.markerClusterGroup({ disableClusteringAtZoom: 15, maxClusterRadius: 45, showCoverageOnHover: false })
      : L.layerGroup();
    capas[k].addTo(mapa);
  }
  for (const [id, s] of Object.entries(S)) {
    if (!s.c || id === "cocido") continue;
    marcadores[id] = L.marker(s.c, { icon: iconoSitio(id), title: s.n }).bindPopup(() => popupSitio(id), { maxWidth: 260 });
  }
  for (const [id, r] of Object.entries(RESTAURANTES)) {
    if (r.lat == null || r.lon == null) continue;
    marcadores[id] = L.marker([r.lat, r.lon], { icon: iconoResto(id), title: r.n }).bindPopup(() => popupResto(id), { maxWidth: 260 });
  }
  const casaSdr = VIAJE.casas[0].c;
  APARCAR.forEach(pk => {
    const d = distKm(casaSdr, pk.c), min = Math.round(d * 1.3 / 5 * 60);
    const andando = `https://www.google.com/maps/dir/?api=1&origin=${pk.c[0]},${pk.c[1]}&destination=${encodeURIComponent(VIAJE.casas[0].q)}&travelmode=walking`;
    const color = { gratis: "pk-gratis", pago: "pk-pago", duda: "pk-duda" }[pk.tipo];
    marcadores[pk.id] = L.marker(pk.c, { title: pk.n, zIndexOffset: 500, icon: L.divIcon({ className: "", iconSize: [28, 28], iconAnchor: [14, 14], html: `<span class="pin-pk ${color}">P</span>` }) })
      .bindPopup(() => `<div class="pp-cat">🅿️ ${pk.tipo === "gratis" ? "Gratis" : pk.tipo === "pago" ? "De pago" : "Gratis, sin confirmar"}${pk.cap ? ` · unas ${pk.cap} plazas` : ""}</div><b class="pp-t">${esc(pk.n)}</b>
        <div class="pp-meta">🏠 A ${fmtKm(d)} de casa · unos ${min} min andando${yoPos ? ` · 📍 a ${fmtKm(distKm(yoPos, pk.c))} de ti` : ""}</div><div class="pp-meta">${esc(pk.txt)}</div>
        <div class="pp-acc"><a class="btn peq" href="${irA(pk.c)}" target="_blank" rel="noopener">🚗 Ir en coche</a><a class="btn peq sec" href="${andando}" target="_blank" rel="noopener">🚶 Andando a casa</a></div>`, { maxWidth: 260 });
  });
  VIAJE.casas.forEach((c, n) => {
    marcadores["casa" + n] = L.marker(c.c, { title: c.n, zIndexOffset: 1000, icon: L.divIcon({ className: "", iconSize: [36, 36], iconAnchor: [18, 18], html: `<span class="pin pin-casa">🏠</span>` }) })
      .bindPopup(() => `<b class="pp-t">🏠 ${esc(c.n)}</b><div class="pp-meta">${esc(c.d)}</div><div class="pp-acc"><a class="btn peq" href="${irA(c.c)}" target="_blank" rel="noopener">🚗 Cómo llegar</a></div>`);
  });
  pintarControlesMapa();
  mapaFiltrar(true);
}
function visibleEnMapa(id) {
  const f = filtroMapa, q = norm(f.q);
  if (id.startsWith("casa")) return f.capas.has("casa");
  if (id.startsWith("pk-")) return f.capas.has("aparcar");
  if (S[id]) {
    if (!f.capas.has(catSitio(id))) return false;
    if (f.dia) { const d = DIAS.find(x => x.k === f.dia); if (!d.items.includes(id) && !d.alt.includes(id)) return false; }
    return !q || norm(S[id].n + " " + S[id].d).includes(q);
  }
  const r = RESTAURANTES[id]; if (!r || !f.capas.has("resto")) return false;
  const fam = r.recomienda || famDe(id).length;
  if (f.dia && (!(DIA_ZONAS[f.dia] || []).includes(r.zona) || cierraDia(r, f.dia))) return false;
  if (r.pm && r.pm > f.rPrecio) return false;
  if (f.rNota && (r.nota || 0) < f.rNota) return false;
  if (f.rHoy && cierraDia(r, DIA_HOY())) return false;
  if (f.rFam && !fam) return false;
  if (f.rChollo && !esChollo(id)) return false;
  if (f.rVotos && !(resumen(id).si.length)) return false;
  return !q || norm([r.n, r.pueblo, r.tipo, r.pedir].join(" ")).includes(q);
}
function mapaFiltrar(ajustar) {
  if (!mapa) return;
  let ns = 0, nr = 0, np = 0; const vis = [];
  for (const [id, m] of Object.entries(marcadores)) {
    const capa = id.startsWith("casa") ? capas.casa : id.startsWith("pk-") ? capas.aparcar : S[id] ? capas[catSitio(id)] : capas.resto;
    const ver = visibleEnMapa(id);
    if (ver && !capa.hasLayer(m)) capa.addLayer(m);
    if (!ver && capa.hasLayer(m)) capa.removeLayer(m);
    if (ver) { vis.push(m.getLatLng()); if (S[id]) ns++; else if (RESTAURANTES[id]) nr++; else if (id.startsWith("pk-")) np++; }
  }
  $("#mapa-info").textContent = `En el mapa: ${ns} sitios, ${nr} restaurantes y ${np} aparcamientos${filtroMapa.dia ? ` (${DIAS.find(d => d.k === filtroMapa.dia).d})` : ""}.`;
  if (ajustar && vis.length) mapa.fitBounds(L.latLngBounds(vis), { padding: [30, 30], maxZoom: 14 });
  pintarCerca();
}
function pintarControlesMapa() {
  const f = filtroMapa;
  $("#mapa-capas").innerHTML = Object.entries(CAPAS_MAPA).map(([k, [e, t]]) => `<button class="chip" data-capa="${k}" aria-pressed="${f.capas.has(k)}">${e} ${t}</button>`).join("") +
    `<button class="chip" data-capa="solo-resto" aria-pressed="false">Solo restaurantes</button><button class="chip" data-capa="solo-aparcar" aria-pressed="false">Solo aparcar</button><button class="chip" data-capa="todo" aria-pressed="false">Ver todo</button>`;
  $("#mapa-restos").hidden = !f.capas.has("resto");
  $$("#mapa-restos [data-rf]").forEach(b => b.setAttribute("aria-pressed", !!f[b.dataset.rf]));
}
function pintarCerca() {
  const el = $("#cerca"); if (!el) return;
  if (!yoPos) { el.innerHTML = ""; return; }
  const lista = Object.keys(marcadores).filter(id => !id.startsWith("casa") && !id.startsWith("pk-") && visibleEnMapa(id))
    .map(id => ({ id, c: S[id] ? S[id].c : [RESTAURANTES[id].lat, RESTAURANTES[id].lon] })).map(x => ({ ...x, d: distKm(yoPos, x.c) }))
    .sort((a, b) => a.d - b.d).slice(0, 12);
  el.innerHTML = `<h2 class="sec">Cerca de ti</h2><ol class="ranking">${lista.map(x => {
    const esS = !!S[x.id], o = esS ? S[x.id] : RESTAURANTES[x.id];
    const det = esS ? `${CAPAS_MAPA[catSitio(x.id)][0]} ${"★".repeat(o.val)} ${VALORACION[o.val]}` : `🍽 ${o.nota ? "★ " + fmtNota(o.nota) : ""}${o.precio ? " · " + esc(o.precio) : ""}${cierraDia(o, DIA_HOY()) ? " · ⚠ hoy cierra" : ""}`;
    return `<li class="rk cerca-it" data-ver="${x.id}" tabindex="0"><span class="pos" style="font-size:15px">${fmtKm(x.d)}</span>
      <span style="grid-column:span 2"><span class="nom">${esc(o.n)}</span><br><span class="det">${det}</span></span>
      <a class="btn peq" href="${irA(x.c)}" target="_blank" rel="noopener">Ir</a></li>`;
  }).join("")}</ol>`;
}
function localizarme() {
  if (!navigator.geolocation) return toast("Este navegador no permite ver tu ubicación");
  if (yoWatch != null) { if (yoPos) mapa.setView(yoPos, Math.max(mapa.getZoom(), 13)); return; }
  $("#btn-yo").textContent = "📍 Buscando…";
  yoWatch = navigator.geolocation.watchPosition(p => {
    yoPos = [p.coords.latitude, p.coords.longitude];
    const icon = L.divIcon({ className: "", iconSize: [22, 22], iconAnchor: [11, 11], html: `<span class="yo-punto"></span>` });
    if (!yoMarca) {
      yoMarca = L.marker(yoPos, { icon, zIndexOffset: 2000, title: "Estás aquí" }).addTo(mapa).bindPopup("📍 Estás aquí");
      yoCirculo = L.circle(yoPos, { radius: p.coords.accuracy, color: "#1A73E8", weight: 1, fillOpacity: .1 }).addTo(mapa);
    } else { yoMarca.setLatLng(yoPos); yoCirculo.setLatLng(yoPos).setRadius(p.coords.accuracy); }
    if (!centradoEnMi) { centradoEnMi = true; mapa.setView(yoPos, 13); }
    $("#btn-yo").textContent = "📍 Centrar en mí";
    pintarCerca();
  }, e => {
    yoWatch = null; $("#btn-yo").textContent = "📍 Dónde estoy";
    toast(e.code === 1 ? "Has denegado el permiso de ubicación: actívalo en el navegador" : "No se ha podido obtener tu ubicación");
  }, { enableHighAccuracy: true, maximumAge: 30000, timeout: 20000 });
}
function recolorearMapa() {
  if (!mapa) return;
  for (const id in marcadores) { if (S[id]) marcadores[id].setIcon(iconoSitio(id)); else if (RESTAURANTES[id]) marcadores[id].setIcon(iconoResto(id)); }
}
// Controles del mapa
document.addEventListener("click", e => {
  const c = e.target.closest("[data-capa]");
  if (c) {
    const k = c.dataset.capa, f = filtroMapa;
    if (k === "todo") f.capas = new Set(Object.keys(CAPAS_MAPA));
    else if (k === "solo-resto") f.capas = new Set(["resto", "casa"]);
    else if (k === "solo-aparcar") { f.capas = new Set(["aparcar", "casa"]); pintarControlesMapa(); mapaFiltrar(); mapa.setView([43.465, -3.805], 14); $("#mapa-ola").hidden = false; return; }
    else if (f.capas.has(k)) f.capas.delete(k); else f.capas.add(k);
    $("#mapa-ola").hidden = !f.capas.has("aparcar") || f.capas.size > 4;
    pintarControlesMapa(); mapaFiltrar(k === "todo" || k === "solo-resto"); return;
  }
  const rf = e.target.closest("[data-rf]"); if (rf) { filtroMapa[rf.dataset.rf] = !filtroMapa[rf.dataset.rf]; pintarControlesMapa(); mapaFiltrar(); return; }
  if (e.target.closest("#btn-yo")) { localizarme(); return; }
  if (e.target.closest("#btn-ajustar")) { mapaFiltrar(true); return; }
  const v = e.target.closest("[data-ver]"); if (v && !e.target.closest("a")) { const m = marcadores[v.dataset.ver]; if (m) { mapa.setView(m.getLatLng(), 15); setTimeout(() => m.openPopup(), 300); window.scrollTo({ top: $("#mapa").getBoundingClientRect().top + scrollY - 70 }); } }
});
document.addEventListener("change", e => {
  if (e.target.id === "mapa-dia") { filtroMapa.dia = e.target.value; mapaFiltrar(true); }
  if (e.target.id === "mapa-precio") { filtroMapa.rPrecio = +e.target.value; mapaFiltrar(); }
  if (e.target.id === "mapa-nota") { filtroMapa.rNota = +e.target.value; mapaFiltrar(); }
});
document.addEventListener("input", e => { if (e.target.id === "mapa-q") { filtroMapa.q = e.target.value; mapaFiltrar(); } });

// ---------- Reservas ----------
function renderReservas() {
  const T = tareas(), hechas = TAREAS.filter(t => T[t.id]).length;
  $("#cnt-tareas").textContent = TAREAS.length - hechas;
  $("#cnt-tareas").hidden = hechas === TAREAS.length;
  const el = $("#p-reservas"); if (!el) return;
  const conEntrada = Object.keys(S).filter(id => { const i = S[id].info || {}; return (i.reserva && i.reserva !== "no") || /€/.test(i.entrada || ""); })
    .sort((a, b) => ({ obligatoria: 0, recomendada: 1, no: 2 }[S[a].info.reserva] - { obligatoria: 0, recomendada: 1, no: 2 }[S[b].info.reserva]));
  el.innerHTML = `
    <h2 class="sec">Cosas por hacer (${hechas} de ${TAREAS.length})</h2>
    <p class="intro">Marcad lo que vayáis haciendo: lo ve todo el grupo y queda apuntado quién lo hizo.</p>
    <ul class="tareas">${TAREAS.map(t => {
      const h = T[t.id];
      return `<li class="tarea${h ? " hecha" : ""}"><input type="checkbox" data-tarea="${t.id}" ${h ? "checked" : ""} aria-label="${esc(t.t)}">
        <div><div class="tt">${esc(t.t)}</div><div class="det">${esc(t.cuando)}${t.url ? ` · <a href="${esc(t.url)}" target="_blank" rel="noopener">Abrir web</a>` : ""}${h ? ` · ✔ ${esc(h.por)}, ${hace(h.ts)}` : ""}</div></div></li>`;
    }).join("")}</ul>
    <h2 class="sec">Entradas, precios y reservas</h2>
    <p class="intro">Todo lo que tiene entrada de pago o pide reserva. El resto de sitios son gratis y sin reserva. Datos comprobados el 11 de octubre en las webs oficiales.</p>
    <div class="tabla-cont"><table><thead><tr><th>Sitio</th><th>Reserva</th><th>Entrada</th><th>Horario y avisos</th></tr></thead><tbody>
    ${conEntrada.map(id => { const s = S[id], i = s.info; return `<tr><td><a href="#" data-ir-sitio="${id}"><b>${esc(s.n)}</b></a></td>
      <td><span class="chip-res ${i.reserva}">${RES[i.reserva]}</span>${i.url ? `<br><a href="${esc(i.url)}" target="_blank" rel="noopener">Web</a>` : ""}</td>
      <td>${esc(i.entrada)}</td><td>${esc(i.horario || "")}${i.aviso ? `<br><span style="color:var(--rojo)">${esc(i.aviso)}</span>` : ""}</td></tr>`; }).join("")}
    </tbody></table></div>`;
}

// ---------- Mareas e información ----------
function renderInfo() {
  const filasMarea = p => DIAS.map(d => {
    const m = MAREAS[p][d.n]; if (!m) return "";
    const b = m.m.filter(x => x[1] === "b").map(x => horaMin(x[0]) >= 8 * 60 && horaMin(x[0]) <= 20 * 60 ? `<b>${x[0]}</b>` : x[0]).join(" · ");
    const pl = m.m.filter(x => x[1] === "p").map(x => x[0]).join(" · ");
    return `<tr><td>${d.d} ${d.n}</td><td class="num">${b}</td><td class="num">${pl}</td><td class="num">${m.coef} <small>(${coefTxt(m.coef)})</small></td><td class="num">${m.sol[0]} – ${m.sol[1]}</td></tr>`;
  }).join("");
  const tablaMarea = (p, t) => `<h3 style="font-size:17px;margin:18px 0 8px">${t}</h3><div class="tabla-cont"><table><thead><tr><th>Día</th><th>Bajamar</th><th>Pleamar</th><th>Coeficiente</th><th>Sol</th></tr></thead><tbody>${filasMarea(p)}</tbody></table></div>`;
  const dependen = Object.keys(S).filter(id => S[id].marea);
  const creditos = Object.keys(FOTOS).map(id => `<li><b>${esc(S[id] ? S[id].n : id)}:</b> ${FOTOS[id].map(f => `<a href="${esc(f.u)}" target="_blank" rel="noopener">${esc(f.a.slice(0, 40))}</a> (${esc(f.l)})`).join(", ")}</li>`).join("");
  $("#p-info").innerHTML = `
    <h2 class="sec">Mareas de la semana</h2>
    <p class="intro">Las mareas se predicen con exactitud: estas son las horas oficiales para la semana (hora peninsular). Los coeficientes empiezan altos (85 el lunes: la marea baja muchísimo) y van bajando hasta 28 el domingo. En negrita, las bajamares de día. <b>El lunes, con bajamar a las 12:08 y coeficiente 85, es el mejor día para la Costa Quebrada.</b></p>
    ${tablaMarea("santander", "Santander (Costa Quebrada, Liencres, Somo, Santoña)")}
    ${tablaMarea("bermeo", "Bermeo (Gaztelugatxe, Mundaka)")}
    ${tablaMarea("zumaia", "Zumaia (flysch)")}
    <p style="font-family:Archivo,sans-serif;font-size:13px;color:var(--muted)">Fuente: <a href="https://tablademareas.com/es/cantabria/santander" target="_blank" rel="noopener">tablademareas.com</a>, consultada el 11-oct-2026. Contraste oficial en <a href="https://portus.puertos.es/" target="_blank" rel="noopener">Puertos del Estado</a>.</p>
    <h2 class="sec">Qué depende de la marea</h2>
    <div class="cajas">${dependen.map(id => `<div class="caja"><h3><a href="#" data-ir-sitio="${id}">${esc(S[id].n)}</a></h3><p>${esc(S[id].marea.txt)}</p></div>`).join("")}</div>
    <h2 class="sec">Aparcar cerca de casa (calle Lealtad)</h2>
    <p class="intro">${esc(OLA.resumen)}</p>
    <p class="nota sol">${esc(OLA.truco)}</p>
    <p class="nota">📱 ${esc(OLA.app)} <a href="${OLA.appUrl.android}" target="_blank" rel="noopener">Android</a> · <a href="${OLA.appUrl.ios}" target="_blank" rel="noopener">iPhone</a></p>
    <div class="cajas">${APARCAR.map(pk => `<div class="caja"><h3>${pk.tipo === "gratis" ? "🟢 Gratis" : pk.tipo === "pago" ? "🔵 De pago" : "🟠 Sin confirmar"}${pk.cap ? ` · ${pk.cap} plazas` : ""}</h3>
      <p><b>${esc(pk.n)}</b></p><p>${esc(pk.txt)}</p><p><a href="${irA(pk.c)}" target="_blank" rel="noopener">🚗 Cómo llegar</a> · <a href="#mapa" data-accion="mapa-aparcar">Ver en el mapa</a></p></div>`).join("")}</div>
    <h2 class="sec">Dónde comer</h2>
    <p class="intro">Está todo en la pestaña <a href="#restaurantes">Restaurantes</a>: los mejores calidad-precio de cada zona, con su nota de Google, y los que vayáis añadiendo.</p>
    <h2 class="sec">Qué probar</h2>
    <div class="cajas"><div class="caja"><ul>${PLATOS.map(([n, d]) => `<li><b>${esc(n)}:</b> ${esc(d)}</li>`).join("")}</ul></div>
      <div class="caja"><h3>Qué llevar</h3><ul><li>Botas de montaña para el miércoles (Horcados Rojos).</li><li>Chubasquero y algo de abrigo: viernes y sábado, lluvia y unos 18 °C.</li><li>Una sudadera para las cuevas (12–14 °C dentro).</li><li>Calzado que agarre para las rocas de la Arnía y los escalones de Gaztelugatxe.</li></ul></div>
      <div class="caja"><h3>Casas y emergencias</h3><ul>${VIAJE.casas.map(c => `<li><a href="${mapsQ(c.q)}" target="_blank" rel="noopener"><b>${esc(c.n)}</b></a>: ${esc(c.d)}</li>`).join("")}<li><b>Emergencias:</b> <a href="tel:112">112</a></li><li><b>Rescate en Picos:</b> también por el 112</li></ul></div></div>
    <h2 class="sec">Sobre los datos</h2>
    <div class="caja" style="font-size:14.5px">
      <p><b>Valoración (estrellas):</b> opinión nuestra de cuánto impresiona cada sitio y si compensa el tiempo que lleva. <b>Nota de Google:</b> la media y el número de reseñas en Google Maps consultados el 11-oct-2026 (cuando no la hay, la de TripAdvisor).</p>
      <p><b>Precios, horarios y reservas:</b> comprobados el 11-oct-2026 en las webs oficiales. Pueden cambiar: confirmad al reservar.</p>
      <p><b>Tiempo:</b> previsión de Open-Meteo, que se actualiza sola al abrir la web; si no carga, la de AEMET del 11 de octubre.</p>
      <details><summary style="cursor:pointer;font-weight:700">Créditos de las fotos (Wikimedia Commons)</summary><ul style="font-size:13px">${creditos}</ul></details>
    </div>`;
}

// ---------- Restaurantes ----------
const restosUsuario = () => remoto.restaurantes || [];
const resto = id => RESTAURANTES[id] || restosUsuario().find(r => r.id === id);
const idsRestos = () => [...Object.keys(RESTAURANTES), ...restosUsuario().map(r => r.id)];
const nombreDe = id => { const x = S[id] || resto(id); return x ? x.n : id; };
const norm = t => String(t || "").toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
const precioNum = p => { const n = String(p || "").match(/\d+/g); return n ? +n[n.length - 1] : null; };
let filtroR = { zona: "todas", dia: "", precio: 30, orden: "cp", q: "" };
const pmDe = id => id.startsWith("u-") ? precioNum(resto(id).precio) : resto(id).pm;
// Calidad-precio: pesa la nota (y su fiabilidad por nº de reseñas) contra el precio por persona
const calidadPrecio = id => { const r = resto(id), pm = pmDe(id) || 25; return (r.nota || 4) * 10 + Math.log10((r.resenas || 50) + 1) * 2 - pm / 4; };
const esChollo = id => { const r = resto(id); return (r.nota || 0) >= 4.5 && (pmDe(id) || 99) <= 20; };
const DIA_NOMBRE = { lun: "lunes", mar: "martes", mie: "miércoles", jue: "jueves", vie: "viernes", sab: "sábado", dom: "domingo" };
// true si el restaurante cierra ese día de la semana («Cierra los lunes…»; lo que va tras «;» son matices de horario)
const ORDEN_DIAS = ["lun", "mar", "mie", "jue", "vie", "sab", "dom"];
const cierraDia = (r, k) => {
  const c = norm((r.cierre || "").split(";")[0]);
  if (!c.includes("cierra")) return false;
  // Rangos del tipo «de lunes a jueves»
  const nombres = ORDEN_DIAS.map(d => norm(DIA_NOMBRE[d]).replace(/s$/, ""));
  const m = c.match(/de (\w+) a (\w+)/);
  if (m) {
    const i0 = nombres.findIndex(n => m[1].startsWith(n)), i1 = nombres.findIndex(n => m[2].startsWith(n));
    if (i0 >= 0 && i1 >= 0) { const i = ORDEN_DIAS.indexOf(k); if (i0 <= i1 ? i >= i0 && i <= i1 : i >= i0 || i <= i1) return true; }
  }
  return c.includes(norm(DIA_NOMBRE[k]));
};
let firmaR = "";
function tarjetaResto(id) {
  const r = resto(id), u = id.startsWith("u-");
  const lugar = u ? r.lugar : [r.barrio, r.pueblo].filter(Boolean).join(", ");
  const maps = u ? (r.maps || mapsQ(`${r.n} ${r.lugar || "Cantabria"}`)) : mapsQ(`${r.n} ${r.pueblo}`);
  const nota = r.nota ? `<span class="ins g" title="Nota de Google${r.resenas ? " con " + r.resenas + " reseñas" : ""}"><span class="est">★</span> ${fmtNota(r.nota)}${r.resenas ? ` <small>· ${fmtN(r.resenas)}</small>` : ""}</span>` : "";
  const precio = r.precio ? `${esc(r.precio)}${/€/.test(r.precio) ? "" : " €"}` : "";
  return `<article class="resto${u ? " propio" : ""}" data-card="${id}">
    <div class="r-cab"><h3>${esChollo(id) ? `<span class="chollo">💎 Chollo</span>` : ""}${esc(r.n)}</h3>${nota}</div>
    <span class="fav-r" data-fav="${id}" hidden></span>
    <div class="meta">${lugar ? `<span>📍 ${esc(lugar)}</span>` : ""}${r.tipo ? `<span>🍽 ${esc(r.tipo)}</span>` : ""}${precio ? `<span>💶 ${precio} por persona</span>` : ""}</div>
    ${u ? `<div class="r-quien">➕ Añadido por <b>${esc(r.autor)}</b>${r.recomienda ? ` · Lo recomienda <b>${esc(r.recomienda)}</b>` : ""}</div>` : ""}
    ${famDe(id).length ? htmlFamilia(id) : !u && r.recomienda ? `<div class="familia">💬 Lo recomienda <b>${esc(r.recomienda)}</b>${r.nf ? `: «${esc(r.nf)}»` : ""}</div>` : ""}
    ${r.por ? `<p>${esc(r.por)}</p>` : ""}${u && r.texto ? `<p>${esc(r.texto)}</p>` : ""}
    ${r.pedir ? `<div class="r-pedir"><b>Qué pedir:</b> ${esc(r.pedir)}</div>` : ""}
    ${r.cierre || r.reserva ? `<ul class="practico-lista">${r.cierre ? `<li><span>🚪</span><span>${esc(r.cierre)}</span></li>` : ""}${r.reserva ? `<li><span>📅</span><span>${esc(r.reserva)}</span></li>` : ""}</ul>` : ""}
    <div class="enlaces"><a href="${esc(maps)}" target="_blank" rel="noopener">Reseñas en Maps</a>${!u ? `<a href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(r.direccion || r.n + " " + r.pueblo)}" target="_blank" rel="noopener">Cómo llegar</a>` : ""}${r.web ? `<a href="${esc(r.web)}" target="_blank" rel="noopener">Web</a>` : ""}${u && r.autor === yo() ? `<button type="button" class="borrar" data-borrar-resto="${id}">Borrar</button>` : ""}</div>
    ${htmlVotoComs(id, r.n)}
    <button type="button" class="fuimos" data-fuimos="${id}" aria-pressed="false">Marcar que ya fuimos</button>
  </article>`;
}
function prepararRestos() {
  $("#dia-r").innerHTML = `<option value="">Cualquier día</option>` + DIAS.map(d => `<option value="${d.k}">${d.d} ${d.n}: ${(DIA_ZONAS[d.k] || []).map(z => ZONAS_R[z]).join(" y ")} (abiertos)</option>`).join("");
  $("#buscar-r").addEventListener("input", e => { filtroR.q = e.target.value; pintarRestos(); });
  $("#dia-r").addEventListener("change", e => { filtroR.dia = e.target.value; pintarRestos(); });
  $("#precio-r").addEventListener("change", e => { filtroR.precio = +e.target.value; pintarRestos(); });
  $("#orden-r").addEventListener("change", e => { filtroR.orden = e.target.value; pintarRestos(); });
  $("#form-resto").addEventListener("submit", async e => {
    e.preventDefault();
    const f = e.target, v = k => f[k].value.trim();
    if (!yo()) return pedirNombre(() => f.requestSubmit());
    if (!online) return toast("Para añadir restaurantes hace falta conexión con el servidor");
    const r = { n: v("n"), lugar: v("lugar"), tipo: v("tipo"), precio: v("precio"), nota: v("nota").replace(",", "."), resenas: v("resenas").replace(/\D/g, ""), maps: v("maps"), recomienda: v("recomienda"), texto: v("texto") };
    if (r.maps && !/^https:\/\//.test(r.maps)) return toast("El enlace tiene que empezar por https://");
    try {
      remoto = await api("restaurante", { nombre: yo(), r });
      f.reset(); $("#anadir-resto").open = false;
      Object.assign(filtroR, { zona: "nuestros", dia: "", q: "" }); $("#buscar-r").value = ""; $("#dia-r").value = "";
      firmaR = ""; actualizar(); toast(`Añadido: ${r.n}`);
    } catch (err) { toast("No se ha podido añadir: " + err.message); }
  });
}
function pintarRestos() {
  const chips = [["todas", "Todos"], ["familia", "💬 Recomendados por la familia"], ...Object.entries(ZONAS_R), ["nuestros", "➕ Añadidos por nosotros"]];
  $("#filtros-r").innerHTML = chips.map(([k, v]) => `<button class="chip" data-zr="${k}" aria-pressed="${k === filtroR.zona}">${v}</button>`).join("");
  $("#dia-r").value = filtroR.dia;
  const q = norm(filtroR.q);
  const ids = idsRestos().filter(id => {
    const r = resto(id), u = id.startsWith("u-");
    if (filtroR.zona === "nuestros" && !u) return false;
    if (filtroR.zona === "familia" && !(r.recomienda || famDe(id).length)) return false;
    if (!["todas", "nuestros", "familia"].includes(filtroR.zona) && (u || r.zona !== filtroR.zona)) return false;
    if (filtroR.dia && !u && (!(DIA_ZONAS[filtroR.dia] || []).includes(r.zona) || cierraDia(r, filtroR.dia))) return false;
    const pm = u ? precioNum(r.precio) : r.pm;
    if (pm && pm > filtroR.precio && !famDe(id).length) return false;
    return !q || norm([r.n, r.pueblo, r.barrio, r.lugar, r.tipo, r.pedir, r.texto].join(" ")).includes(q);
  });
  const clave = {
    cp: id => -calidadPrecio(id),
    nota: id => -((resto(id).nota || 0) * 1e7 + (resto(id).resenas || 0)),
    grupo: id => -(resumen(id).score * 1e8 + (resto(id).nota || 0) * 1e6),
    barato: id => (id.startsWith("u-") ? precioNum(resto(id).precio) : resto(id).pm) || 99,
    resenas: id => -(resto(id).resenas || 0)
  }[filtroR.orden];
  ids.sort((a, b) => clave(a) - clave(b));
  $("#resultado-r").textContent = `${ids.length} restaurantes`;
  $("#restos-grid").innerHTML = ids.length ? ids.map(tarjetaResto).join("")
    : `<p class="vacio">${filtroR.zona === "nuestros" ? "Todavía no habéis añadido ninguno. Usad «Añadir un restaurante» de arriba." : "No hay restaurantes con esos filtros."}</p>`;
  actualizar();
}
function comerDia(d) {
  const zonas = DIA_ZONAS[d.k] || [];
  const ids = Object.keys(RESTAURANTES).filter(id => zonas.includes(RESTAURANTES[id].zona) && !cierraDia(RESTAURANTES[id], d.k))
    .sort((a, b) => resumen(b).score - resumen(a).score || (RESTAURANTES[b].nota - RESTAURANTES[a].nota) || (RESTAURANTES[b].resenas - RESTAURANTES[a].resenas)).slice(0, 4);
  if (!ids.length) return "";
  return `<div class="comer-dia"><h3>Dónde comer este día</h3><ul>${ids.map(id => { const r = RESTAURANTES[id];
    return `<li>🍽 <a href="#" data-ir-resto="${id}"><b>${esc(r.n)}</b></a> <small>${esc(r.pueblo)} · ★ ${fmtNota(r.nota)}${r.pm ? ` · unos ${r.pm} €` : ""}</small></li>`; }).join("")}</ul>
    <button class="btn peq sec" data-accion="restos-dia" data-dia="${d.k}">Ver todos los restaurantes de la zona</button></div>`;
}
function irAResto(id) {
  Object.assign(filtroR, { zona: "todas", dia: "", q: "", precio: 40 });
  $("#buscar-r").value = ""; $("#precio-r").value = "40"; pintarRestos(); abrir("restaurantes");
  const t = $(`#restos-grid [data-card="${id}"]`);
  if (t) { t.scrollIntoView({ block: "start" }); t.animate([{ boxShadow: "0 0 0 4px var(--rojo)" }, { boxShadow: "0 0 0 0 transparent" }], { duration: 1600 }); }
}

// ---------- Galería ----------
let gal = { id: null, i: 0 };
function abrirGaleria(id, i = 0) {
  gal = { id, i }; pintarGaleria();
  const d = $("#dlg-galeria"); if (!d.open) d.showModal();
}
function pintarGaleria() {
  const f = FOTOS[gal.id] || []; if (!f.length) return;
  gal.i = (gal.i + f.length) % f.length;
  const x = f[gal.i];
  $("#gal-img").src = `img/${x.f}.webp`; $("#gal-img").alt = S[gal.id].n;
  $("#gal-tit").textContent = `${S[gal.id].n} · ${gal.i + 1}/${f.length}`;
  $("#gal-pie").innerHTML = `Foto: <a href="${esc(x.u)}" target="_blank" rel="noopener">${esc(x.a.slice(0, 60))}</a> · ${esc(x.l)} · Wikimedia Commons`;
  $("#gal-ant").hidden = $("#gal-sig").hidden = f.length < 2;
  const sig = new Image(); sig.src = `img/${f[(gal.i + 1) % f.length].f}.webp`;
}
$("#gal-ant").addEventListener("click", () => { gal.i--; pintarGaleria(); });
$("#gal-sig").addEventListener("click", () => { gal.i++; pintarGaleria(); });
$("#gal-cerrar").addEventListener("click", () => $("#dlg-galeria").close());
$("#dlg-galeria").addEventListener("keydown", e => { if (e.key === "ArrowLeft") { gal.i--; pintarGaleria(); } if (e.key === "ArrowRight") { gal.i++; pintarGaleria(); } });
(() => { let x0 = null; const d = $("#dlg-galeria");
  d.addEventListener("pointerdown", e => { x0 = e.clientX; });
  d.addEventListener("pointerup", e => { if (x0 === null) return; const dx = e.clientX - x0; x0 = null; if (Math.abs(dx) > 50) { gal.i += dx < 0 ? 1 : -1; pintarGaleria(); } });
})();

// ---------- Pestañas y navegación ----------
const TABS = ["plan", "ideas", "restaurantes", "grupo", "mapa", "reservas", "info"];
function abrir(tab, sinHash) {
  if (!TABS.includes(tab)) tab = "plan";
  $$("nav.tabs [role=tab]").forEach(b => b.setAttribute("aria-selected", b.dataset.tab === tab));
  TABS.forEach(t => $("#p-" + t).hidden = (t !== tab));
  if (tab === "mapa") abrirMapa();
  if (!sinHash && location.hash !== "#" + tab) history.replaceState(null, "", "#" + tab);
}
function irASitio(id) {
  filtro = "todas"; $("#buscar").value = ""; renderFiltros(); pintarIdeas(); abrir("ideas");
  const t = $(`#ideas-grid [data-card="${id}"]`);
  if (t) { t.scrollIntoView({ block: "start" }); t.animate([{ boxShadow: "0 0 0 4px var(--rojo)" }, { boxShadow: "0 0 0 0 transparent" }], { duration: 1600 }); }
}
document.addEventListener("click", e => {
  const tb = e.target.closest("nav.tabs [role=tab]"); if (tb) { abrir(tb.dataset.tab); window.scrollTo({ top: $("nav.tabs").offsetTop + 1 }); return; }
  const db = e.target.closest(".dia-btn"); if (db) { abrir("plan"); $("#dia-" + db.dataset.ir).scrollIntoView(); return; }
  const vb = e.target.closest(".voto button"); if (vb) { votar(vb.dataset.id, vb.dataset.v); return; }
  const gb = e.target.closest("[data-galeria]"); if (gb) { abrirGaleria(gb.dataset.galeria); return; }
  const ch = e.target.closest(".chip[data-z]"); if (ch) { filtro = ch.dataset.z; renderFiltros(); pintarIdeas(); return; }
  const is = e.target.closest("[data-ir-sitio]"); if (is) { e.preventDefault(); if (mapa) mapa.closePopup(); irASitio(is.dataset.irSitio); return; }
  const idia = e.target.closest("[data-ir-dia]"); if (idia) { e.preventDefault(); abrir("plan"); $("#dia-" + idia.dataset.irDia).scrollIntoView(); return; }
  const ir = e.target.closest("[data-ir-resto]"); if (ir) { e.preventDefault(); if (mapa) mapa.closePopup(); irAResto(ir.dataset.irResto); return; }
  const cz = e.target.closest(".chip[data-zr]"); if (cz) { filtroR.zona = cz.dataset.zr; pintarRestos(); return; }
  const fu = e.target.closest("[data-fuimos]"); if (fu) { marcarTarea("f-" + fu.dataset.fuimos, fu.getAttribute("aria-pressed") !== "true"); return; }
  const bz = e.target.closest("[data-borrar-resto]"); if (bz) {
    if (confirm("¿Borrar este restaurante de la lista?")) api("borrarRestaurante", { nombre: yo(), id: bz.dataset.borrarResto }).then(r => { remoto = r; actualizar(); }).catch(() => toast("No se ha podido borrar"));
    return;
  }
  const br = e.target.closest("[data-borrar]"); if (br) {
    if (confirm("¿Borrar este comentario?")) api("borrarComentario", { nombre: yo(), c: br.dataset.borrar }).then(r => { remoto = r; actualizar(); }).catch(() => toast("No se ha podido borrar"));
    return;
  }
  const ac = e.target.closest("[data-accion]"); if (ac) {
    if (ac.dataset.accion === "faltan") { filtro = "sinvoto"; renderFiltros(); pintarIdeas(); abrir("ideas"); window.scrollTo({ top: $("nav.tabs").offsetTop + 1 }); }
    if (ac.dataset.accion === "copiar") compartir(textoResumen());
    if (ac.dataset.accion === "mapa-aparcar") { e.preventDefault(); abrir("mapa"); setTimeout(() => { const b = $('[data-capa="solo-aparcar"]'); if (b) b.click(); }, 900); window.scrollTo({ top: $("nav.tabs").offsetTop + 1 }); }
    if (ac.dataset.accion === "restos-familia") { e.preventDefault(); Object.assign(filtroR, { zona: "familia", dia: "", q: "" }); $("#buscar-r").value = ""; pintarRestos(); abrir("restaurantes"); window.scrollTo({ top: $("nav.tabs").offsetTop + 1 }); }
    if (ac.dataset.accion === "restos-dia") { Object.assign(filtroR, { zona: "todas", dia: ac.dataset.dia, q: "" }); $("#buscar-r").value = ""; pintarRestos(); abrir("restaurantes"); window.scrollTo({ top: $("nav.tabs").offsetTop + 1 }); }
  }
});
document.addEventListener("keydown", e => { if (e.key === "Enter" && e.target.matches(".rk")) irASitio(e.target.dataset.irSitio); });
document.addEventListener("change", e => { if (e.target.matches("[data-tarea]")) marcarTarea(e.target.dataset.tarea, e.target.checked); });
document.addEventListener("submit", e => {
  const f = e.target.closest(".form-com"); if (!f) return;
  e.preventDefault(); const t = f.t.value.trim(); if (!t) return;
  f.t.value = ""; comentar(f.dataset.id, t);
});
$("#buscar").addEventListener("input", () => pintarIdeas());
$("#orden").addEventListener("change", () => pintarIdeas());
window.addEventListener("hashchange", () => abrir(location.hash.slice(1), true));
async function compartir(t) {
  if (navigator.share) { try { await navigator.share({ text: t }); return; } catch (e) { if (e.name === "AbortError") return; } }
  try { await navigator.clipboard.writeText(t); toast("Copiado: pégalo en WhatsApp"); } catch (e) { prompt("Copia este texto:", t); }
}

// ---------- Tema ----------
function aplicarTema() {
  if (local.tema) document.documentElement.dataset.theme = local.tema; else delete document.documentElement.dataset.theme;
}
$("#btn-tema").addEventListener("click", () => {
  const oscuroAhora = local.tema ? local.tema === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  local.tema = oscuroAhora ? "light" : "dark"; guardarLocal(); aplicarTema();
});

// ---------- Arranque ----------
(function iniciar() {
  aplicarTema();
  const hf = FOTOS.urros && FOTOS.urros[0];
  if (hf) {
    $("#hero").style.backgroundImage = `url(img/${hf.f}${innerWidth > 760 ? "" : "-m"}.webp)`;
    const c = $("#credito-hero"); c.href = hf.u; c.textContent = `Urros de Liencres · Foto: ${hf.a.slice(0, 30)}`;
  }
  $("#pie").innerHTML = `Fotos de Wikimedia Commons (créditos en «Mareas e info»). Notas de Google Maps, precios y reservas consultados el 11-oct-2026. Mareas de tablademareas.com. Tiempo de Open-Meteo.`;
  $("#mapa-dia").innerHTML = `<option value="">Todos los días</option>` + DIAS.map(d => `<option value="${d.k}">${d.d} ${d.n}${d.f === hoyISO() ? " (hoy)" : ""}</option>`).join("");
  $("#mapa-ola").innerHTML = `🅿️ <b>Aparcar:</b> ${esc(OLA.resumen)}<br>${esc(OLA.truco)}<br>📱 ${esc(OLA.app)} <a href="${OLA.appUrl.android}" target="_blank" rel="noopener">Android</a> · <a href="${OLA.appUrl.ios}" target="_blank" rel="noopener">iPhone</a><br><span class="pin-pk pk-gratis" style="display:inline-grid;width:18px;height:18px;font-size:11px">P</span> gratis · <span class="pin-pk pk-pago" style="display:inline-grid;width:18px;height:18px;font-size:11px">P</span> de pago · <span class="pin-pk pk-duda" style="display:inline-grid;width:18px;height:18px;font-size:11px">P</span> sin confirmar`;
  renderSemana(); renderFiltros(); prepararRestos(); renderPlan(); pintarIdeas(); pintarRestos(); renderInfo(); renderReservas(); renderGrupo(); pintarYo();
  abrir(location.hash.slice(1) || "plan", true);
  sync(); cargarMeteo();
})();
