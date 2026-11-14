"""Katalog vežbi (ExerciseDB, besplatni API oss.exercisedb.dev): mišići, oprema, koraci, animirani GIF.

- Katalog je lokalni JSON (`backend/data/vezbe_katalog.json`, pravi ga `scripts/exercisedb_katalog.py`,
  NIJE u gitu). Učitava se jednom; ako fajla nema, katalog je prazan (vežbe nemaju opis).
  GIF-ovi ostaju na static.exercisedb.dev (telefon ih učitava direktno).
- Sačuvana vežba (`Exercise`) se poveže sa vežbom iz kataloga (`Exercise.katalog_id`):
  prvo tačno poklapanje naziva, inače Claude bira iz liste naziva. Rezultat se pamti
  u bazi, pa se AI zove najviše jednom po vežbi.
- Mišići/oprema/deo tela se prevode rečnikom; naziv i koraci preko Claude-a pri prvom otvaranju,
  pa se čuvaju u tabeli `VezbaPrevod`.
- Svaki mišić ima i `telo` = oznaku dela tela za crtež na telefonu (react-native-body-highlighter).
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
GIF_HOST = "https://static.exercisedb.dev/"

# ExerciseDB mišić -> (srpski naziv, deo tela na crtežu ili None)
MISICI: dict[str, tuple[str, str | None]] = {
    "abdominals": ("trbušnjaci", "abs"),
    "abductors": ("spoljna strana butine", None),
    "adductors": ("unutrašnja strana butine", "adductors"),
    "ankle stabilizers": ("stabilizatori skočnog zgloba", "ankles"),
    "ankles": ("skočni zglob", "ankles"),
    "back": ("leđa", "upper-back"),
    "biceps": ("biceps", "biceps"),
    "brachialis": ("brahijalis", "biceps"),
    "calves": ("listovi", "calves"),
    "cardiovascular system": ("srce i pluća", None),
    "core": ("trup", "abs"),
    "deltoids": ("ramena", "deltoids"),
    "erector spinae": ("donja leđa", "lower-back"),
    "feet": ("stopala", "feet"),
    "forearms": ("podlaktice", "forearm"),
    "glutes": ("gluteus", "gluteal"),
    "grip muscles": ("stisak šake", "hands"),
    "hamstrings": ("zadnja loža", "hamstring"),
    "hands": ("šake", "hands"),
    "hip flexors": ("pregibači kuka", None),
    "latissimus dorsi": ("široki leđni", "upper-back"),
    "levator scapulae": ("podizač lopatice", "neck"),
    "obliques": ("kosi trbušni", "obliques"),
    "pectorals": ("grudi", "chest"),
    "quadriceps": ("kvadriceps", "quadriceps"),
    "rear deltoids": ("zadnja ramena", "deltoids"),
    "rhomboids": ("romboidni", "upper-back"),
    "rotator cuff": ("rotatorna manžetna", "deltoids"),
    "serratus anterior": ("nazubljeni mišić", None),
    "soleus": ("listovi (soleus)", "calves"),
    "sternocleidomastoid": ("vratni mišić", "neck"),
    "tibialis anterior": ("prednja potkolenica", "tibialis"),
    "trapezius": ("trapez", "trapezius"),
    "triceps": ("triceps", "triceps"),
    "upper back": ("gornja leđa", "upper-back"),
    "wrist extensors": ("podlaktice", "forearm"),
    "wrist flexors": ("podlaktice", "forearm"),
    "wrists": ("ručni zglob", "forearm"),
}
OPREMA = {
    "EZ bar": "EZ šipka",
    "ab wheel": "točak za trbušnjake",
    "assisted": "uz pomoć",
    "barbell": "šipka",
    "bodyweight": "bez opreme",
    "bosu ball": "bosu lopta",
    "cable": "sajla",
    "dumbbell": "bučice",
    "elliptical machine": "orbitrek",
    "hammer": "čekić",
    "kettlebell": "girja",
    "leverage machine": "mašina",
    "medicine ball": "medicinka",
    "olympic barbell": "olimpijska šipka",
    "resistance band": "elastična traka",
    "roller": "valjak",
    "rope": "konopac",
    "ski ergometer": "ski ergometar",
    "sled machine": "sanke",
    "smith machine": "Smith mašina",
    "stability ball": "pilates lopta",
    "stationary bike": "sobni bicikl",
    "stepmill machine": "stepenice (mašina)",
    "suspension trainer": "TRX trake",
    "tennis ball": "teniska loptica",
    "tire": "guma",
    "towel": "peškir",
    "trap bar": "trap šipka",
    "upper body ergometer": "ergometar za ruke",
    "weighted": "sa tegom",
}
KATEGORIJA = {
    "back": "leđa",
    "cardio": "kardio",
    "chest": "grudi",
    "lower arms": "podlaktice",
    "lower legs": "potkolenice",
    "neck": "vrat",
    "shoulders": "ramena",
    "upper arms": "nadlaktice",
    "upper legs": "butine",
    "waist": "stomak",
}
IZVOR = "ExerciseDB"

SYSTEM_POVEZI = """Dobijaš naziv vežbe (često na srpskom, iz Instagram/TikTok videa) i listu vežbi na engleskom.
1. Prvo napiši kako se ta vežba zove na engleskom u teretani (npr. sklekovi = push-ups, zgibovi = pull-ups, čučanj = squat, iskorak = lunge).
2. Zatim iz liste izaberi isti pokret. Ako oprema ili varijanta nisu navedene, izaberi osnovnu varijantu (npr. "push-up", a ne "clock push-up").
   Ako tačne varijante nema, izaberi najbližu sa istim pokretom i opremom.
