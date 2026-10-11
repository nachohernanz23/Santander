# Santander: viaje por Cantabria (12–18 oct 2026)

Web estática con el plan día a día, el banco de ideas y la votación del grupo.

- `index.html`: la web completa (un solo archivo).
- `deploy/setup-vps.sh`: instala nginx en la VPS, clona este repo y configura el auto-despliegue.

## Desplegar en la VPS (una sola vez)

    git clone https://github.com/nachohernanz23/Santander.git /tmp/santander-setup
    sudo bash /tmp/santander-setup/deploy/setup-vps.sh https://github.com/nachohernanz23/Santander.git

## Actualizar

Sube los cambios a la rama `main` en GitHub. La VPS los recoge sola en menos de un minuto.
