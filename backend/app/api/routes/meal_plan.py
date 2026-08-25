from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from app.models.database import get_db, UserProfile, Recipe, MealPlan
from app.services.meal_plan_generator import generate_weekly_plan

router = APIRouter()


@router.post("/generate")
def generate_plan(db: Session = Depends(get_db)):
    profile = db.query(UserProfile).first()
    if not profile:
        raise HTTPException(status_code=400, detail="Prvo napravi profil (POST /profile/)")

    if profile.pol == "muski":
        bmr = 10 * profile.tezina_kg + 6.25 * profile.visina_cm - 5 * profile.godine + 5
    else:
        bmr = 10 * profile.tezina_kg + 6.25 * profile.visina_cm - 5 * profile.godine - 161

    activity_multipliers = {"nizak": 1.2, "srednji": 1.55, "visok": 1.725}
    tdee = bmr * activity_multipliers.get(profile.nivo_aktivnosti, 1.55)
    dnevni_cilj = round(tdee - 500) if profile.cilj == "mrsavljenje" else round(tdee)

    recipes = db.query(Recipe).all()
    saved_recipes = [
        {
            "id": r.id,
            "naziv_jela": r.naziv_jela,
            "priblizne_kalorije": r.priblizne_kalorije,
            "sastojci": r.sastojci,
        }
            for r in recipes
    ]

    try:
        plan_data = generate_weekly_plan(dnevni_cilj, saved_recipes, profile.raspodela_kalorija)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    db_plan = MealPlan(plan_data=plan_data)
    db.add(db_plan)
    db.commit()
    db.refresh(db_plan)

    return {"plan_id": db_plan.id, "dnevni_cilj_kalorija": dnevni_cilj, "plan": plan_data}


@router.get("/latest")
def get_latest_plan(db: Session = Depends(get_db)):
    plan = db.query(MealPlan).order_by(MealPlan.id.desc()).first()
    if not plan:
        return {"exists": False}
    return {"exists": True, "plan_id": plan.id, "plan": plan.plan_data}