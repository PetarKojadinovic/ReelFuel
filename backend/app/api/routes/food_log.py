from datetime import date

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from typing import Optional
from sqlalchemy.orm import Session
from app.models.database import get_db, FoodLogEntry
from app.services.daily_nutrition import get_dnevni_cilj, get_dnevni_cilj_proteina

router = APIRouter()


class LogEntryRequest(BaseModel):
    datum: date  # "YYYY-MM-DD"
    naziv: str = Field(min_length=1, max_length=200)
    kalorije: int = Field(ge=0, le=10000)
    proteini_g: Optional[float] = Field(default=None, ge=0, le=500)
    obrok_tip: Optional[str] = None
    izvor: str = "slobodan"


@router.post("/")
def add_entry(request: LogEntryRequest, db: Session = Depends(get_db)):
    entry = FoodLogEntry(
        datum=request.datum.isoformat(),
        naziv=request.naziv,
        kalorije=request.kalorije,
        proteini_g=request.proteini_g,
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
    dnevni_cilj = get_dnevni_cilj(db)
    ukupno_uneto = sum(e.kalorije or 0 for e in entries)

    return {
        "datum": datum,
        "unosi": [
            {
                "id": e.id,
                "naziv": e.naziv,
                "kalorije": e.kalorije,
                "proteini_g": e.proteini_g,
                "obrok_tip": e.obrok_tip,
                "izvor": e.izvor,
            }
            for e in entries
        ],
        "ukupno_uneto": ukupno_uneto,
        "ukupno_proteina": round(sum(e.proteini_g or 0 for e in entries)),
        "dnevni_cilj_kalorija": dnevni_cilj,
        "dnevni_cilj_proteina": get_dnevni_cilj_proteina(db),
        "preostalo": (dnevni_cilj - ukupno_uneto) if dnevni_cilj else None,
    }
