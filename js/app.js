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
      <div class="veredicto"><span class="estrellas" aria-label="${s.val} de 5">${estrellas(s.val)}</span> <b>${VALORACION[s.val]}.</b> ${esc(s.por)}</div>
      ${filas.length ? `<ul class="practico-lista">${filas.join("")}</ul>` : ""}
      ${i.aviso ? `<div class="aviso-sitio">⚠ ${esc(i.aviso)}</div>` : ""}
      ${mareaSitio(id)}
      <div class="enlaces">
        <a href="${mapsQ(s.q)}" target="_blank" rel="noopener">Reseñas en Maps</a>
        <a href="${comoLlegar(s)}" target="_blank" rel="noopener">Cómo llegar</a>
        ${i.url ? `<a href="${esc(i.url)}" target="_blank" rel="noopener">Web oficial</a>` : ""}
        <a href="https://www.google.com/search?tbm=isch&q=${encodeURIComponent(s.q)}" target="_blank" rel="noopener">Más fotos</a>
      </div>
      <div class="grupo" data-grupo="${id}"></div>
      <div class="voto" role="group" aria-label="¿Te apetece ${esc(s.n)}?">
        ${[["si", "👍 Me apetece"], ["quiza", "🤔 Quizá"], ["no", "👎 Paso"]].map(([k, l]) => `<button type="button" data-id="${id}" data-v="${k}" aria-pressed="false">${l}</button>`).join("")}
      </div>
      <details class="coms" data-coms="${id}">
        <summary>💬 Comentarios (<span data-ncom="${id}">0</span>)</summary>
        <div class="lista"></div>
        <form class="form-com" data-id="${id}"><input name="t" maxlength="800" placeholder="Escribe un comentario…" aria-label="Comentario sobre ${esc(s.n)}" autocomplete="off"><button class="btn peq" type="submit">Enviar</button></form>
      </details>
    </div>
  </article>`;
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
    ${sobre ? `<div class="sobre">sobre <a href="#" data-ir-sitio="${c.id}">${esc(S[c.id] ? S[c.id].n : c.id)}</a></div>` : ""}<div>${esc(c.texto)}</div></div></div>`;
}

