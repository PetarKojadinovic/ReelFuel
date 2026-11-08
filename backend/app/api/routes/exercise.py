from typing import Optional

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from app.services.video_downloader import download_video, get_caption, extract_frames
from app.services.transcription import transcribe_audio
from app.services.pose_analysis import analyze_video
from app.services.exercise_extractor import extract_exercise
from app.models.database import get_db, Exercise
from app.core.url_guard import require_allowed_url
from app.services import vezbe_katalog
import logging
import os
import shutil

log = logging.getLogger("exercise")
router = APIRouter()


class ExerciseRequest(BaseModel):
    url: str


@router.post("/")
def process_exercise(request: ExerciseRequest, db: Session = Depends(get_db)):
    request.url = require_allowed_url(request.url)
    video_path = None
    frame_paths = []
    try:
        video_path = download_video(request.url)

        try:
            transcript = transcribe_audio(video_path)
        except Exception:
            transcript = ""

        caption = get_caption(request.url)
        frame_paths = extract_frames(video_path)
        pose_result = analyze_video(video_path)

        # extract_exercise ne prima frejmove (ranije je ovde uvek pucalo sa TypeError -> 500)
        exercise_data = extract_exercise(transcript, pose_result, caption)

        db_exercise = Exercise(
            naziv_vezbe=exercise_data.get("naziv_vezbe"),
            grupa_misica=exercise_data.get("grupa_misica"),
            serije_i_ponavljanja=exercise_data.get("serije_i_ponavljanja"),
            detektovano_ponavljanja=pose_result.get("detektovano_ponavljanja"),
            source_url=request.url,
        )
        db.add(db_exercise)
        db.commit()
        db.refresh(db_exercise)

        return {
            "transcript": transcript or "Video nema govorni audio - koriscena je analiza pokreta i vizuelnih izvora",
            "pose_analysis": pose_result,
            "exercise": exercise_data,
            "exercise_id": db_exercise.id,
        }
    except Exception:
        log.exception("Obrada vezbe nije uspela")
        raise HTTPException(status_code=500, detail="Obrada linka nije uspela")
    finally:
        if video_path and os.path.exists(video_path):
            os.remove(video_path)
        if frame_paths:
            frame_dir = os.path.dirname(frame_paths[0])
            if os.path.isdir(frame_dir):
                shutil.rmtree(frame_dir, ignore_errors=True)

            
@router.get("/list")
def list_exercises(db: Session = Depends(get_db)):
    exercises = db.query(Exercise).order_by(Exercise.id.desc()).all()
    return {
        "exercises": [
            {
                "id": e.id,
                "naziv_vezbe": e.naziv_vezbe,
                "grupa_misica": e.grupa_misica,
                "serije_i_ponavljanja": e.serije_i_ponavljanja,
                "detektovano_ponavljanja": e.detektovano_ponavljanja,
                "katalog_id": e.katalog_id or None,
            }
            for e in exercises
        ]
    }


@router.get("/katalog")
def pretrazi_katalog(q: str = Query("", max_length=100)):
    """Pretraga kataloga (engleski naziv ili mišić) - za ručni izbor kad automatska veza promaši."""
    return {"rezultati": vezbe_katalog.pretrazi(q)}


def _odgovor_naziv(db: Session, katalog_id: str | None, greska: bool = False) -> dict:
    return {
        "katalog": vezbe_katalog.detalji(db, katalog_id) if katalog_id else None,
        "greska_povezivanja": greska,
    }


@router.get("/katalog/po-nazivu")
def katalog_po_nazivu(
    naziv: str = Query(..., min_length=1, max_length=200),
    grupa: str = Query("", max_length=200),
    db: Session = Depends(get_db),
):
    """Opis vežbe iz plana treninga (plan ima samo naziv). Veza se pamti po nazivu."""
    try:
        katalog_id = vezbe_katalog.povezi_naziv(db, naziv, grupa or None)
    except Exception:
        log.exception("Povezivanje naziva sa katalogom nije uspelo")
        return _odgovor_naziv(db, None, greska=True)
    return _odgovor_naziv(db, katalog_id)


class NazivIzbor(BaseModel):
    naziv: str = Field(..., min_length=1, max_length=200)
    katalog_id: Optional[str] = Field(None, max_length=200)