3. Ako u listi nema istog pokreta, vrati null - bolje ništa nego pogrešna vežba.
Vrati ISKLJUČIVO JSON: {"engleski": "string", "naziv": "<tačan naziv iz liste>" ili null}

Lista vežbi:
"""

SYSTEM_PREVOD = """Prevedi naziv vežbe i korake izvođenja na srpski (latinica), kratko i jasno, u drugom licu ("Stani...", "Spusti...").
Piši pravilnim srpskim jezikom, kako bi trener objasnio vežbu; ne prevodi reč po reč (npr. "step forward" = "zakorači napred").
Koraci treba da budu kratki: dug korak podeli na više, spoji ponavljanja; najviše 8 koraka. Ako koraka nema, vrati praznu listu.
Uobičajene nazive vežbi iz teretane možeš ostaviti na engleskom ako se tako kod nas kaže (npr. "Hip thrust").
Vrati ISKLJUČIVO JSON: {"naziv": "string", "koraci": ["string", ...]}"""


@lru_cache(maxsize=1)
def katalog() -> dict[str, dict]:
    try:
        with open(KATALOG_PUTANJA, encoding="utf-8") as f:
            return {e["id"]: e for e in json.load(f)["vezbe"]}
    except FileNotFoundError:
        log.warning("Nema kataloga vezbi (%s) - pokreni scripts/exercisedb_katalog.py", KATALOG_PUTANJA)
        return {}


def _norm(s: str) -> str:
    return " ".join(re.findall(r"[a-z0-9]+", (s or "").lower()))


@lru_cache(maxsize=1)
def _po_nazivu() -> dict[str, str]:
    """Normalizovan naziv -> id (kod istog naziva prva vežba po redu)."""
    rez: dict[str, str] = {}
    for i, e in katalog().items():
        rez.setdefault(_norm(e["name"]), i)
    return rez


def postoji(katalog_id: str) -> bool:
    return katalog_id in katalog()


def tacno_poklapanje(naziv: str) -> str | None:
    return _po_nazivu().get(_norm(naziv))


def _misici(imena: list[str]) -> list[dict]:
    return [{"naziv": MISICI[m][0], "telo": MISICI[m][1]} if m in MISICI else {"naziv": m, "telo": None} for m in imena]


def _nazivi_misica(ids: list[str]) -> list[str]:
    # isti srpski naziv samo jednom (npr. dva mišića lista)
    return list(dict.fromkeys(m["naziv"] for m in _misici(ids)))


def _oprema(e: dict) -> str | None:
    o = [OPREMA.get(x, x) for x in e.get("equipment", [])]
    return ", ".join(o) or None


def pretrazi(upit: str, limit: int = 20) -> list[dict]:
    """Pretraga po engleskom nazivu (sve reči upita) ili po mišiću na srpskom/engleskom."""
    reci = _norm(upit).split()
    if not reci:
        return []
    misic = {en for en, (sr, _) in MISICI.items() if _norm(upit) in (_norm(en), _norm(sr))}
    rez = []
    for i, e in katalog().items():
        ime = _norm(e["name"])
        if all(r in ime for r in reci) or misic & set(e["primaryMuscles"]):
            # prvo: naziv počinje upitom, pa kraći naziv
            rez.append((not ime.startswith(reci[0]), len(ime), i))
    rez.sort()
    return [kratko(r[-1]) for r in rez[:limit]]


def _gif(e: dict) -> str | None:
    g = e.get("gif") or ""
    return g if g.startswith(GIF_HOST) else None


def kratko(katalog_id: str) -> dict:
    e = katalog()[katalog_id]
    return {
        "id": katalog_id,
        "naziv_en": e["name"],
        "glavni_misici": _nazivi_misica(e["primaryMuscles"]),
        "oprema": _oprema(e),
        "slika": _gif(e),
    }


def nadji_u_katalogu(naziv: str, grupa_misica: str | None = None) -> str | None:
    """Vraća id vežbe iz kataloga ili None (nema dovoljno slične). Baca izuzetak ako AI ne odgovori."""
    if not (naziv or "").strip():
        return None
    tacno = tacno_poklapanje(naziv)
    if tacno:
        return tacno
    lista = "\n".join(dict.fromkeys(e["name"] for e in katalog().values()))
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
        if not isinstance(naziv, str) or not naziv.strip() or not isinstance(koraci, list):
            raise ValueError("Neispravan prevod")
        koraci = [str(k).strip() for k in koraci if str(k).strip()]
        if e["instructions"] and not koraci:
            raise ValueError("Prevod bez koraka")
    except Exception:
        log.exception("Prevod vežbe nije uspeo")
        return None
    p = VezbaPrevod(katalog_id=katalog_id, naziv=naziv.strip()[:200], koraci=koraci[:8])
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
        "sporedni_misici": [m for m in _nazivi_misica(e["secondaryMuscles"]) if m not in _nazivi_misica(e["primaryMuscles"])],
        # delovi tela za crtež: glavni pa pomoćni (bez ponavljanja)
        "telo_glavni": list(dict.fromkeys(m["telo"] for m in _misici(e["primaryMuscles"]) if m["telo"])),
        "telo_sporedni": list(dict.fromkeys(
            m["telo"] for m in _misici(e["secondaryMuscles"])
            if m["telo"] and m["telo"] not in {x["telo"] for x in _misici(e["primaryMuscles"])}
        )),
        "nivo": None,  # ExerciseDB (besplatni) nema nivo; polje ostaje zbog starih klijenata
        "kategorija": ", ".join(KATEGORIJA.get(b, b) for b in e.get("bodyParts", [])) or None,
        "slike": [g for g in [_gif(e)] if g],
        "izvor": IZVOR,
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
    if veza is None or (veza.katalog_id and not postoji(veza.katalog_id)):
        # nova veza, ili veza na vežbu iz starog kataloga -> poveži ponovo
        katalog_id = nadji_u_katalogu(naziv, grupa_misica) or ""
        if veza is None:
            veza = VezbaNazivVeza(naziv=kljuc)
            db.add(veza)
        veza.katalog_id = katalog_id
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