// ---------- Actualizar todo lo que depende de votos ----------
function actualizar() {
  $$("[data-grupo]").forEach(pintarGrupo);
  $$(".voto button").forEach(b => b.setAttribute("aria-pressed", miVoto(b.dataset.id) === b.dataset.v));
  const n = votantes().length;
  $$("[data-fav]").forEach(e => {
    const r = resumen(e.dataset.fav), fav = n >= 2 && r.si.length * 2 > n;
    e.hidden = !fav; if (fav) e.textContent = `❤ Gusta a ${r.si.length} de ${n}`;
    e.closest(".sitio").classList.toggle("top", fav);
  });
  Object.keys(S).forEach(pintarComs);
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
      <div class="gente" aria-label="${d.gente} personas">${gente(d.gente)}</div>
      <div class="t">${esc(d.t)}</div></button>`;
  }).join("");
  if (METEO) $("#fuente-meteo").textContent = `Previsión de Open-Meteo actualizada ${hace(METEO.ts)}. Cada día, en la zona donde estaréis`;
  DIAS.forEach((d, i) => { const el = $(`[data-meteo="${d.k}"]`); if (el) el.innerHTML = lineaMeteo(d, i); });
}
function lineaMeteo(d, i) {
  const m = meteoDia(i);
  let t = m ? `${WX(m.code)[0]} <b>${WX(m.code)[1]}</b> · ${Math.round(m.max)}° / ${Math.round(m.min)}° · lluvia ${m.lluvia}% · viento ${Math.round(m.viento)} km/h (rachas ${Math.round(m.rachas)})`
    : `${d.wx} ${esc(d.p)} <span style="color:var(--muted)">(AEMET, 11-oct)</span>`;
  if (d.monte && METEO && METEO.monte && METEO.monte[i]) {
    const a = METEO.monte[i];
    t += `<br>⛰ En la montaña (1.850 m): ${Math.round(a.max)}° / ${Math.round(a.min)}°, rachas de ${Math.round(a.rachas)} km/h` +
      (a.rachas >= 55 ? ` <b style="color:var(--rojo)">— viento fuerte: riesgo de que cierre el teleférico</b>` : "");
  }
  return t;
}
async function cargarMeteo() {
  if (METEO && Date.now() - METEO.ts < 30 * 60000) return;
  const base = "https://api.open-meteo.com/v1/forecast?daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max&timezone=Europe%2FMadrid&start_date=2026-10-12&end_date=2026-10-18";
  const leer = (j, i) => ({ code: j.daily.weather_code[i], max: j.daily.temperature_2m_max[i], min: j.daily.temperature_2m_min[i],
    lluvia: j.daily.precipitation_probability_max[i] ?? 0, viento: j.daily.wind_speed_10m_max[i], rachas: j.daily.wind_gusts_10m_max[i] });
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

// ---------- Plan por días ----------
function ordenarPorGrupo(ids) {
  return ids.map((id, i) => [id, resumen(id).score, i]).sort((a, b) => b[1] - a[1] || a[2] - b[2]).map(x => x[0]);
}
function rutaDia(d) {
  const casa = (d.k === "sab" || d.k === "dom") ? VIAJE.casas[1] : VIAJE.casas[0];
  const pts = d.items.filter(id => S[id].c && id !== "arenas" && id !== "cocido").map(id => S[id].c.join(","));
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
        <div class="sub"><span>${typeof d.gente === "number" ? d.gente : d.gente.replace("→", " → ")} personas</span><span>☀ Sale a las ${mm.sol[0]}, se pone a las ${mm.sol[1]}</span></div></div>
      <div class="dia-info">
        <div>
          <div class="meteo-linea" data-meteo="${d.k}">${lineaMeteo(d, i)}</div>
          ${d.marea ? `<div class="marea-linea">${lineaMarea(d.marea, d.n)}</div>` : ""}
          <p class="nota ${d.sol ? "sol" : ""}">${esc(d.nota)}</p>
          ${d.avisos && d.avisos.length ? `<ul class="avisos">${d.avisos.map(a => `<li>${esc(a)}</li>`).join("")}</ul>` : ""}
        </div>
        <div class="agenda"><h3>Horario orientativo</h3>
          <ol>${d.horario.map(([h, t]) => `<li><b>${esc(h)}</b><span>${esc(t)}</span></li>`).join("")}</ol>
          ${ruta ? `<div class="acciones"><a class="btn peq" href="${ruta}" target="_blank" rel="noopener">🗺 Ruta del día en Google Maps</a></div>` : ""}
        </div>
      </div>
      ${d.items.length ? `<div class="grid">${ordenarPorGrupo(d.items).map(tarjeta).join("")}</div>` : ""}
      ${d.alt.length ? `<div class="sub-h">Alternativas para este día</div><div class="grid">${ordenarPorGrupo(d.alt).map(tarjeta).join("")}</div>` : ""}
    </section>`;
    }).join("");
  actualizar();
}

