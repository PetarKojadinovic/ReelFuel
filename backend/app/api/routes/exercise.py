from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.services.video_downloader import download_video
from app.services.transcription import transcribe_audio
from app.services.pose_analysis import analyze_video
from app.services.exercise_extractor import extract_exercise
from app.models.database import get_db, Exercise
import os

router = APIRouter()


class ExerciseRequest(BaseModel):
    url: str


@router.post("/")
def process_exercise(request: ExerciseRequest, db: Session = Depends(get_db)):
    video_path = None
    try:
        video_path = download_video(request.url)

        try:
            transcript = transcribe_audio(video_path)
        except Exception:
            transcript = ""  # video nema audio ili transkripcija nije uspela - nastavljamo bez njega

        pose_result = analyze_video(video_path)

        exercise_data = extract_exercise(transcript, pose_result)

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
            "transcript": transcript or "Video nema govorni audio - koriscena je samo analiza pokreta",
            "pose_analysis": pose_result,
            "exercise": exercise_data,
            "exercise_id": db_exercise.id,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if video_path and os.path.exists(video_path):
            os.remove(video_path)

            
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
            }
            for e in exercises
        ]
    }


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