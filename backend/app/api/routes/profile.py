from datetime import date
from typing import Literal, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.models.database import get_db, UserProfile, WeightLog
from app.services.daily_nutrition import ACTIVITY_MULTIPLIERS, get_dnevni_cilj

router = APIRouter()


class ProfileRequest(BaseModel):
    tezina_kg: float = Field(gt=20, lt=400)
    visina_cm: float = Field(gt=80, lt=260)
    godine: int = Field(gt=9, lt=120)
    pol: Literal["muski", "zenski"]
    nivo_aktivnosti: Literal["nizak", "srednji", "visok"]
    cilj: Literal["mrsavljenje", "dobijanje_mise", "odrzavanje"] = "mrsavljenje"
    raspodela_kalorija: str = "vecera_najveca"
    # None = zadrži postojeću vrednost (stari klijenti ne šalju ovo polje)
    broj_treninga_nedeljno: Optional[int] = Field(default=None, ge=1, le=7)
    ciljna_tezina_kg: Optional[float] = Field(default=None, gt=20, lt=400)


def _bmr_tdee(p) -> tuple[float, float]:
    if p.pol == "muski":
        bmr = 10 * p.tezina_kg + 6.25 * p.visina_cm - 5 * p.godine + 5
    else:
        bmr = 10 * p.tezina_kg + 6.25 * p.visina_cm - 5 * p.godine - 161
    return bmr, bmr * ACTIVITY_MULTIPLIERS.get(p.nivo_aktivnosti, 1.55)


@router.post("/")
def save_profile(request: ProfileRequest, db: Session = Depends(get_db)):
    profile = db.query(UserProfile).first()
    tezina_promenjena = not profile or profile.tezina_kg != request.tezina_kg

    data = request.model_dump()
    if data["broj_treninga_nedeljno"] is None:
        data.pop("broj_treninga_nedeljno")
        if not profile:
            data["broj_treninga_nedeljno"] = 4

    if profile:
        for key, value in data.items():
            setattr(profile, key, value)
    else:
        profile = UserProfile(**data)
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

    bmr, tdee = _bmr_tdee(profile)
    return {
        "profile_id": profile.id,
        "bmr": round(bmr),
        "tdee": round(tdee),
        "dnevni_cilj_kalorija": get_dnevni_cilj(db),
    }


@router.get("/")
def get_profile(db: Session = Depends(get_db)):
    profile = db.query(UserProfile).first()
    if not profile:
        return {"exists": False}
    bmr, tdee = _bmr_tdee(profile)
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
        "bmr": round(bmr),
        "tdee": round(tdee),
        "dnevni_cilj_kalorija": get_dnevni_cilj(db),
    }
