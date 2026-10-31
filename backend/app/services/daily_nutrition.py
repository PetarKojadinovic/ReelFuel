from datetime import date
from typing import Optional

from app.models.database import FoodLogEntry, MealPlan, UserProfile
from app.models.database import KalorijskaKorekcija

DANI = ["ponedeljak", "utorak", "sreda", "cetvrtak", "petak", "subota", "nedelja"]
OBROCI = ("dorucak", "rucak", "vecera")
DEFAULT_VREMENA = {"dorucak": "08:00", "rucak": "13:00", "vecera": "19:00"}
GRACE_MIN = 120  # posle ovoga se obrok bez odgovora racuna kao procena
MARKER_IZVORI = ("plan", "zamena", "preskoceno")
STATUS_PO_IZVORU = {"plan": "pojeo", "zamena": "zamenjeno", "preskoceno": "preskoceno"}
ACTIVITY_MULTIPLIERS = {"nizak": 1.2, "srednji": 1.55, "visok": 1.725}


def _norm(s) -> str:
    s = (s or "").lower().strip()
    for a, b in (("č", "c"), ("ć", "c"), ("š", "s"), ("ž", "z"), ("đ", "dj")):
        s = s.replace(a, b)
    return s


def _minutes(hhmm: str) -> int:
    h, m = hhmm.split(":")
    return int(h) * 60 + int(m)


def to_kcal(v) -> int:
    try:
        return int(round(float(v)))
    except (TypeError, ValueError):
        return 0


def dnevni_cilj(profile) -> Optional[int]:
    if not profile:
        return None
    if profile.pol == "muski":
        bmr = 10 * profile.tezina_kg + 6.25 * profile.visina_cm - 5 * profile.godine + 5
    else:
        bmr = 10 * profile.tezina_kg + 6.25 * profile.visina_cm - 5 * profile.godine - 161
    tdee = bmr * ACTIVITY_MULTIPLIERS.get(profile.nivo_aktivnosti, 1.55)
    return round(tdee - 500) if profile.cilj == "mrsavljenje" else round(tdee)


def day_plan(db, datum: str):
    plan = db.query(MealPlan).order_by(MealPlan.id.desc()).first()
    if not plan:
        return None
    target = DANI[date.fromisoformat(datum).weekday()]
    for d in (plan.plan_data or {}).get("dani", []):
        if _norm(d.get("dan")) == target:
            return d
    return None


def planned_meal(db, datum: str, tip: str):
    d = day_plan(db, datum)
    return ((d or {}).get("obroci") or {}).get(tip)


def day_summary(db, datum: str, sada: str = "00:00", vremena: Optional[dict] = None) -> dict:
    vremena = {**DEFAULT_VREMENA, **(vremena or {})}
    now_min = _minutes(sada)

    profile = db.query(UserProfile).first()
    entries = db.query(FoodLogEntry).filter(FoodLogEntry.datum == datum).all()
    d = day_plan(db, datum)

    obroci = []
    procena = 0
    if d:
        for tip in OBROCI:
            meal = (d.get("obroci") or {}).get(tip)
            if not meal:
                continue
            kcal = to_kcal(meal.get("kalorije"))
            marker = next((e for e in entries if e.obrok_tip == tip and e.izvor in MARKER_IZVORI), None)
            if marker:
                status, entry_id = STATUS_PO_IZVORU[marker.izvor], marker.id
            elif now_min >= _minutes(vremena[tip]) + GRACE_MIN:
                status, entry_id = "procena", None
                procena += kcal
            else:
                status, entry_id = "ceka", None
            obroci.append(
                {"obrok_tip": tip, "naziv": meal.get("naziv"), "kalorije": kcal, "status": status, "entry_id": entry_id}
            )

    potvrdjeno = sum(e.kalorije or 0 for e in entries)
    return {
        "datum": datum,
        "ima_plana": d is not None,
        "dnevni_cilj_kalorija": get_dnevni_cilj(db),                
        "potvrdjeno": potvrdjeno,
        "procena": procena,
        "ukupno": potvrdjeno + procena,
        "obroci": obroci,
    }

def kcal_offset(db) -> int:
    rows = db.query(KalorijskaKorekcija).filter(KalorijskaKorekcija.status == "prihvaceno").all()
    return sum(r.delta for r in rows)


def get_dnevni_cilj(db) -> Optional[int]:
    base = dnevni_cilj(db.query(UserProfile).first())
    return None if base is None else base + kcal_offset(db)