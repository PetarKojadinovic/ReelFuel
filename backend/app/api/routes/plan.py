import copy
import re
from datetime import date, timedelta
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.routes.dan import _hm
from app.models.database import get_db, FoodLogEntry, MealPlan, Recipe
from app.services.daily_nutrition import (
    DANI,
    DEFAULT_VREMENA,
    MARKER_IZVORI,
    OBROCI,
    _norm,
    dan_iz_plana,
    day_summary,
    plan_week_start,
    plan_za_datum,
    to_g,
    to_kcal,
    week_start,
)

router = APIRouter()

# Od danas do kraja sledece nedelje je najvise 14 dana (kad je danas ponedeljak)
MAX_DANA = 14


def parse_kcal(s: Optional[str]) -> Optional[int]:
    if not s:
        return None
    m = re.search(r"(\d{2,4})\s*(?:kcal|kal)", s, re.I) or re.search(r"\b(\d{3,4})\b", s)
    return int(m.group(1)) if m else None


def _find_day(plan_data: dict, ime: str):
    for d in (plan_data or {}).get("dani", []):
        if _norm(d.get("dan")) == ime:
            return d
    return None


@router.get("/slotovi")
def slotovi(
    recipe_id: int,
    sada: str = "00:00",
    dorucak: Optional[str] = None,
    rucak: Optional[str] = None,
    vecera: Optional[str] = None,
    dana: int = MAX_DANA,
    db: Session = Depends(get_db),
):
    """Obroci u koje recept moze da se ubaci: od danas do kraja SLEDECE nedelje, po datumu i obroku."""
    plan = db.query(MealPlan).order_by(MealPlan.id.desc()).first()
    if not plan:
        raise HTTPException(status_code=400, detail="Nema nedeljnog plana ishrane. Prvo ga generiši.")
    recipe = db.get(Recipe, recipe_id)
    if not recipe:
        raise HTTPException(status_code=404, detail="Recept nije pronađen")

    vremena = {
        "dorucak": _hm(dorucak, DEFAULT_VREMENA["dorucak"]),
        "rucak": _hm(rucak, DEFAULT_VREMENA["rucak"]),
        "vecera": _hm(vecera, DEFAULT_VREMENA["vecera"]),
    }
    today = date.today()
    today_status = {
        o["obrok_tip"]: o["status"] for o in day_summary(db, today.isoformat(), _hm(sada, "00:00"), vremena)["obroci"]
    }

    rk = parse_kcal(recipe.priblizne_kalorije)
    out = []
    ova_nedelja = week_start(today)
    for i in range(max(1, min(dana, MAX_DANA))):
        d = today + timedelta(days=i)
        nedelja = (week_start(d) - ova_nedelja).days // 7
        if nedelja > 1:
            break
        day_src = plan_za_datum(db, d.isoformat()) or plan
        day = dan_iz_plana(day_src, d.isoformat())
        if not day:
            continue
        for tip in OBROCI:
            meal = (day.get("obroci") or {}).get(tip)
            if not meal:
                continue
            if i == 0 and today_status.get(tip) != "ceka":
                continue
            kc = to_kcal(meal.get("kalorije"))
            out.append(
                {
                    "dan_offset": i,
                    "dan": day.get("dan"),
                    "datum": d.isoformat(),
                    "nedelja": nedelja,  # 0 = ova, 1 = sledeca
                    "obrok_tip": tip,
                    "trenutni_naziv": meal.get("naziv"),
                    "trenutne_kalorije": kc,
                    "izvor": meal.get("izvor"),
                    "razlika": (rk - kc) if rk is not None else None,
                }
            )

    # Redosled: po datumu, pa dorucak/rucak/vecera (kako se pojavljuju u petlji)
    return {
        "recept": {"id": recipe.id, "naziv": recipe.naziv_jela, "kalorije": rk, "proteini_g": recipe.proteini_g},
        "danas": today.isoformat(),
        "slotovi": out,
    }


class UbaciRequest(BaseModel):
    recipe_id: int
    dan_offset: int
    obrok_tip: Literal["dorucak", "rucak", "vecera"]


@router.post("/ubaci")
def ubaci(req: UbaciRequest, db: Session = Depends(get_db)):
    if not 0 <= req.dan_offset < MAX_DANA:
        raise HTTPException(status_code=400, detail="Dan mora biti u ovoj ili sledećoj nedelji")
    d = date.today() + timedelta(days=req.dan_offset)
    plan = plan_za_datum(db, d.isoformat())
    recipe = db.get(Recipe, req.recipe_id)
    if not plan or not recipe:
        raise HTTPException(status_code=404, detail="Plan ili recept nije pronađen")

    if req.dan_offset == 0:
        marker = (
            db.query(FoodLogEntry)
            .filter(
                FoodLogEntry.datum == d.isoformat(),
                FoodLogEntry.obrok_tip == req.obrok_tip,
                FoodLogEntry.izvor.in_(MARKER_IZVORI),
            )
            .first()
        )
        if marker:
            raise HTTPException(status_code=400, detail="Taj obrok je već upisan u dnevnik")

    datum = d.isoformat()
    day = dan_iz_plana(plan, datum)
    meal = ((day or {}).get("obroci") or {}).get(req.obrok_tip)
    if not day or not meal:
        raise HTTPException(status_code=400, detail="Taj obrok ne postoji u planu")

    rk = parse_kcal(recipe.priblizne_kalorije)
    kcal = rk if rk is not None else to_kcal(meal.get("kalorije"))
    novi_obrok = {
        "naziv": recipe.naziv_jela,
        "kalorije": kcal,
        "proteini_g": to_g(recipe.proteini_g),
        "izvor": "sacuvan",
        "recipe_id": recipe.id,
        "sastojci": recipe.sastojci or [],
    }

    data = copy.deepcopy(plan.plan_data)
    if plan_week_start(plan) == week_start(d):
        # Dan je u nedelji ovog plana: menja se sam plan (vidi se i u nedeljnom pregledu)
        plan_day = _find_day(data, DANI[d.weekday()])
        plan_day["obroci"][req.obrok_tip] = novi_obrok
        plan_day["ukupno_kalorija"] = sum(to_kcal(m.get("kalorije")) for m in plan_day["obroci"].values())
    else:
        # Dan je u nekoj drugoj nedelji: izmena vazi samo za taj datum i prenosi se u novi plan
        data.setdefault("izmene", {}).setdefault(datum, {})[req.obrok_tip] = novi_obrok
    plan.plan_data = data
    db.commit()

    return {
        "ok": True,
        "datum": datum,
        "dan": day.get("dan"),
        "obrok_tip": req.obrok_tip,
        "kalorije": kcal,
        "kalorije_nepoznate": rk is None,
    }