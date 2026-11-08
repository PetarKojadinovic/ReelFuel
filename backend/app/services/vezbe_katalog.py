"""Katalog vežbi (free-exercise-db, javni domen): mišići, oprema, koraci izvođenja, slike.

- Katalog je lokalni JSON (`backend/data/vezbe_katalog.json`), učitava se jednom.
- Sačuvana vežba (`Exercise`) se poveže sa vežbom iz kataloga (`Exercise.katalog_id`):
  prvo tačno poklapanje naziva, inače Claude bira iz liste naziva. Rezultat se pamti u bazi,
  pa se AI zove najviše jednom po vežbi.
- Mišići/oprema/nivo se prevode rečnikom; naziv i koraci preko Claude-a pri prvom otvaranju,
  pa se čuvaju u tabeli `VezbaPrevod`.
"""
import json
import logging
import os
import re
from functools import lru_cache
from pathlib import Path

from anthropic import Anthropic
from dotenv import load_dotenv
from sqlalchemy.orm import Session

from app.models.database import VezbaNazivVeza, VezbaPrevod
from app.services.llm_utils import parse_json

load_dotenv()
client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
log = logging.getLogger("vezbe_katalog")

MODEL = "claude-haiku-4-5-20251001"
KATALOG_PUTANJA = Path(__file__).resolve().parents[2] / "data" / "vezbe_katalog.json"
# Slike se ne čuvaju u repou; zaključan commit -> URL-ovi se ne menjaju ispod nas
KATALOG_COMMIT = "f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5"
SLIKE_URL = f"https://raw.githubusercontent.com/yuhonas/free-exercise-db/{KATALOG_COMMIT}/exercises/"

MISICI = {
    "abdominals": "trbušnjaci",
    "abductors": "spoljna strana butine",
    "adductors": "unutrašnja strana butine",
    "biceps": "biceps",
    "calves": "listovi",
    "chest": "grudi",
    "forearms": "podlaktice",
    "glutes": "gluteus",
    "hamstrings": "zadnja loža",
    "lats": "široki leđni",
    "lower back": "donja leđa",
    "middle back": "srednja leđa",
    "neck": "vrat",
    "quadriceps": "kvadriceps",
    "shoulders": "ramena",
    "traps": "trapez",
    "triceps": "triceps",
}
OPREMA = {
    "barbell": "šipka",
    "dumbbell": "bučice",
    "other": "ostalo",
    "body only": "bez opreme",
    "cable": "sajla",
    "machine": "mašina",
    "kettlebells": "girja",
    "bands": "elastične trake",
    "medicine ball": "medicinka",
    "exercise ball": "pilates lopta",
    "foam roll": "foam roller",
    "e-z curl bar": "EZ šipka",
}
NIVO = {"beginner": "početni", "intermediate": "srednji", "expert": "napredni"}
KATEGORIJA = {
    "strength": "snaga",
    "stretching": "istezanje",
    "plyometrics": "skokovi",
    "powerlifting": "pauerlifting",
    "olympic weightlifting": "olimpijsko dizanje",
    "strongman": "strongman",
    "cardio": "kardio",
}

SYSTEM_POVEZI = """Dobijaš naziv vežbe (često na srpskom, iz Instagram/TikTok videa) i listu vežbi na engleskom.
1. Prvo napiši kako se ta vežba zove na engleskom u teretani (npr. sklekovi = push-ups, zgibovi = pull-ups, čučanj = squat, iskorak = lunge).
2. Zatim iz liste izaberi isti pokret. Ako oprema ili varijanta nisu navedene, izaberi osnovnu varijantu (npr. "Pushups", a ne "Clock Push-Up").
   Ako tačne varijante nema, izaberi najbližu sa istim pokretom i opremom.
3. Ako u listi nema istog pokreta, vrati null - bolje ništa nego pogrešna vežba.
Vrati ISKLJUČIVO JSON: {"engleski": "string", "naziv": "<tačan naziv iz liste>" ili null}

Lista vežbi:
"""

SYSTEM_PREVOD = """Prevedi naziv vežbe i korake izvođenja na srpski (latinica), kratko i jasno, u drugom licu ("Stani...", "Spusti...").
Piši pravilnim srpskim jezikom, kako bi trener objasnio vežbu; ne prevodi reč po reč (npr. "step forward" = "zakorači napred").
Isti broj koraka kao u originalu. Uobičajene nazive vežbi iz teretane možeš ostaviti na engleskom ako se tako kod nas kaže (npr. "Hip thrust").
Vrati ISKLJUČIVO JSON: {"naziv": "string", "koraci": ["string", ...]}"""


@lru_cache(maxsize=1)
def katalog() -> dict[str, dict]:
    with open(KATALOG_PUTANJA, encoding="utf-8") as f:
        return {e["id"]: e for e in json.load(f)}


def _norm(s: str) -> str:
    return " ".join(re.findall(r"[a-z0-9]+", (s or "").lower()))


@lru_cache(maxsize=1)
def _po_nazivu() -> dict[str, str]:
    return {_norm(e["name"]): i for i, e in katalog().items()}


def postoji(katalog_id: str) -> bool:
    return katalog_id in katalog()


def tacno_poklapanje(naziv: str) -> str | None:
    return _po_nazivu().get(_norm(naziv))


