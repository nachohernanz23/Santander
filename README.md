# Santander: viaje por Cantabria (12–18 oct 2026)

Web del viaje: plan por días, todos los sitios con fotos, nota de Google, valoración, precios, reservas y mareas, más la votación compartida del grupo.

Publicada en https://santander.146-59-225-84.sslip.io

- `index.html`: estructura y estilos.
- `js/datos.js`: sitios, días, tareas y dónde comer (lo que se edita a mano).
- `js/notas.js`: notas de Google. `js/generado.js`: fotos y mareas (generado).
- `img/`: fotos de Wikimedia Commons (`id-n.webp` grande, `id-1-m.webp` para las tarjetas).
- `server/server.js`: API de votos, comentarios y tareas (Node, sin dependencias).
- `deploy/`: script de instalación, servicio systemd y configuración de Caddy.

## Desplegar o actualizar la configuración en la VPS

    cd /var/www/santander && git pull
    sudo bash /var/www/santander/deploy/setup-vps.sh https://github.com/nachohernanz23/Santander.git

La primera vez, clona antes el repo en `/tmp/santander-setup` y ejecuta el script desde ahí.

## Actualizar la web

Sube los cambios a `main` en GitHub. La VPS los recoge sola en menos de un minuto y la API se reinicia sola si cambia `server/`.

## Probar en local

    DATA_DIR=.datos node server/server.js

y sirve la carpeta con cualquier servidor estático que pase `/api/*` al puerto 8797. Sin API la web funciona igual, pero los votos se quedan en el navegador.
