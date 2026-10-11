# Proyecto Santander: web del viaje por Cantabria

## Qué es
Web estática (un solo `index.html`) para que un grupo de amigos decida qué hacer en un viaje por Cantabria del 12 al 18 de octubre de 2026. Muestra el plan día a día, un banco de ideas por zonas, fotos, enlaces a Google y un sistema de votación personal. El dueño es Nacho, que habla en español: responde siempre en español.

## Contexto del viaje
- **Grupo:** 4 amigos del 11 (domingo noche) al 18 de octubre. Pedro y Fran solo de martes a viernes: llegan el martes a media tarde en coche desde Alicante (unas 8 h) y se van el viernes. Caste es uno de los 4.
- **Casas:** calle Lealtad, en el centro de Santander, junto al Centro Botín (base principal), y otra en Arenas de Iguña (Valle de Iguña), para dormir alguna noche.
- **Transporte:** tienen coche.
- **Gustos:** playa, montaña, una ruta de monte moderada (están en forma, pero nada extremo), comer y beber por los pueblos, y un día en Bilbao.
- **Deseos de Caste:** flysch de Zumaia, San Juan de Gaztelugatxe, San Mamés y una ruta por Picos.
- **Decisiones tomadas:**
  - El flysch de Zumaia se descarta como plan principal porque está a casi 2 h. La Costa Quebrada, a 20 min, ofrece un paisaje parecido. Zumaia queda como alternativa del jueves.
  - Los Lagos de Covadonga están en Asturias, más lejos. Para el día de montaña se elige Picos por Fuente Dé.
  - Esta semana no hay partido en San Mamés; el siguiente en casa es el 25 de octubre. Queda el tour del estadio.

## Itinerario actual
- **Lun 12 (4, sol, festivo):** Costa Quebrada (playa de la Arnía, Urros de Liencres, dunas de Liencres), Santillana del Mar, Comillas y atardecer en Oyambre o San Vicente de la Barquera.
- **Mar 13:** por la mañana, los 4 van al Faro del Caballo y a comer anchoas en Santoña. Por la tarde-noche, los 6 en Santander (Magdalena, Sardinero, Centro Botín, rabas por Peña Herbosa y Cañadío).
- **Mié 14 (6, mejor día):** Picos. Teleférico de Fuente Dé, ruta a Horcados Rojos, comida en Potes y Santo Toribio. Alternativas: Ruta del Cares y Mogrovejo.
- **Jue 15 (6):** Gaztelugatxe y Bermeo por la mañana; Bilbao por la tarde (tour de San Mamés, Guggenheim, Casco Viejo). Alternativas: Castro Urdiales, Mundaka y Zumaia.
- **Vie 16 (lluvia, se van Pedro y Fran):** cueva El Soplao, cuevas de El Castillo o Museo de Altamira. Por la tarde, subida a Arenas de Iguña.
- **Sáb 17 (4, lluvia):** Arenas de Iguña, cocido montañés, Bárcena Mayor y Vega de Pas.
- **Dom 18:** vuelta.

## Previsión usada
Es de AEMET vía Meteocantabria, consultada el 11 de octubre:
- Lunes y miércoles: sol en casi toda Cantabria (0–5% de lluvia).
- Martes: chubascos posibles por la tarde (50–60%).
- Jueves: 30–60% de lluvia.
- Viernes y sábado: lluvia (80%), unos 18 °C y cota de nieve a 1.800 m.
- Domingo: sin datos.

Conviene actualizarla en la web cuando haya previsión nueva.

## Estructura del código (`index.html`)
- **Archivo único:** HTML, CSS y JS juntos, sin dependencias salvo Google Fonts (Archivo y Literata).
- **Datos en el JS:**
  - `DIAS`: el plan por día, con fecha, icono del tiempo, % de lluvia, nº de personas, nota, `items` y `alt`.
  - `ZONAS`: las zonas del banco de ideas.
  - `S`: los sitios, con nombre, zona, tiempo desde Santander, descripción, etiquetas, títulos de Wikipedia para la foto y búsqueda de Google Maps.
- **Fotos:** se cargan en tiempo real desde la API REST de Wikipedia en español (`/api/rest_v1/page/summary/{título}`), probando los títulos en orden. Si fallan, se muestra un fondo de color con el nombre.
- **Enlaces de cada sitio:** Google Maps (reseñas), Google Imágenes y Wikipedia.
- **Votos:** "Me apetece", "Quizá" o "Paso", guardados en `localStorage` (clave `viajeCantabria2026`). La pestaña "Mi selección" comparte la lista por WhatsApp con `navigator.share`, con el portapapeles o con un textarea como último recurso.
- **Pestañas:** Plan por días, Banco de ideas (filtros por zona y "Con lluvia"), Mi selección y A tener en cuenta.
- **Diseño:** responsive, modo claro y oscuro, colores mar/monte con el rojo de la bandera de Cantabria como acento. La cabecera muestra la semana con el tiempo y cuántos son cada día.

Hay una versión publicada como artifact de Claude en https://claude.ai/artifact/BunKwieBvX1wTUYyVF6i2P. Allí las fotos no cargan porque bloquea imágenes externas; en la VPS sí.

## Despliegue
- **Repo:** GitHub `Santander`, vacío al empezar. Archivos: `index.html`, `README.md`, `CLAUDE.md` y `deploy/setup-vps.sh`.
- **VPS:** Nacho tiene una a la que accede por SSH. El sistema no está confirmado; se asume Ubuntu o Debian.
- **`deploy/setup-vps.sh`:**
  - Instala nginx y git y clona el repo en `/var/www/santander`.
  - Configura nginx como sitio por defecto en el puerto 80. Elimina el site `default`, así que hay que confirmar que la VPS no tiene otras webs. Bloquea el acceso a `.git` y a `/deploy/`.
  - Crea `/etc/cron.d/santander-deploy`, que hace `git pull` cada minuto (auto-despliegue), abre el puerto 80 en ufw si está activo e imprime la URL `http://IP/`.
- **Uso:** `git clone https://github.com/nachohernanz23/Santander.git /tmp/santander-setup && sudo bash /tmp/santander-setup/deploy/setup-vps.sh https://github.com/nachohernanz23/Santander.git`
- **Repo privado:** si lo es, hace falta un deploy key o hacerlo público.

## Pendiente / ideas
1. Subir los archivos al repo y hacer push a `main`.
2. Ejecutar el script en la VPS y comprobar que la URL funciona.
3. Opcional:
   - Votos compartidos entre todos con un backend pequeño (por ejemplo, un endpoint y un JSON o SQLite en la VPS).
   - Dominio y HTTPS (Caddy o certbot).
   - Actualizar la previsión.
   - Ajustar el itinerario según lo que voten.
