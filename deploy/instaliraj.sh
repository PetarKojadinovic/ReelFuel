#!/usr/bin/env bash
# Instalira/azurira backend na serveru iz arhive koju je poslao deploy/posalji.ps1.
# Pokrece se kao root. Bazu, .env, katalog vezbi, model i kopije NE dira
# (nisu u arhivi - tar prepisuje samo fajlove iz gita).
set -euo pipefail

APP=/opt/reelfuel
ARHIVA="${1:-/tmp/reelfuel.tar.gz}"
VENV="${APP}/venv"
KAO="sudo -u reelfuel -H"

echo "== Raspakujem kod"
tar -xzf "${ARHIVA}" -C "${APP}"
rm -f "${ARHIVA}"
mkdir -p "${APP}/cache"
chown -R reelfuel:reelfuel "${APP}"
cd "${APP}/backend"

if [ ! -f .env ]; then
  echo "GRESKA: nema ${APP}/backend/.env (posalji ga sa: posalji.ps1 -PrviPut)"
  exit 1
fi
# Podesavanja samo za server (dodaju se jednom; lokalni .env ih nema)
grep -q '^DOCS=' .env || echo 'DOCS=0' >> .env
grep -q '^CORS_ORIGINS=' .env || echo 'CORS_ORIGINS=' >> .env
chown reelfuel:reelfuel .env
chmod 600 .env

[ -f data/vezbe_katalog.json ] || echo "UPOZORENJE: nema data/vezbe_katalog.json - katalog vezbi ce biti prazan."
[ -f models/pose_landmarker.task ] || echo "UPOZORENJE: nema models/pose_landmarker.task - analiza pokreta nece raditi."

echo "== Python paketi (prvi put traje 5-10 min)"
[ -x "${VENV}/bin/python" ] || ${KAO} python3.13 -m venv "${VENV}"
${KAO} "${VENV}/bin/pip" install -q --upgrade pip
# torch bez CUDA (server nema graficku): oko 200 MB umesto oko 3 GB. Ista verzija kao u requirements.txt.
TORCH=$(grep -E '^torch==' requirements.txt)
${KAO} "${VENV}/bin/pip" install -q "${TORCH}" --index-url https://download.pytorch.org/whl/cpu
${KAO} "${VENV}/bin/pip" install -q -r requirements.txt

echo "== Servis"
for f in reelfuel.service reelfuel-kopija.service reelfuel-kopija.timer; do
  install -m 644 "${APP}/deploy/${f}" "/etc/systemd/system/${f}"
done
systemctl daemon-reload
systemctl enable reelfuel
systemctl enable --now reelfuel-kopija.timer
systemctl restart reelfuel

# Bez kljuca server odgovara 401 = radi (torch se ucitava i do ~30 s)
for i in $(seq 1 60); do
  KOD=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8000/ || true)
  if [ "${KOD}" = "401" ]; then
    echo "OK: backend radi."
    exit 0
  fi
  sleep 2
done
echo "GRESKA: backend se nije podigao. Poslednje poruke:"
journalctl -u reelfuel -n 40 --no-pager
exit 1
