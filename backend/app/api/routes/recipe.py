from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.services.video_downloader import download_video, get_caption, extract_frames
from app.services.transcription import transcribe_audio
from app.services.recipe_extractor import extract_recipe
from app.models.database import get_db, Recipe
import os
import shutil

router = APIRouter()

class RecipeRequest(BaseModel):
    url: str

@router.post("/")
def process_recipe(request: RecipeRequest, db: Session = Depends(get_db)):
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

        recipe_data = extract_recipe(
            transcript=transcript,
            caption=caption,
            frame_paths=frame_paths,
        )

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
    finally:
        if video_path and os.path.exists(video_path):
            os.remove(video_path)
        if frame_paths:
            frame_dir = os.path.dirname(frame_paths[0])
            if os.path.isdir(frame_dir):
                shutil.rmtree(frame_dir, ignore_errors=True)


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