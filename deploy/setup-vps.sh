#!/usr/bin/env bash
# Despliega la web del viaje en una VPS Ubuntu/Debian que ya tiene Caddy
# (con /etc/caddy/sitios/*.caddy importado desde el Caddyfile):
#   - clona el repo en /var/www/santander
#   - instala la API de votos (Node, servicio santander-api en 127.0.0.1:8797)
#   - publica la web y la API con Caddy y HTTPS automático
#   - deja el auto-despliegue (git pull cada minuto; la API se reinicia sola)
# Uso: sudo bash setup-vps.sh https://github.com/nachohernanz23/Santander.git [dominio]
# Se puede volver a ejecutar sin problema para actualizar la configuración.
set -euo pipefail
REPO="${1:?Uso: sudo bash setup-vps.sh https://github.com/nachohernanz23/Santander.git [dominio]}"
DIR=/var/www/santander
USUARIO="${SUDO_USER:-root}"

command -v caddy >/dev/null || { echo "Falta Caddy en la VPS"; exit 1; }
command -v git >/dev/null || { apt-get update -y && apt-get install -y git; }
command -v node >/dev/null || { echo "Falta Node.js (versión 22 o superior)"; exit 1; }

if [ -d "$DIR/.git" ]; then
  sudo -u "$USUARIO" git -C "$DIR" pull --ff-only
else
  git clone "$REPO" "$DIR"
fi
chown -R "$USUARIO:$USUARIO" "$DIR"

# API de votos
sed -e "s/^User=.*/User=$USUARIO/" -e "s#/usr/bin/node#$(command -v node)#" \
  "$DIR/deploy/santander-api.service" > /etc/systemd/system/santander-api.service
systemctl daemon-reload
systemctl enable santander-api
systemctl restart santander-api

# Caddy. Por defecto, subdominio sslip.io con la IP pública
IP=$(curl -4 -s --max-time 5 ifconfig.me || hostname -I | awk '{print $1}')
DOMINIO="${2:-santander.${IP//./-}.sslip.io}"
mkdir -p /etc/caddy/sitios
sed "s/DOMINIO/$DOMINIO/" "$DIR/deploy/santander.caddy" > /etc/caddy/sitios/santander.caddy
grep -q 'sitios/\*\.caddy' /etc/caddy/Caddyfile || echo 'import /etc/caddy/sitios/*.caddy' >> /etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile
systemctl reload caddy

# Auto-despliegue: cada minuto trae los cambios de GitHub
echo "* * * * * $USUARIO cd $DIR && git pull -q --ff-only" > /etc/cron.d/santander-deploy
chmod 644 /etc/cron.d/santander-deploy

sleep 2
echo ""
curl -s "http://127.0.0.1:8797/api/estado" >/dev/null && echo "API de votos funcionando." || echo "OJO: la API no responde (journalctl -u santander-api)"
echo "Listo. La web está en: https://$DOMINIO/"
