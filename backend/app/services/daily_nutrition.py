import copy
from datetime import date, timedelta
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
# Grami proteina po kg telesne mase (preporuke za aktivne osobe su ~1.6-2.2 g/kg)
PROTEINI_PO_KG = {"mrsavljenje": 2.0, "dobijanje_mise": 1.8, "odrzavanje": 1.6}


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


def to_g(v) -> Optional[float]:
    """Grami (proteina) iz LLM/klijent vrednosti; None ako je nepoznato ili besmisleno."""
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return round(f, 1) if 0 <= f <= 500 else None


def dnevni_cilj_proteina(profile) -> Optional[int]:
    if not profile or not profile.tezina_kg:
        return None
    kg = profile.tezina_kg
    # Pri mrsavljenju racunaj na ciljnu tezinu: visak masti ne trazi vise proteina
    if profile.cilj == "mrsavljenje" and profile.ciljna_tezina_kg and profile.ciljna_tezina_kg < kg:
        kg = profile.ciljna_tezina_kg
    return int(round(kg * PROTEINI_PO_KG.get(profile.cilj, 1.6) / 5) * 5)


def dnevni_cilj(profile) -> Optional[int]:
    if not profile:
        return None
    if profile.pol == "muski":
        bmr = 10 * profile.tezina_kg + 6.25 * profile.visina_cm - 5 * profile.godine + 5
    else:
        bmr = 10 * profile.tezina_kg + 6.25 * profile.visina_cm - 5 * profile.godine - 161
    tdee = bmr * ACTIVITY_MULTIPLIERS.get(profile.nivo_aktivnosti, 1.55)
    return round(tdee - 500) if profile.cilj == "mrsavljenje" else round(tdee)


def week_start(d: date) -> date:
    return d - timedelta(days=d.weekday())


def plan_week_start(plan) -> Optional[date]:
    """Ponedeljak nedelje za koju je plan napravljen ("nedelja_od" u plan_data, inace iz created_at)."""
    od = (plan.plan_data or {}).get("nedelja_od")
    if od:
        try:
            return date.fromisoformat(od)
        except ValueError:
            pass
    return week_start(plan.created_at.date()) if plan.created_at else None


def plan_za_datum(db, datum: str):
    """Plan koji vazi za dati datum: najnoviji plan cija nedelja pocinje najkasnije u nedelji tog datuma.

    Prosle nedelje tako zadrzavaju svoj plan (istorija se ne menja kad se napravi novi),
    a buduci dani koriste najnoviji plan dok se ne napravi plan za tu nedelju.
    """
    ws = week_start(date.fromisoformat(datum))
    for plan in db.query(MealPlan).order_by(MealPlan.id.desc()).all():
        pws = plan_week_start(plan)
        if pws is not None and pws <= ws:
            return plan
    return None


def dan_iz_plana(plan, datum: str) -> Optional[dict]:
    """Dan iz plana za tacan datum.

    Obroci ubaceni za dan VAN nedelje plana (npr. sledeca nedelja) cuvaju se u
    plan_data["izmene"][datum][obrok_tip] i ovde se primenjuju samo na taj datum,
    da ne bi promenili isti dan u tekucoj nedelji.
    """
    if not plan:
        return None
    data = plan.plan_data or {}
    target = DANI[date.fromisoformat(datum).weekday()]
    base = next((d for d in data.get("dani", []) if _norm(d.get("dan")) == target), None)
    izmene = (data.get("izmene") or {}).get(datum)
    if not izmene or base is None:
        return base
    day = copy.deepcopy(base)
    obroci = day.setdefault("obroci", {})
    obroci.update(copy.deepcopy(izmene))
    day["ukupno_kalorija"] = sum(to_kcal(m.get("kalorije")) for m in obroci.values())
    return day


def prenesi_izmene(stari_plan_data: Optional[dict], novi_plan_data: dict) -> dict:
    """Pri pravljenju novog plana zadrzi obroke koje je korisnik ubacio za buduce datume.

    Izmene za dane u nedelji novog plana upisuju se direktno u njegove dane,
    kasnije ostaju u "izmene"; prosli datumi se odbacuju.
    """
    izmene = (stari_plan_data or {}).get("izmene") or {}
    od = novi_plan_data.get("nedelja_od")
    if not izmene or not od:
        return novi_plan_data
    ws = date.fromisoformat(od)
    ostaje = {}
    for datum, obroci in izmene.items():
        try:
            d = date.fromisoformat(datum)
        except ValueError:
            continue
        if d < ws:
            continue
        if d < ws + timedelta(days=7):
            target = DANI[d.weekday()]
            for day in novi_plan_data.get("dani", []):
                if _norm(day.get("dan")) == target:
                    day.setdefault("obroci", {}).update(copy.deepcopy(obroci))
                    day["ukupno_kalorija"] = sum(to_kcal(m.get("kalorije")) for m in day["obroci"].values())
        else:
            ostaje[datum] = obroci
    if ostaje:
        novi_plan_data["izmene"] = ostaje
    return novi_plan_data


def day_plan(db, datum: str):
    return dan_iz_plana(plan_za_datum(db, datum), datum)


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
    procena_p = 0.0
    if d:
        for tip in OBROCI:
            meal = (d.get("obroci") or {}).get(tip)
            if not meal:
                continue
            kcal = to_kcal(meal.get("kalorije"))
            prot = to_g(meal.get("proteini_g"))
            marker = next((e for e in entries if e.obrok_tip == tip and e.izvor in MARKER_IZVORI), None)
            if marker:
                status, entry_id = STATUS_PO_IZVORU[marker.izvor], marker.id
            elif now_min >= _minutes(vremena[tip]) + GRACE_MIN:
                status, entry_id = "procena", None
                procena += kcal
                procena_p += prot or 0
            else:
                status, entry_id = "ceka", None
            obroci.append(
                {
                    "obrok_tip": tip,
                    "naziv": meal.get("naziv"),
                    "kalorije": kcal,
                    "proteini_g": prot,
                    "status": status,
                    "entry_id": entry_id,
                }
            )

    potvrdjeno = sum(e.kalorije or 0 for e in entries)
    potvrdjeno_p = sum(e.proteini_g or 0 for e in entries)
    # Pojedeni unosi za koje ne znamo proteine (stari unosi, plan bez proteina) -> zbir je donja granica
    nepoznato_p = sum(1 for e in entries if (e.kalorije or 0) > 0 and e.proteini_g is None)
    return {
        "datum": datum,
        "ima_plana": d is not None,
        "dnevni_cilj_kalorija": get_dnevni_cilj(db),                
        "potvrdjeno": potvrdjeno,
        "procena": procena,
        "ukupno": potvrdjeno + procena,
        "obroci": obroci,
        "dnevni_cilj_proteina": dnevni_cilj_proteina(profile),
        "proteini_potvrdjeno": round(potvrdjeno_p),
        "proteini_procena": round(procena_p),
        "proteini_ukupno": round(potvrdjeno_p + procena_p),
        "proteini_nepoznato": nepoznato_p,
    }

def kcal_offset(db) -> int:
    rows = db.query(KalorijskaKorekcija).filter(KalorijskaKorekcija.status == "prihvaceno").all()
    return sum(r.delta for r in rows)


def get_dnevni_cilj_proteina(db) -> Optional[int]:
    return dnevni_cilj_proteina(db.query(UserProfile).first())


def get_dnevni_cilj(db) -> Optional[int]:
    base = dnevni_cilj(db.query(UserProfile).first())
    return None if base is None else base + kcal_offset(db)