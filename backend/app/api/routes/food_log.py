from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session
from app.models.database import get_db, FoodLogEntry, UserProfile
router = APIRouter()

ACTIVITY_MULTIPLIERS = {"nizak": 1.2, "srednji": 1.55, "visok": 1.725}


class LogEntryRequest(BaseModel):
    datum: str
    naziv: str
    kalorije: int
    obrok_tip: Optional[str] = None
    izvor: str = "slobodan"


@router.post("/")
def add_entry(request: LogEntryRequest, db: Session = Depends(get_db)):
    entry = FoodLogEntry(
        datum=request.datum,
        naziv=request.naziv,
        kalorije=request.kalorije,
        obrok_tip=request.obrok_tip,
        izvor=request.izvor,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return {"entry_id": entry.id}


@router.delete("/{entry_id}")
def delete_entry(entry_id: int, db: Session = Depends(get_db)):
    entry = db.query(FoodLogEntry).filter(FoodLogEntry.id == entry_id).first()
    if entry:
        db.delete(entry)
        db.commit()
    return {"deleted": True}


@router.get("/{datum}")
def get_day_log(datum: str, db: Session = Depends(get_db)):
    entries = db.query(FoodLogEntry).filter(FoodLogEntry.datum == datum).all()
    profile = db.query(UserProfile).first()

    dnevni_cilj = None
    if profile:
        if profile.pol == "muski":
            bmr = 10 * profile.tezina_kg + 6.25 * profile.visina_cm - 5 * profile.godine + 5
        else:
            bmr = 10 * profile.tezina_kg + 6.25 * profile.visina_cm - 5 * profile.godine - 161
        tdee = bmr * ACTIVITY_MULTIPLIERS.get(profile.nivo_aktivnosti, 1.55)
        dnevni_cilj = round(tdee - 500) if profile.cilj == "mrsavljenje" else round(tdee)

    ukupno_uneto = sum(e.kalorije for e in entries)

    return {
        "datum": datum,
        "unosi": [
            {
                "id": e.id,
                "naziv": e.naziv,
                "kalorije": e.kalorije,
                "obrok_tip": e.obrok_tip,
                "izvor": e.izvor,
            }
            for e in entries
        ],
        "ukupno_uneto": ukupno_uneto,
        "dnevni_cilj_kalorija": dnevni_cilj,
        "preostalo": (dnevni_cilj - ukupno_uneto) if dnevni_cilj else None,
    }