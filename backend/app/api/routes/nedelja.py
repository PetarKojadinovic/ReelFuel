from fastapi import APIRouter, BackgroundTasks, Depends
from sqlalchemy.orm import Session

from app.models.database import get_db, UserProfile
from app.services import nedelja_plan as np_

router = APIRouter()


@router.post("/osvezi")
def osvezi(background: BackgroundTasks, force: bool = False, db: Session = Depends(get_db)):
    if not db.query(UserProfile).first():
        return {"status": "nema_profila"}
    if not force and np_.plan_is_current(db):
        return {"status": "azurno"}
    status = np_.try_start(force)
    if status == "pokrenuto":
        background.add_task(np_.osvezi_nedelju)
    return {"status": status}


@router.get("/status")
def status(db: Session = Depends(get_db)):
    return {"status": np_.current_status(db)}