#!/usr/bin/env bash
# Prvo podesavanje NOVOG Hetzner servera (Ubuntu 24.04). Pokrece se JEDNOM, kao root.
# Ne pokreci rucno - pokrece ga deploy/posalji.ps1 -Postavi -Domen <domen> sa laptopa.
#
# Sta radi: azurira sistem, instalira Python 3.13 / FFmpeg / Caddy, pravi korisnika
# "reelfuel" (servis ne radi kao root), firewall (samo 22, 80, 443), swap 4 GB,
# automatske bezbednosne nadogradnje i iskljucuje prijavu lozinkom preko SSH-a.
set -euo pipefail

DOMEN="${1:?Upotreba: bash postavi_server.sh <domen, npr. reelfuel-petar.duckdns.org>}"
APP=/opt/reelfuel
export DEBIAN_FRONTEND=noninteractive

echo "== 1/7 Azuriranje sistema i vremenska zona"
# Server racuna "danas" i nedelju plana po lokalnom vremenu -> isto kao telefon
timedatectl set-timezone Europe/Ljubljana
apt-get update
apt-get -y upgrade

echo "== 2/7 Paketi (FFmpeg, biblioteke za OpenCV/MediaPipe, firewall)"
apt-get install -y software-properties-common ufw ffmpeg git curl gnupg \
  libgl1 libglib2.0-0 unattended-upgrades \
  debian-keyring debian-archive-keyring apt-transport-https

echo "== 3/7 Python 3.13 (isti kao na laptopu)"
add-apt-repository -y ppa:deadsnakes/ppa
apt-get update
apt-get install -y python3.13 python3.13-venv python3.13-dev

echo "== 4/7 Caddy (HTTPS: sam pribavi i obnavlja sertifikat)"
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | gpg --yes --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  > /etc/apt/sources.list.d/caddy-stable.list
chmod o+r /usr/share/keyrings/caddy-stable-archive-keyring.gpg /etc/apt/sources.list.d/caddy-stable.list
apt-get update
apt-get install -y caddy

cat > /etc/caddy/Caddyfile <<EOF
# ReelFuel: HTTPS na ${DOMEN} -> backend na 127.0.0.1:8000 (spolja nedostupan)
${DOMEN} {
	encode gzip
	request_body {
		max_size 20MB
	}
	reverse_proxy 127.0.0.1:8000
}
EOF
systemctl enable caddy
systemctl restart caddy

echo "== 5/7 Korisnik reelfuel i folder ${APP}"
id reelfuel &>/dev/null || useradd --system --create-home --home-dir /home/reelfuel --shell /usr/sbin/nologin reelfuel
mkdir -p "${APP}/backend/data" "${APP}/backend/models" "${APP}/cache"
chown -R reelfuel:reelfuel "${APP}"

echo "== 6/7 Swap 4 GB (Whisper + torch na 4 GB RAM-a)"
if [ ! -f /swapfile ]; then
  fallocate -l 4G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "== 7/7 Bezbednost: firewall, nadogradnje, SSH samo kljucem"
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
dpkg-reconfigure -f noninteractive unattended-upgrades
# Lozinka se iskljucuje SAMO ako root vec ima SSH kljuc (inace bi se zakljucao napolju)
if [ -s /root/.ssh/authorized_keys ]; then
  cat > /etc/ssh/sshd_config.d/10-reelfuel.conf <<'EOF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin prohibit-password
EOF
  systemctl reload ssh || systemctl reload sshd || true
else
  echo "UPOZORENJE: root nema SSH kljuc - prijava lozinkom NIJE iskljucena."
fi

echo
echo "Server je spreman. Sledece (sa laptopa): .\\deploy\\posalji.ps1 -Server <IP> -PrviPut"
