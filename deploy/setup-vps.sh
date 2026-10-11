#!/usr/bin/env bash
# Despliega la web del viaje en una VPS Debian/Ubuntu con nginx
# y deja configurado el auto-despliegue (git pull cada minuto).
# Uso: sudo bash setup-vps.sh https://github.com/nachohernanz23/Santander.git
set -euo pipefail
REPO="${1:?Uso: sudo bash setup-vps.sh https://github.com/nachohernanz23/Santander.git}"
DIR=/var/www/santander

apt-get update -y
apt-get install -y nginx git curl

if [ -d "$DIR/.git" ]; then
  git -C "$DIR" pull --ff-only
else
  git clone "$REPO" "$DIR"
fi

cat > /etc/nginx/sites-available/santander <<'NGINX'
server {
  listen 80 default_server;
  listen [::]:80 default_server;
  server_name _;
  root /var/www/santander;
  index index.html;
  location ~ /\.git { deny all; }
  location /deploy/ { deny all; }
  location / { try_files $uri $uri/ =404; }
}
NGINX
ln -sf /etc/nginx/sites-available/santander /etc/nginx/sites-enabled/santander
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable --now nginx
systemctl reload nginx

# Auto-despliegue: cada minuto trae los cambios de GitHub
echo "* * * * * root git -C $DIR pull --ff-only -q" > /etc/cron.d/santander-deploy
chmod 644 /etc/cron.d/santander-deploy

# Abrir el puerto 80 si hay firewall ufw activo
if command -v ufw >/dev/null && ufw status | grep -q "Status: active"; then ufw allow 80/tcp; fi

IP=$(curl -4 -s --max-time 5 ifconfig.me || hostname -I | awk '{print $1}')
echo ""
echo "Listo. La web está en: http://$IP/"
