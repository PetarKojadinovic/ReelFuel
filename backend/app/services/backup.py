"""Kopija (backup) SQLite baze.

Koristi sqlite3 backup API, pa je kopija ispravna i dok server radi i piše u bazu.
Kopije idu u `backend/backups/` (pored baze), ime `reelfuel-YYYY-MM-DD_HHMMSS.db`.
Čuva se samo poslednjih `ZADRZI` kopija; starije se brišu.
Vraćanje kopije se radi ručno (vidi CONTEXT.md), ne preko API-ja.
"""
import logging
import sqlite3
from datetime import datetime
from pathlib import Path

from app.models.database import engine

logger = logging.getLogger(__name__)

ZADRZI = 10
PREFIKS = "reelfuel-"


def _putanja_baze(bind=None) -> Path:
    return Path((bind or engine).url.database).resolve()


def _folder(bind=None, folder: Path | None = None) -> Path:
    f = folder or (_putanja_baze(bind).parent / "backups")
    f.mkdir(parents=True, exist_ok=True)
    return f


def _kopije(folder: Path) -> list[Path]:
    # Ime sadrži datum i vreme, pa abecedni red = hronološki red.
    return sorted(folder.glob(f"{PREFIKS}*.db"))


def _opis(p: Path) -> dict:
    vreme = datetime.strptime(p.stem[len(PREFIKS):], "%Y-%m-%d_%H%M%S")
    return {"naziv": p.name, "vreme": vreme.isoformat(timespec="seconds"), "velicina_kb": round(p.stat().st_size / 1024)}


def napravi_kopiju(bind=None, folder: Path | None = None, sada: datetime | None = None) -> dict:
    folder = _folder(bind, folder)
    sada = sada or datetime.now()
    cilj = folder / f"{PREFIKS}{sada.strftime('%Y-%m-%d_%H%M%S')}.db"
    izvor = sqlite3.connect(_putanja_baze(bind))
    try:
        odrediste = sqlite3.connect(cilj)
        try:
            izvor.backup(odrediste)
        finally:
            odrediste.close()
    finally:
        izvor.close()

    for stara in _kopije(folder)[:-ZADRZI]:
        stara.unlink(missing_ok=True)
    return _opis(cilj)


def lista_kopija(bind=None, folder: Path | None = None) -> list[dict]:
    """Najnovija prva."""
    return [_opis(p) for p in reversed(_kopije(_folder(bind, folder)))]


def dnevna_kopija(bind=None, folder: Path | None = None, sada: datetime | None = None) -> dict | None:
    """Napravi kopiju ako danas još nije napravljena. Poziva se pri startu servera."""
    sada = sada or datetime.now()
    danas = f"{PREFIKS}{sada.strftime('%Y-%m-%d')}_"
    if any(p.name.startswith(danas) for p in _kopije(_folder(bind, folder))):
        return None
    try:
        return napravi_kopiju(bind, folder, sada)
    except Exception:
        logger.exception("Dnevna kopija baze nije uspela")
        return None