def pretrazi(upit: str, limit: int = 20) -> list[dict]:
    """Pretraga po engleskom nazivu (sve reči upita) ili po mišiću na srpskom/engleskom."""
    reci = _norm(upit).split()
    if not reci:
        return []
    misic = {en for en, sr in MISICI.items() if _norm(upit) in (_norm(sr), _norm(en))}
    rez = []
    for i, e in katalog().items():
        ime = _norm(e["name"])
        if all(r in ime for r in reci) or misic & set(e["primaryMuscles"]):
            rez.append((not ime.startswith(reci[0]), len(ime), i))
    rez.sort()
    return [kratko(i) for _, _, i in rez[:limit]]


def _slike(e: dict) -> list[str]:
    return [SLIKE_URL + p for p in e.get("images", [])]


def kratko(katalog_id: str) -> dict:
    e = katalog()[katalog_id]
    slike = _slike(e)
    return {
        "id": katalog_id,
        "naziv_en": e["name"],
        "glavni_misici": [MISICI.get(m, m) for m in e["primaryMuscles"]],
        "oprema": OPREMA.get(e.get("equipment"), e.get("equipment")),
        "slika": slike[0] if slike else None,
    }


def nadji_u_katalogu(naziv: str, grupa_misica: str | None = None) -> str | None:
    """Vraća id vežbe iz kataloga ili None (nema dovoljno slične). Baca izuzetak ako AI ne odgovori."""
    if not (naziv or "").strip():
        return None
    tacno = tacno_poklapanje(naziv)
    if tacno:
        return tacno
    lista = "\n".join(e["name"] for e in katalog().values())
    msg = client.messages.create(
        model=MODEL,
        max_tokens=100,
        # Lista je ista u svakom pozivu -> keš (jeftinije i brže od drugog poziva nadalje)
        system=[{"type": "text", "text": SYSTEM_POVEZI + lista, "cache_control": {"type": "ephemeral"}}],
        messages=[{"role": "user", "content": f"Vežba: {naziv}\nGrupa mišića: {grupa_misica or '(nepoznato)'}"}],
    )
    d = parse_json(msg.content[0].text)
    # AI mora da vrati naziv iz liste; izmišljen naziv -> None
    for kandidat in (d.get("naziv"), d.get("engleski")):
        if isinstance(kandidat, str) and tacno_poklapanje(kandidat):
            return tacno_poklapanje(kandidat)
    return None


def prevod(db: Session, katalog_id: str) -> VezbaPrevod | None:
    """Srpski naziv i koraci; prevodi se jednom pa čuva. None ako prevod ne uspe (prikaže se engleski)."""
    p = db.get(VezbaPrevod, katalog_id)
    if p:
        return p
    e = katalog()[katalog_id]
    try:
        msg = client.messages.create(
            model=MODEL,
            max_tokens=1500,
            system=SYSTEM_PREVOD,
            messages=[{"role": "user", "content": json.dumps({"naziv": e["name"], "koraci": e["instructions"]}, ensure_ascii=False)}],
        )
        d = parse_json(msg.content[0].text)
        naziv, koraci = d.get("naziv"), d.get("koraci")
        if not isinstance(naziv, str) or not naziv.strip() or not isinstance(koraci, list) or not koraci:
            raise ValueError("Neispravan prevod")
        koraci = [str(k).strip() for k in koraci if str(k).strip()]
    except Exception:
        log.exception("Prevod vežbe nije uspeo")
        return None
    p = VezbaPrevod(katalog_id=katalog_id, naziv=naziv.strip()[:200], koraci=koraci)
    db.add(p)
    db.commit()
    return p


def detalji(db: Session, katalog_id: str) -> dict:
    e = katalog()[katalog_id]
    p = prevod(db, katalog_id)
    return {
        **kratko(katalog_id),
        "naziv": p.naziv if p else e["name"],
        "koraci": p.koraci if p else e["instructions"],
        "prevedeno": p is not None,
        "sporedni_misici": [MISICI.get(m, m) for m in e["secondaryMuscles"]],
        "nivo": NIVO.get(e.get("level"), e.get("level")),
        "kategorija": KATEGORIJA.get(e.get("category"), e.get("category")),
        "slike": _slike(e),
    }


def kljuc_naziva(naziv: str) -> str:
    return " ".join((naziv or "").lower().split())[:200]


def povezi_naziv(db: Session, naziv: str, grupa_misica: str | None = None) -> str | None:
    """Vežba iz plana treninga -> id iz kataloga (ili None). Veza se pamti po nazivu, pa se
    isti naziv u sledećem planu ne šalje AI-ju ponovo. Baca izuzetak ako AI ne odgovori."""
    kljuc = kljuc_naziva(naziv)
    if not kljuc:
        return None
    veza = db.get(VezbaNazivVeza, kljuc)
    if veza is None:
        veza = VezbaNazivVeza(naziv=kljuc, katalog_id=nadji_u_katalogu(naziv, grupa_misica) or "")
        db.add(veza)
        db.commit()
    if veza.katalog_id and not postoji(veza.katalog_id):
        veza.katalog_id = ""
        db.commit()
    return veza.katalog_id or None


def postavi_naziv(db: Session, naziv: str, katalog_id: str | None) -> None:
    kljuc = kljuc_naziva(naziv)
    veza = db.get(VezbaNazivVeza, kljuc)
    if veza is None:
        veza = VezbaNazivVeza(naziv=kljuc)
        db.add(veza)
    veza.katalog_id = katalog_id or ""
    db.commit()
