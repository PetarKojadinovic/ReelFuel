from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.models.database import get_db, MealPlan, ShoppingListItem, Recipe
from app.services.shopping_list_generator import generate_shopping_list

router = APIRouter()


@router.post("/generate-from-recipe")
def generate_from_recipe(request: GenerateFromRecipeRequest, db: Session = Depends(get_db)):
    recipe = db.query(Recipe).filter(Recipe.id == request.recipe_id).first()
    if not recipe:
        raise HTTPException(status_code=404, detail="Recept nije pronadjen")

    db.query(ShoppingListItem).delete()
    db.commit()

    for s in recipe.sastojci or []:
        naziv = (s.get("naziv") or "").strip()
        if not naziv:
            continue
        db.add(ShoppingListItem(naziv=naziv, kolicina=s.get("kolicina"), checked=False))

    db.commit()

    items = db.query(ShoppingListItem).order_by(ShoppingListItem.id.asc()).all()
    return {
        "items": [
            {"id": i.id, "naziv": i.naziv, "kolicina": i.kolicina, "checked": i.checked}
            for i in items
        ],
        "naziv_jela": recipe.naziv_jela,
    }


@router.get("/")
def get_list(db: Session = Depends(get_db)):
    items = db.query(ShoppingListItem).order_by(ShoppingListItem.id.asc()).all()
    return {
        "items": [
            {"id": i.id, "naziv": i.naziv, "kolicina": i.kolicina, "checked": i.checked}
            for i in items
        ]
    }


@router.patch("/{item_id}/toggle")
def toggle_item(item_id: int, db: Session = Depends(get_db)):
    item = db.query(ShoppingListItem).filter(ShoppingListItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Stavka nije pronadjena")
    item.checked = not item.checked
    db.commit()
    return {"id": item.id, "checked": item.checked}


@router.delete("/{item_id}")
def delete_item(item_id: int, db: Session = Depends(get_db)):
    item = db.query(ShoppingListItem).filter(ShoppingListItem.id == item_id).first()
    if item:
        db.delete(item)
        db.commit()
    return {"deleted": True}