// ---------- Todos los sitios ----------
const FILTROS = [["todas", "Todo"], ["imp", "★ Imprescindibles"], ["sinvoto", "Me falta votar"], ["lluvia", "Con lluvia"], ["gratis", "Gratis"], ["reserva", "Necesita reserva"], ["marea", "Depende de la marea"],
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
    return `<li><b>${d.d} ${d.n}:</b> ${top.length ? top.map(id => `<a href="#" data-ir-sitio="${id}">${esc(S[id].n)}</a>`).join(", ") : "<span style='color:var(--muted)'>sin votos aún</span>"}</li>`;
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
        <h2 class="sec">Últimos comentarios</h2>
        <div class="feed">${coms.length ? coms.map(c => htmlCom(c, true)).join("") : `<p style="color:var(--muted)">Todavía no hay comentarios. Se escriben desde cada sitio.</p>`}</div>
      </div>
    </div>`;
}

// ---------- Mapa ----------
let mapa = null, marcadores = {};
function colorMapa(id) {
  const r = resumen(id);
  if (!r.total) return "#7C8B93";
  if (r.si.length > r.no.length && r.si.length >= r.quiza.length) return "#2F6B3E";
  if (r.no.length > r.si.length) return "#C8102E";
  return "#B7862B";
}
function cargarScript(src) { return new Promise((ok, mal) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = mal; document.head.appendChild(s); }); }
async function abrirMapa() {
  if (mapa) { setTimeout(() => mapa.invalidateSize(), 50); return; }
  const css = document.createElement("link"); css.rel = "stylesheet"; css.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"; document.head.appendChild(css);
  try { await cargarScript("https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"); }
  catch (e) { $("#mapa").innerHTML = "<p style='padding:20px'>No se ha podido cargar el mapa.</p>"; return; }
  mapa = L.map("mapa", { scrollWheelZoom: false }).setView([43.3, -3.9], 8);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: "© OpenStreetMap" }).addTo(mapa);
  for (const [id, s] of Object.entries(S)) {
    if (!s.c || id === "cocido") continue;
    const f = FOTOS[id], g = NOTAS[id];
    marcadores[id] = L.circleMarker(s.c, { radius: 5 + s.val * 1.6, color: "#fff", weight: 2, fillColor: colorMapa(id), fillOpacity: .92 })
      .addTo(mapa).bindPopup(() => `${f ? `<img src="img/${f[0].f}-m.webp" alt="">` : ""}<b>${esc(s.n)}</b><br><span style="color:#D9A21B">${"★".repeat(s.val)}</span> ${VALORACION[s.val]}${g ? ` · Google ${fmtNota(g.nota)}` : ""}<br>🚗 ${esc(s.t)} · ⏱ ${esc(s.dur)}<br><a href="#" data-ir-sitio="${id}">Ver ficha y votar</a>`);
  }
  VIAJE.casas.forEach(c => L.circleMarker(c.c, { radius: 11, color: "#fff", weight: 3, fillColor: "#0F4C5C", fillOpacity: 1 }).addTo(mapa).bindPopup(`<b>🏠 ${esc(c.n)}</b><br>${esc(c.d)}`));
  mapa.fitBounds(L.latLngBounds(Object.values(S).filter(s => s.c).map(s => s.c)), { padding: [20, 20] });
}
function recolorearMapa() { for (const id in marcadores) marcadores[id].setStyle({ fillColor: colorMapa(id) }); }

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
    <h2 class="sec">Dónde comer</h2>
    <p class="intro">Sitios conocidos para empezar a mirar. Antes de ir, abrid el enlace y mirad la nota y las reseñas recientes en Google Maps.</p>
    <div class="cajas">${COMER.map(g => `<div class="caja"><h3>${esc(g.z)}</h3><ul>${g.l.map(([n, d, q]) => `<li><a href="${mapsQ(q)}" target="_blank" rel="noopener"><b>${esc(n)}</b></a>: ${esc(d)}</li>`).join("")}</ul></div>`).join("")}</div>
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
const TABS = ["plan", "ideas", "grupo", "mapa", "reservas", "info"];
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
  const br = e.target.closest("[data-borrar]"); if (br) {
    if (confirm("¿Borrar este comentario?")) api("borrarComentario", { nombre: yo(), c: br.dataset.borrar }).then(r => { remoto = r; actualizar(); }).catch(() => toast("No se ha podido borrar"));
    return;
  }
  const ac = e.target.closest("[data-accion]"); if (ac) {
    if (ac.dataset.accion === "faltan") { filtro = "sinvoto"; renderFiltros(); pintarIdeas(); abrir("ideas"); window.scrollTo({ top: $("nav.tabs").offsetTop + 1 }); }
    if (ac.dataset.accion === "copiar") compartir(textoResumen());
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
  renderSemana(); renderFiltros(); renderPlan(); pintarIdeas(); renderInfo(); renderReservas(); renderGrupo(); pintarYo();
  abrir(location.hash.slice(1) || "plan", true);
  sync(); cargarMeteo();
})();
