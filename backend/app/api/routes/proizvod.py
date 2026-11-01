import logging
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.models.database import get_db
from app.services.proizvod_service import BARKOD_RE, nadji_proizvod, procitaj_etiketu

log = logging.getLogger("proizvod")
router = APIRouter()


def _barkod(value: str) -> str:
    value = value.strip()
    if not BARKOD_RE.match(value):
        raise HTTPException(status_code=400, detail="Bar-kod mora imati 8 do 14 cifara")
    return value


class EtiketaRequest(BaseModel):
    slika_base64: str
    media_type: Literal["image/jpeg", "image/png", "image/webp"] = "image/jpeg"
    naziv: Optional[str] = None


@router.get("/{barkod}")
def get_proizvod(barkod: str, db: Session = Depends(get_db)):
    return nadji_proizvod(db, _barkod(barkod))


@router.post("/{barkod}/etiketa")
def etiketa(barkod: str, req: EtiketaRequest, db: Session = Depends(get_db)):
    barkod = _barkod(barkod)
    if len(req.slika_base64) > 8_000_000:
        raise HTTPException(status_code=413, detail="Slika je prevelika")
    try:
        return procitaj_etiketu(db, barkod, req.slika_base64, req.media_type, req.naziv)
    except Exception:
        log.exception("Citanje etikete nije uspelo")
        raise HTTPException(status_code=500, detail="Čitanje etikete nije uspelo")