@router.put("/katalog/po-nazivu")
def izaberi_po_nazivu(izbor: NazivIzbor, db: Session = Depends(get_db)):
    """Ručna ispravka veze za vežbu iz plana treninga."""
    if izbor.katalog_id and not vezbe_katalog.postoji(izbor.katalog_id):
        raise HTTPException(status_code=400, detail="Nepoznata vezba u katalogu")
    vezbe_katalog.postavi_naziv(db, izbor.naziv, izbor.katalog_id)
    return _odgovor_naziv(db, izbor.katalog_id or None)


def _vezba_ili_404(db: Session, exercise_id: int) -> Exercise:
    exercise = db.query(Exercise).filter(Exercise.id == exercise_id).first()
    if not exercise:
        raise HTTPException(status_code=404, detail="Vezba nije pronadjena")
    return exercise


def _odgovor_detalji(db: Session, e: Exercise, greska: bool = False) -> dict:
    return {
        "exercise": {
            "id": e.id,
            "naziv_vezbe": e.naziv_vezbe,
            "grupa_misica": e.grupa_misica,
            "serije_i_ponavljanja": e.serije_i_ponavljanja,
            "detektovano_ponavljanja": e.detektovano_ponavljanja,
        },
        "katalog": vezbe_katalog.detalji(db, e.katalog_id) if e.katalog_id else None,
        "greska_povezivanja": greska,
    }


@router.get("/{exercise_id}/detalji")
def detalji_vezbe(exercise_id: int, db: Session = Depends(get_db)):
    """Vežba + podaci iz kataloga (mišići, koraci, slike). Prvi put je poveže sa katalogom (AI)."""
    e = _vezba_ili_404(db, exercise_id)
    greska = False
    if e.katalog_id is None:
        try:
            e.katalog_id = vezbe_katalog.nadji_u_katalogu(e.naziv_vezbe, e.grupa_misica) or ""
            db.commit()
        except Exception:
            log.exception("Povezivanje sa katalogom nije uspelo")
            greska = True  # ne pamti se -> pokušava se opet sledeći put
    elif e.katalog_id and not vezbe_katalog.postoji(e.katalog_id):
        e.katalog_id = ""  # vežba nestala iz kataloga posle osvežavanja
        db.commit()
    return _odgovor_detalji(db, e, greska)


class KatalogIzbor(BaseModel):
    katalog_id: Optional[str] = Field(None, max_length=200)  # None = "nema je u katalogu"


@router.put("/{exercise_id}/katalog")
def izaberi_iz_kataloga(exercise_id: int, izbor: KatalogIzbor, db: Session = Depends(get_db)):
    """Ručna ispravka veze sa katalogom."""
    e = _vezba_ili_404(db, exercise_id)
    if izbor.katalog_id and not vezbe_katalog.postoji(izbor.katalog_id):
        raise HTTPException(status_code=400, detail="Nepoznata vezba u katalogu")
    e.katalog_id = izbor.katalog_id or ""
    db.commit()
    return _odgovor_detalji(db, e)


@router.delete("/{exercise_id}")
def delete_exercise(exercise_id: int, db: Session = Depends(get_db)):
    exercise = db.query(Exercise).filter(Exercise.id == exercise_id).first()
    if not exercise:
        raise HTTPException(status_code=404, detail="Vezba nije pronadjena")
    db.delete(exercise)
    db.commit()
    return {"deleted": True, "exercise_id": exercise_id}


class ManualExerciseRequest(BaseModel):
    naziv_vezbe: str
    grupa_misica: str
    serije_i_ponavljanja: str


@router.post("/manual")
def add_manual_exercise(request: ManualExerciseRequest, db: Session = Depends(get_db)):
    db_exercise = Exercise(
        naziv_vezbe=request.naziv_vezbe,
        grupa_misica=request.grupa_misica,
        serije_i_ponavljanja=request.serije_i_ponavljanja,
        detektovano_ponavljanja=None,
        source_url="rucno_dodato",
    )
    db.add(db_exercise)
    db.commit()
    db.refresh(db_exercise)
    return {"exercise_id": db_exercise.id}