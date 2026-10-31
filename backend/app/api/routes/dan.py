import logging
from datetime import date
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.models.database import get_db, FoodLogEntry
from app.services.daily_nutrition import DEFAULT_VREMENA, MARKER_IZVORI, day_summary, planned_meal, to_kcal
from app.services.meal_photo import analyze_meal_photo

log = logging.getLogger("dan")
router = APIRouter()


def _datum(value: str) -> str:
    try:
        date.fromisoformat(value)
    except ValueError:
        raise HTTPException(status_code=400, detail="Datum mora biti u formatu YYYY-MM-DD")
    return value


def _hm(value: Optional[str], default: str) -> str:
    if value is None:
        return default
    try:
        h, m = value.split(":")
        if 0 <= int(h) <= 23 and 0 <= int(m) <= 59:
            return f"{int(h):02d}:{int(m):02d}"
    except ValueError:
        pass
    raise HTTPException(status_code=400, detail="Vreme mora biti u formatu HH:MM")


class AkcijaRequest(BaseModel):
    akcija: Literal["pojeo", "preskocio", "zamena"]
    naziv: Optional[str] = None
    kalorije: Optional[int] = None


class SlikaRequest(BaseModel):
    slika_base64: str
    media_type: Literal["image/jpeg", "image/png", "image/webp"] = "image/jpeg"


@router.get("/{datum}")
def get_day(
    datum: str,
    sada: str = "00:00",
    dorucak: Optional[str] = None,
    rucak: Optional[str] = None,
    vecera: Optional[str] = None,
    db: Session = Depends(get_db),
):
    _datum(datum)
    vremena = {
        "dorucak": _hm(dorucak, DEFAULT_VREMENA["dorucak"]),
        "rucak": _hm(rucak, DEFAULT_VREMENA["rucak"]),
        "vecera": _hm(vecera, DEFAULT_VREMENA["vecera"]),
    }
    return day_summary(db, datum, _hm(sada, "00:00"), vremena)


@router.post("/analiza-slike")
def analiza_slike(req: SlikaRequest):
    if len(req.slika_base64) > 8_000_000:
        raise HTTPException(status_code=413, detail="Slika je prevelika")
    try:
        return analyze_meal_photo(req.slika_base64, req.media_type)
    except Exception:
        log.exception("Analiza slike nije uspela")
        raise HTTPException(status_code=500, detail="Analiza slike nije uspela")


@router.post("/{datum}/{obrok_tip}")
def akcija(datum: str, obrok_tip: Literal["dorucak", "rucak", "vecera"], req: AkcijaRequest, db: Session = Depends(get_db)):
    _datum(datum)
    meal = planned_meal(db, datum, obrok_tip)

    if req.akcija == "zamena":
        if not req.naziv or not req.naziv.strip() or req.kalorije is None or not (0 <= req.kalorije <= 5000):
            raise HTTPException(status_code=400, detail="Za zamenu treba naziv i kalorije (0-5000)")
        naziv, kcal, izvor = req.naziv.strip(), req.kalorije, "zamena"
    else:
        if not meal:
            raise HTTPException(status_code=400, detail="Za taj dan nema planiranog obroka")
        naziv = meal.get("naziv") or "Obrok iz plana"
        if req.akcija == "pojeo":
            kcal, izvor = to_kcal(meal.get("kalorije")), "plan"
        else:
            kcal, izvor = 0, "preskoceno"

    # Jedan obrok ima najvise jedno stanje
    db.query(FoodLogEntry).filter(
        FoodLogEntry.datum == datum,
        FoodLogEntry.obrok_tip == obrok_tip,
        FoodLogEntry.izvor.in_(MARKER_IZVORI),
    ).delete(synchronize_session=False)

    entry = FoodLogEntry(datum=datum, obrok_tip=obrok_tip, naziv=naziv, kalorije=kcal, izvor=izvor)
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return {"entry_id": entry.id}