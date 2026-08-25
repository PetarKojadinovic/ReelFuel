from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from app.models.database import get_db, UserProfile, Exercise, WorkoutPlan
from app.services.workout_plan_generator import generate_weekly_workout_plan

router = APIRouter()


@router.post("/generate")
def generate_plan(db: Session = Depends(get_db)):
    profile = db.query(UserProfile).first()
    if not profile:
        raise HTTPException(status_code=400, detail="Prvo napravi profil (POST /profile/)")

    exercises = db.query(Exercise).all()
    saved_exercises = [
        {
            "id": e.id,
            "naziv_vezbe": e.naziv_vezbe,
            "grupa_misica": e.grupa_misica,
            "serije_i_ponavljanja": e.serije_i_ponavljanja,
        }
        for e in exercises
    ]

    try:
        plan_data = generate_weekly_workout_plan(
            profile.broj_treninga_nedeljno, profile.cilj, saved_exercises
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    db_plan = WorkoutPlan(plan_data=plan_data)
    db.add(db_plan)
    db.commit()
    db.refresh(db_plan)

    return {"plan_id": db_plan.id, "plan": plan_data}


@router.get("/latest")
def get_latest_plan(db: Session = Depends(get_db)):
    plan = db.query(WorkoutPlan).order_by(WorkoutPlan.id.desc()).first()
    if not plan:
        return {"exists": False}
    return {"exists": True, "plan_id": plan.id, "plan": plan.plan_data}