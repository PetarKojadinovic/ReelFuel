import logging
import os
from datetime import date
from typing import Literal, Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.models.database import get_db, FoodLogEntry
from app.services.daily_nutrition import DEFAULT_VREMENA, MARKER_IZVORI, day_summary, planned_meal, to_g, to_kcal
from app.services.glas_obrok import proceni_opis, proceni_snimak
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
    proteini_g: Optional[float] = Field(default=None, ge=0, le=500)


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


MAX_SNIMAK = 5 * 1024 * 1024  # ~5 min govora u m4a; klijent snima najvise 60 s
AUDIO_EKSTENZIJE = {".m4a", ".mp4", ".aac", ".3gp", ".webm", ".ogg", ".wav", ".mp3"}


class OpisRequest(BaseModel):
    tekst: str = Field(min_length=1, max_length=1000)


@router.post("/opis")
def opis_obroka(req: OpisRequest):
    """Kratak opis ("dva jaja i hleb") -> naziv, kalorije, proteini. Ništa se ne upisuje u dnevnik."""
    try:
        return proceni_opis(req.tekst)
    except Exception:
        log.exception("Procena opisa nije uspela")
        raise HTTPException(status_code=500, detail="Procena nije uspela")


@router.post("/glas")
def glas_obroka(snimak: UploadFile = File(...)):
    """Snimak glasa -> tekst (Whisper) -> naziv, kalorije, proteini. Snimak se ne čuva."""
    ext = os.path.splitext(snimak.filename or "")[1].lower() or ".m4a"
    if ext not in AUDIO_EKSTENZIJE:
        raise HTTPException(status_code=400, detail="Nepodržan format snimka")
    sadrzaj = snimak.file.read(MAX_SNIMAK + 1)
    if not sadrzaj:
        raise HTTPException(status_code=400, detail="Snimak je prazan")
    if len(sadrzaj) > MAX_SNIMAK:
        raise HTTPException(status_code=413, detail="Snimak je predugačak")
    try:
        return proceni_snimak(sadrzaj, ext)
    except Exception:
        log.exception("Prepoznavanje glasa nije uspelo")
        raise HTTPException(status_code=500, detail="Prepoznavanje glasa nije uspelo")


@router.post("/{datum}/{obrok_tip}")
def akcija(datum: str, obrok_tip: Literal["dorucak", "rucak", "vecera"], req: AkcijaRequest, db: Session = Depends(get_db)):
    _datum(datum)
    meal = planned_meal(db, datum, obrok_tip)

    if req.akcija == "zamena":
        if not req.naziv or not req.naziv.strip() or req.kalorije is None or not (0 <= req.kalorije <= 5000):
            raise HTTPException(status_code=400, detail="Za zamenu treba naziv i kalorije (0-5000)")
        naziv, kcal, prot, izvor = req.naziv.strip(), req.kalorije, req.proteini_g, "zamena"
    else:
        if not meal:
            raise HTTPException(status_code=400, detail="Za taj dan nema planiranog obroka")
        naziv = meal.get("naziv") or "Obrok iz plana"
        if req.akcija == "pojeo":
            kcal, prot, izvor = to_kcal(meal.get("kalorije")), to_g(meal.get("proteini_g")), "plan"
        else:
            kcal, prot, izvor = 0, 0, "preskoceno"

    # Jedan obrok ima najvise jedno stanje
    db.query(FoodLogEntry).filter(
        FoodLogEntry.datum == datum,
        FoodLogEntry.obrok_tip == obrok_tip,
        FoodLogEntry.izvor.in_(MARKER_IZVORI),
    ).delete(synchronize_session=False)

    entry = FoodLogEntry(datum=datum, obrok_tip=obrok_tip, naziv=naziv, kalorije=kcal, proteini_g=prot, izvor=izvor)
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return {"entry_id": entry.id}