from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.models.database import get_db
from app.services import kalorijska_korekcija as kk

router = APIRouter()


class OdgovorRequest(BaseModel):
    prihvati: bool


@router.get("/")
def stanje(db: Session = Depends(get_db)):
    return kk.get_state(db)


@router.post("/reset")
def reset(db: Session = Depends(get_db)):
    return kk.reset(db)


@router.post("/{korekcija_id}/odgovor")
def odgovor(korekcija_id: int, req: OdgovorRequest, db: Session = Depends(get_db)):
    return kk.odgovori(db, korekcija_id, req.prihvati)