"""Ograničenje skupih zahteva (AI pozivi i obrada videa).

Ključ (X-API-Key) je u APK-u, pa ga neko može izvući. Ova granica ne dozvoljava da se tim
ključem za kratko vreme potroši Anthropic kredit ili zagušim server. Prava zaštita je i
mesečni limit potrošnje u Anthropic konzoli.

Aplikacija je za jednog korisnika, pa se broji po grupi zahteva (ne po IP adresi).
Broje se samo zahtevi sa ispravnim ključem — inače bi bilo ko mogao da "potroši" granicu.
Podešavanje u .env: LIMIT_AI_NA_SAT, LIMIT_OBRADA_NA_SAT (0 = bez granice).
"""
import os
import re
import threading
import time
from collections import deque


def _broj(ime: str, podrazumevano: int) -> int:
    try:
        return int(os.getenv(ime, str(podrazumevano)))
    except ValueError:
        return podrazumevano


PROZOR_S = 3600

LIMITI = {
    # Claude pozivi (chat, slika, glas, jelovnik, katalog vežbi...)
    "ai": _broj("LIMIT_AI_NA_SAT", 150),
    # Skidanje + Whisper + AI za jedan link (teško za procesor)
    "obrada": _broj("LIMIT_OBRADA_NA_SAT", 30),
}

# (metoda, putanja kao regex, grupa). Putanja mora da se poklopi cela.
SKUPE_RUTE = [
    ("POST", r"/ingest/?", "obrada"),
    ("POST", r"/recipe/?", "obrada"),
    ("POST", r"/exercise/?", "obrada"),
    ("POST", r"/chat/?", "ai"),
    ("POST", r"/dan/(analiza-slike|opis|glas)/?", "ai"),
    ("POST", r"/(mealplan|workoutplan)/generate/?", "ai"),
    ("POST", r"/shoppinglist/generate(-from-recipe)?/?", "ai"),
    ("POST", r"/proizvod/[^/]+/etiketa/?", "ai"),
    # Prvo otvaranje vežbe poveže katalog i prevede korake (AI); posle je iz baze
    ("GET", r"/exercise/\d+/detalji/?", "ai"),
    ("GET", r"/exercise/katalog/po-nazivu/?", "ai"),
]
_RUTE = [(m, re.compile(p), g) for m, p, g in SKUPE_RUTE]


def grupa_za(metoda: str, putanja: str, upit: str = "") -> str | None:
    """Kojoj grupi pripada zahtev, ili None ako nije skup."""
    # Danas zove /nedelja/osvezi pri svakom otvaranju; AI radi samo jednom nedeljno,
    # osim kad se traži ponovo (force=true) — samo to se broji.
    if metoda == "POST" and re.fullmatch(r"/nedelja/osvezi/?", putanja):
        return "ai" if re.search(r"(^|&)force=(true|1)", upit) else None
    for m, p, g in _RUTE:
        if m == metoda and p.fullmatch(putanja):
            return g
    return None


class Ogranicenje:
    """Klizni prozor: najviše `limit` zahteva u poslednjih `prozor` sekundi."""

    def __init__(self):
        self._lock = threading.Lock()
        self._vremena: dict[str, deque] = {}

    def pokusaj(self, grupa: str, limit: int, prozor: int = PROZOR_S, sada: float | None = None) -> int | None:
        """None = dozvoljeno (i upisano); inače koliko sekundi treba čekati."""
        if limit <= 0:
            return None
        sada = time.monotonic() if sada is None else sada
        with self._lock:
            q = self._vremena.setdefault(grupa, deque())
            while q and q[0] <= sada - prozor:
                q.popleft()
            if len(q) >= limit:
                return max(1, int(q[0] + prozor - sada))
            q.append(sada)
            return None

    def ocisti(self):
        with self._lock:
            self._vremena.clear()


ogranicenje = Ogranicenje()
