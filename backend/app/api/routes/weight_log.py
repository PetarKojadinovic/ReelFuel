from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.models.database import get_db, WeightLog, UserProfile

router = APIRouter()


class WeightEntryRequest(BaseModel):
    datum: str
    tezina_kg: float


@router.post("/")
def add_entry(request: WeightEntryRequest, db: Session = Depends(get_db)):
    existing = db.query(WeightLog).filter(WeightLog.datum == request.datum).first()
    if existing:
        existing.tezina_kg = request.tezina_kg
    else:
        db.add(WeightLog(datum=request.datum, tezina_kg=request.tezina_kg))

    profile = db.query(UserProfile).first()
    if profile:
        profile.tezina_kg = request.tezina_kg

    db.commit()
    return {"saved": True}


@router.delete("/{entry_id}")
def delete_entry(entry_id: int, db: Session = Depends(get_db)):
    entry = db.query(WeightLog).filter(WeightLog.id == entry_id).first()
    if entry:
        db.delete(entry)
        db.commit()
    return {"deleted": True}


@router.get("/summary")
def get_summary(db: Session = Depends(get_db)):
    entries = db.query(WeightLog).order_by(WeightLog.datum.asc()).all()
    profile = db.query(UserProfile).first()

    if not entries or not profile:
        return {"exists": False}

    pocetna_tezina = entries[0].tezina_kg
    trenutna_tezina = entries[-1].tezina_kg
    ciljna_tezina = profile.ciljna_tezina_kg

    progres_procenat = None
    if ciljna_tezina is not None and pocetna_tezina != ciljna_tezina:
        raw = (pocetna_tezina - trenutna_tezina) / (pocetna_tezina - ciljna_tezina) * 100
        progres_procenat = max(0, min(100, round(raw)))

    return {
        "exists": True,
        "pocetna_tezina": pocetna_tezina,
        "trenutna_tezina": trenutna_tezina,
        "ciljna_tezina": ciljna_tezina,
        "progres_procenat": progres_procenat,
        "istorija": [{"id": e.id, "datum": e.datum, "tezina_kg": e.tezina_kg} for e in entries],
    }