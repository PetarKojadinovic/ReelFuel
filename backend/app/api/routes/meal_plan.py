import logging
from datetime import date

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from app.models.database import get_db, UserProfile, Recipe, MealPlan
from app.services.meal_plan_generator import generate_weekly_plan
from app.services.daily_nutrition import get_dnevni_cilj, get_dnevni_cilj_proteina, prenesi_izmene, week_start

log = logging.getLogger("mealplan")
router = APIRouter()


@router.post("/generate")
def generate_plan(db: Session = Depends(get_db)):
    profile = db.query(UserProfile).first()
    if not profile:
        raise HTTPException(status_code=400, detail="Prvo napravi profil (POST /profile/)")

    dnevni_cilj = get_dnevni_cilj(db)

    recipes = db.query(Recipe).all()
    saved_recipes = [
        {
            "id": r.id,
            "naziv_jela": r.naziv_jela,
            "priblizne_kalorije": r.priblizne_kalorije,
            "sastojci": r.sastojci,
            "proteini_g": r.proteini_g,
        }
            for r in recipes
    ]

    try:
        plan_data = generate_weekly_plan(
            dnevni_cilj, saved_recipes, profile.raspodela_kalorija, get_dnevni_cilj_proteina(db)
        )
    except Exception:
        log.exception("Greska u mealplan")
        raise HTTPException(status_code=500, detail="Pravljenje plana ishrane nije uspelo. Pokušaj ponovo.")

    # Plan je vezan za tekucu nedelju (ponedeljak), da prosle nedelje u dnevniku zadrze svoj plan
    plan_data["nedelja_od"] = week_start(date.today()).isoformat()
    prethodni = db.query(MealPlan).order_by(MealPlan.id.desc()).first()
    plan_data = prenesi_izmene(prethodni.plan_data if prethodni else None, plan_data)
    db_plan = MealPlan(plan_data=plan_data)
    db.add(db_plan)
    db.commit()
    db.refresh(db_plan)

    return {
        "plan_id": db_plan.id,
        "dnevni_cilj_kalorija": dnevni_cilj,
        "dnevni_cilj_proteina": get_dnevni_cilj_proteina(db),
        "plan": plan_data,
    }


@router.get("/latest")
def get_latest_plan(db: Session = Depends(get_db)):
    plan = db.query(MealPlan).order_by(MealPlan.id.desc()).first()
    if not plan:
        return {"exists": False}
    return {"exists": True, "plan_id": plan.id, "plan": plan.plan_data}