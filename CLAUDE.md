# Proyecto Santander: web del viaje por Cantabria

## Qué es
Web para que un grupo de amigos decida qué hacer en un viaje por Cantabria del 12 al 18 de octubre de 2026. Tiene el plan día a día (horarios, mareas, avisos, ruta en Maps), todos los sitios con fotos, nota de Google, valoración propia, precios, reservas y mareas, votación y comentarios compartidos, restaurantes calidad-precio (y los que añade el grupo), mapa, lista de reservas compartida y página de mareas e info. El dueño es Nacho, que habla en español: responde siempre en español.

## Contexto del viaje
- **Grupo:** Rufe, Caste, Moreno y Niggi suben el domingo 11 por la noche. Pedre y Fran llegan el martes a media tarde en coche desde Alicante (unas 8 h). El viernes se vuelven juntos Pedre, Fran y Niggi; Rufe, Caste y Moreno se quedan hasta el domingo 18. Son 4 el lunes, 6 de martes a viernes y 3 el fin de semana.
- **Casas:** calle Lealtad, en el centro de Santander, junto al Centro Botín (base principal), y otra en Arenas de Iguña (Valle de Iguña), para dormir alguna noche.
- **Transporte:** tienen coche.
- **Gustos:** playa, montaña, una ruta de monte moderada (están en forma, pero nada extremo), comer y beber por los pueblos, y un día en Bilbao.
- **Deseos de Caste:** flysch de Zumaia, San Juan de Gaztelugatxe, San Mamés y una ruta por Picos.
- **Decisiones tomadas:**
  - El flysch de Zumaia se descarta como plan principal porque está a casi 2 h. La Costa Quebrada, a 20 min, ofrece un paisaje parecido. Zumaia queda como alternativa del jueves.
  - Los Lagos de Covadonga están en Asturias, más lejos. Para el día de montaña se elige Picos por Fuente Dé.
  - Esta semana no hay partido en San Mamés; el siguiente en casa es el 25 de octubre. Queda el tour del estadio.

## Itinerario actual
Está en `js/datos.js` (`DIAS`). Resumen:
- **Lun 12 (festivo):** dunas de Liencres, Urros y la Arnía con la bajamar de las 12:08 (coef. 85), Santillana, Comillas y atardecer en San Vicente u Oyambre.
- **Mar 13:** por la mañana, los 4, Monte Buciero y anchoas en Santoña. Las escaleras del Faro del Caballo están CERRADAS desde dic-2025. Por la tarde los 6 en Santander.
- **Mié 14:** Fuente Dé, ruta a Horcados Rojos y Potes. Plan B si cierra el teleférico: Ruta del Cares.
- **Jue 15:** Gaztelugatxe (sin reserva ese día), Bermeo y Bilbao (San Mamés, Guggenheim, pintxos).
- **Vie 16:** se van Pedre, Fran y Niggi. El Soplao y El Castillo o Altamira; por la tarde, a Arenas de Iguña.
- **Sáb 17 (3):** Bárcena Mayor, cocido y Vega de Pas.
- **Dom 18:** vuelta.

## Planes alternativos por día
- `PLANES` en `js/datos.js`: para un día, varios planes completos (letra, horario, ritmo, coche, pros, contras, sitios y restaurantes). El grupo los vota con ids `p-<día>-<letra>` y la web muestra cuál va ganando. `rec: true` marca nuestra recomendación.
- Lunes 12: B (recomendado: Costa Quebrada sin prisa, comida en Liencres, Santillana por la tarde y atardecer en Cabo Mayor), A (ruta completa original) y C (Costa Quebrada y tarde de playa).

## Datos comprobados el 11-oct-2026
- Precios, horarios y reservas: en `S[id].info` (webs oficiales). Lunes 12 cerrados: Altamira y El Castillo (abren El Soplao y el Guggenheim). Gaztelugatxe pide reserva el 12, 17 y 18.
- Notas de Google: `js/notas.js`.
- Mareas (Santander, Bermeo, Zumaia) y salida y puesta de sol: `MAREAS` en `js/generado.js`, de tablademareas.com.
- Valoración (1–5 estrellas, `val`) y veredicto (`por`): opinión nuestra de cuánto merece la pena.
- Tiempo: Open-Meteo en vivo desde el navegador (por día, en la zona de ese día, y a 1.850 m el miércoles para el viento del teleférico). Si falla, se usa la previsión de AEMET del 11-oct guardada en `DIAS`.

