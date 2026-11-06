import logging

from fastapi import APIRouter, HTTPException

from app.services import backup as backup_service

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/")
def lista():
    return {"kopije": backup_service.lista_kopija(), "zadrzi": backup_service.ZADRZI}


@router.post("/")
def napravi():
    try:
        return backup_service.napravi_kopiju()
    except Exception:
        logger.exception("Kopija baze nije uspela")
        raise HTTPException(status_code=500, detail="Kopija nije napravljena.")
