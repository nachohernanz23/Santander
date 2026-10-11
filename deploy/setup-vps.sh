#!/usr/bin/env bash
# Despliega la web del viaje en una VPS Ubuntu/Debian que ya tiene Caddy
# (con /etc/caddy/sitios/*.caddy importado desde el Caddyfile) y deja
# configurado el auto-despliegue (git pull cada minuto).
# Uso: sudo bash setup-vps.sh https://github.com/nachohernanz23/Santander.git [dominio]
set -euo pipefail
REPO="${1:?Uso: sudo bash setup-vps.sh https://github.com/nachohernanz23/Santander.git [dominio]}"
DIR=/var/www/santander
USUARIO="${SUDO_USER:-root}"

command -v caddy >/dev/null || { echo "Falta Caddy en la VPS"; exit 1; }
command -v git >/dev/null || { apt-get update -y && apt-get install -y git; }

if [ -d "$DIR/.git" ]; then
  git -C "$DIR" pull --ff-only
else
  git clone "$REPO" "$DIR"
fi
chown -R "$USUARIO:$USUARIO" "$DIR"

# Por defecto, subdominio sslip.io con la IP pública (HTTPS automático)
IP=$(curl -4 -s --max-time 5 ifconfig.me || hostname -I | awk '{print $1}')
DOMINIO="${2:-santander.${IP//./-}.sslip.io}"

mkdir -p /etc/caddy/sitios
cat > /etc/caddy/sitios/santander.caddy <<CADDY
# Web del viaje por Cantabria (deploy/setup-vps.sh del repo Santander)
$DOMINIO {
	encode gzip
	root * $DIR
	@oculto path /.git* /deploy/* /CLAUDE.md /README.md
	respond @oculto 404
	file_server
}
CADDY
grep -q 'sitios/\*\.caddy' /etc/caddy/Caddyfile || echo 'import /etc/caddy/sitios/*.caddy' >> /etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile
systemctl reload caddy

# Auto-despliegue: cada minuto trae los cambios de GitHub
echo "* * * * * $USUARIO cd $DIR && git pull -q --ff-only" > /etc/cron.d/santander-deploy
chmod 644 /etc/cron.d/santander-deploy

echo ""
echo "Listo. La web está en: https://$DOMINIO/"
