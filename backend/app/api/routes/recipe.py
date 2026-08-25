from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.services.video_downloader import download_audio
from app.services.transcription import transcribe_audio
from app.services.recipe_extractor import extract_recipe
from app.models.database import get_db, Recipe
import os

router = APIRouter()

class RecipeRequest(BaseModel):
    url: str

@router.post("/")
def process_recipe(request: RecipeRequest, db: Session = Depends(get_db)):
    try:
        audio_path = download_audio(request.url)
        transcript = transcribe_audio(audio_path)

        if os.path.exists(audio_path):
            os.remove(audio_path)

        recipe_data = extract_recipe(transcript)

        db_recipe = Recipe(
            naziv_jela=recipe_data.get("naziv_jela"),
            sastojci=recipe_data.get("sastojci"),
            koraci=recipe_data.get("koraci"),
            priblizne_kalorije=recipe_data.get("priblizne_kalorije"),
            source_url=request.url,
        )
        db.add(db_recipe)
        db.commit()
        db.refresh(db_recipe)

        return {
            "transcript": transcript,
            "recipe": recipe_data,
            "recipe_id": db_recipe.id,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/list")
def list_recipes(db: Session = Depends(get_db)):
    recipes = db.query(Recipe).order_by(Recipe.id.desc()).all()
    return {
        "recipes": [
            {
                "id": r.id,
                "naziv_jela": r.naziv_jela,
                "sastojci": r.sastojci,
                "koraci": r.koraci,
                "priblizne_kalorije": r.priblizne_kalorije,
            }
            for r in recipes
        ]
    }


@router.delete("/{recipe_id}")
def delete_recipe(recipe_id: int, db: Session = Depends(get_db)):
    recipe = db.query(Recipe).filter(Recipe.id == recipe_id).first()
    if not recipe:
        raise HTTPException(status_code=404, detail="Recept nije pronadjen")
    db.delete(recipe)
    db.commit()
    return {"deleted": True, "recipe_id": recipe_id}


class ManualRecipeRequest(BaseModel):
    naziv_jela: str
    sastojci: list
    koraci: list
    priblizne_kalorije: str | None = None


@router.post("/manual")
def add_manual_recipe(request: ManualRecipeRequest, db: Session = Depends(get_db)):
    db_recipe = Recipe(
        naziv_jela=request.naziv_jela,
        sastojci=request.sastojci,
        koraci=request.koraci,
        priblizne_kalorije=request.priblizne_kalorije,
        source_url="rucno_dodato",
    )
    db.add(db_recipe)
    db.commit()
    db.refresh(db_recipe)
    return {"recipe_id": db_recipe.id}