## Restaurantes
- `js/restaurantes.js`: `RESTAURANTES` (162 a 12-oct: 63 buscados el 11-oct-2026 con nota de Google ≥ 4 y precio medio ≤ 40 €/persona, más los que recomienda la familia: Burdo (María), Mirador de Peñacolsa, Mesón La Florida y La Hérmida (tía José; este pasa de 40 € pero es especial)), `ZONAS_R` y `DIA_ZONAS` (dónde se come cada día).
- El 12-oct se añadieron 47 más con tope de 30 €/persona y la mejor nota posible (Santander y bahía, Torrelavega, Suances, Valdáliga, Unquera, Tudanca, Santoña, Noja, Laredo, Castro, Gernika, Bilbao, Liébana, interior y Campoo). La pestaña filtra por defecto hasta 30 € y ordena por calidad-precio (nota, nº de reseñas y precio); 💎 = nota ≥ 4,5 y ≤ 20 €.
- Clara opina que Santoña no merece la pena (solo Sonabia, y tampoco tanto), que San Vicente no, Comillas de pasada, Oyambre sí y Bárcena Mayor sí. Para el miércoles: desfiladero, Potes y Fuente Dé.
- Criterio de Nacho: calidad-precio, que se coma bien, mucho y barato. Nada por debajo de 4 en Google salvo algo muy especial. Descartados por caros: Bodega del Riojano, Cañadío, Casa José, La Atalaya de Mayte, Hotel del Oso, Las Redes y Bermeoko Kafe Antzokia. El Machi, por nota (3,8).
- Los que añade el grupo desde la web se guardan en el servidor (`restaurantes` del estado; ids `u-…`). Solo los puede borrar quien los añadió.
- Recomendaciones de la familia: `FAMILIA` en `js/datos.js` (quién, id del sitio, restaurante o `dia:<k>`, y su frase). Se ven en cada ficha, en el día, con un filtro propio y en «Votación del grupo». Los restaurantes recomendados no se esconden con el filtro de precio. De momento: María (prima), la tía José y Clara (prima): sus audios del 12-oct (transcritos con Whisper) y su lista «Comer» de Google Maps, de la que entran 41 sitios (sin los de León, A Coruña y Asturias). Los restaurantes de la familia llevan `recomienda` y, si lo apuntó ella, `nf` (su nota); se muestran aunque bajen de 4 o pasen de 30 €.
- «Ya fuimos» usa las tareas compartidas con id `f-<id del restaurante>`.
- `cierre` se interpreta solo («Cierra los lunes») para no proponer restaurantes cerrados en «Dónde comer este día» ni con el filtro por día.

## Estructura del código
- `index.html`: HTML y CSS. Sin framework. Fuentes Archivo y Literata (Google Fonts). Leaflet (cdnjs) solo al abrir el mapa.
- `js/datos.js`: `VIAJE`, `ZONAS`, `VALORACION`, `S` (sitios), `DIAS`, `TAREAS`, `PLATOS`. Es lo que se edita a mano.
- `js/notas.js`: `NOTAS` (Google). `js/generado.js`: `MAREAS` y `FOTOS` (generado; las fotos están en `img/`, sacadas de Wikimedia Commons, con autor y licencia).
- `js/app.js`: render, votos, comentarios, tareas, tiempo, mapa y galería. El mapa (Leaflet + markercluster de cdnjs) tiene capas por tipo (`CAT_SITIO`: pueblo, costa, monte, cultura, salir; restaurantes y casas), filtro por día y búsqueda, filtros de restaurantes (precio, nota, abiertos hoy, familia, chollos, votados), ubicación en vivo con `watchPosition` (no se envía a ningún sitio), lista «Cerca de ti» y capa «Aparcar» (`APARCAR` y `OLA` en `js/datos.js`: explanadas gratuitas y parkings de pago cerca de la calle Lealtad, sacados de OpenStreetMap el 12-oct, y horario de la zona azul de ola-santander.com).
- `server/server.js`: API en Node sin dependencias. Guarda en `DATA_DIR/estado.json`. Rutas: `GET /api/estado?rev=N`, `POST /api/voto|comentario|borrarComentario|tarea|restaurante|borrarRestaurante|borrarVotos`. Sin autenticación: cada uno elige su nombre.
- Sin conexión con la API, la web funciona con los votos en `localStorage` (clave `viajeCantabria2026`) y los sube al reconectar.

## Despliegue
- **Repo:** GitHub `Santander`, vacío al empezar. Archivos: `index.html`, `README.md`, `CLAUDE.md` y `deploy/setup-vps.sh`.
- **VPS:** Nacho tiene una a la que accede por SSH. El sistema no está confirmado; se asume Ubuntu o Debian.
- **Web publicada:** https://santander.146-59-225-84.sslip.io (VPS OVH, Ubuntu, IP 146.59.225.84).
- **Servidor web:** la VPS ya usa **Caddy** en los puertos 80 y 443 para otras webs (pokerbot, ocr-poker, lafamilia y panel, todas en `*.146-59-225-84.sslip.io`). No se usa nginx: chocaba con Caddy y se desinstaló.
- **`deploy/setup-vps.sh`** (se puede volver a ejecutar):
  - Clona o actualiza el repo en `/var/www/santander`.
  - Instala el servicio systemd `santander-api` (`deploy/santander-api.service`): `node --watch server/server.js` en 127.0.0.1:8797 con los datos en `/var/lib/santander`. Se reinicia solo cuando el `git pull` cambia el código.
  - Escribe `/etc/caddy/sitios/santander.caddy` desde `deploy/santander.caddy`: `/api/*` va a la API y el resto a `file_server`, ocultando `.git`, `deploy/`, `server/`, `CLAUDE.md` y `README.md`.
  - Crea `/etc/cron.d/santander-deploy`, que hace `git pull` cada minuto como `ubuntu`.
- **Uso:** `cd /var/www/santander && git pull && sudo bash deploy/setup-vps.sh https://github.com/nachohernanz23/Santander.git`

## Pendiente / ideas
- Ajustar el itinerario según lo que vote el grupo.
- Si cambia algo importante (cierres, previsión), actualizar `avisos` y `info` en `js/datos.js`.
