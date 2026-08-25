from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session
from app.models.database import get_db, WorkoutLogEntry

router = APIRouter()


class WorkoutLogRequest(BaseModel):
    datum: str
    naziv_vezbe: str
    serije_i_ponavljanja: Optional[str] = None
    dan_treninga: Optional[str] = None
    izvor: str = "slobodan"


@router.post("/")
def add_entry(request: WorkoutLogRequest, db: Session = Depends(get_db)):
    entry = WorkoutLogEntry(
        datum=request.datum,
        naziv_vezbe=request.naziv_vezbe,
        serije_i_ponavljanja=request.serije_i_ponavljanja,
        dan_treninga=request.dan_treninga,
        izvor=request.izvor,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return {"entry_id": entry.id}


@router.delete("/{entry_id}")
def delete_entry(entry_id: int, db: Session = Depends(get_db)):
    entry = db.query(WorkoutLogEntry).filter(WorkoutLogEntry.id == entry_id).first()
    if entry:
        db.delete(entry)
        db.commit()
    return {"deleted": True}


@router.get("/{datum}")
def get_day_log(datum: str, db: Session = Depends(get_db)):
    entries = db.query(WorkoutLogEntry).filter(WorkoutLogEntry.datum == datum).all()
    return {
        "datum": datum,
        "unosi": [
            {
                "id": e.id,
                "naziv_vezbe": e.naziv_vezbe,
                "serije_i_ponavljanja": e.serije_i_ponavljanja,
                "dan_treninga": e.dan_treninga,
                "izvor": e.izvor,
            }
            for e in entries
        ],
    }