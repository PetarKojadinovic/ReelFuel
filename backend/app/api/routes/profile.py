from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session
from datetime import date
from app.models.database import get_db, UserProfile, WeightLog

router = APIRouter()

ACTIVITY_MULTIPLIERS = {"nizak": 1.2, "srednji": 1.55, "visok": 1.725}


class ProfileRequest(BaseModel):
    tezina_kg: float
    visina_cm: float
    godine: int
    pol: str
    nivo_aktivnosti: str
    cilj: str = "mrsavljenje"
    raspodela_kalorija: str = "vecera_najveca"
    broj_treninga_nedeljno: int = 4
    ciljna_tezina_kg: Optional[float] = None


@router.post("/")
def save_profile(request: ProfileRequest, db: Session = Depends(get_db)):
    if request.pol == "muski":
        bmr = 10 * request.tezina_kg + 6.25 * request.visina_cm - 5 * request.godine + 5
    else:
        bmr = 10 * request.tezina_kg + 6.25 * request.visina_cm - 5 * request.godine - 161

    tdee = bmr * ACTIVITY_MULTIPLIERS.get(request.nivo_aktivnosti, 1.55)
    cilj_kalorije = tdee - 500 if request.cilj == "mrsavljenje" else tdee

    profile = db.query(UserProfile).first()
    tezina_promenjena = not profile or profile.tezina_kg != request.tezina_kg

    if profile:
        for key, value in request.dict().items():
            setattr(profile, key, value)
    else:
        profile = UserProfile(**request.dict())
        db.add(profile)

    db.commit()
    db.refresh(profile)

    if tezina_promenjena:
        today = date.today().isoformat()
        existing_today = db.query(WeightLog).filter(WeightLog.datum == today).first()
        if existing_today:
            existing_today.tezina_kg = request.tezina_kg
        else:
            db.add(WeightLog(datum=today, tezina_kg=request.tezina_kg))
        db.commit()

    return {
        "profile_id": profile.id,
        "bmr": round(bmr),
        "tdee": round(tdee),
        "dnevni_cilj_kalorija": round(cilj_kalorije),
    }


@router.get("/")
def get_profile(db: Session = Depends(get_db)):
    profile = db.query(UserProfile).first()
    if not profile:
        return {"exists": False}
    return {
        "exists": True,
        "tezina_kg": profile.tezina_kg,
        "visina_cm": profile.visina_cm,
        "godine": profile.godine,
        "pol": profile.pol,
        "nivo_aktivnosti": profile.nivo_aktivnosti,
        "cilj": profile.cilj,
        "raspodela_kalorija": profile.raspodela_kalorija,
        "broj_treninga_nedeljno": profile.broj_treninga_nedeljno,
        "ciljna_tezina_kg": profile.ciljna_tezina_kg,
    }