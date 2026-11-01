"""Provera linkova pre nego što server bilo šta skine (zaštita od SSRF-a).

Server sme da preuzima samo sa dozvoljenih platformi. Koriste je /ingest, /recipe i /exercise.
"""
from urllib.parse import urlparse

from fastapi import HTTPException

ALLOWED_HOSTS = ("instagram.com", "tiktok.com")
GRESKA = "Podržani su samo Instagram i TikTok linkovi"


def host_ok(url: str) -> bool:
    p = urlparse((url or "").strip())
    if p.scheme not in ("http", "https") or not p.hostname:
        return False
    h = p.hostname.lower()
    return any(h == d or h.endswith("." + d) for d in ALLOWED_HOSTS)


def require_allowed_url(url: str) -> str:
    """Vrati očišćen URL ili baci 400 ako domen nije dozvoljen."""
    if not host_ok(url):
        raise HTTPException(status_code=400, detail=GRESKA)
    return url.strip()
