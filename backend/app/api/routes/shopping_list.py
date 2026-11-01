from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.models.database import get_db, MealPlan, ShoppingListItem, Recipe
from app.services.shopping_list_generator import generate_shopping_list

router = APIRouter()


class GenerateFromRecipeRequest(BaseModel):
    recipe_id: int


def _items_response(db: Session) -> list:
    items = db.query(ShoppingListItem).order_by(ShoppingListItem.id.asc()).all()
    return [
        {"id": i.id, "naziv": i.naziv, "kolicina": i.kolicina, "checked": i.checked}
        for i in items
    ]


@router.post("/generate")
def generate(db: Session = Depends(get_db)):
    plan = db.query(MealPlan).order_by(MealPlan.id.desc()).first()
    if not plan:
        raise HTTPException(status_code=400, detail="Nema generisanog nedeljnog plana. Prvo generisi plan ishrane.")

    try:
        stavke = generate_shopping_list(plan.plan_data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    db.query(ShoppingListItem).delete()
    db.commit()

    for s in stavke:
        db.add(ShoppingListItem(naziv=s.get("naziv"), kolicina=s.get("kolicina"), checked=False))
    db.commit()

    return {"items": _items_response(db)}


@router.post("/generate-from-recipe")
def generate_from_recipe(request: GenerateFromRecipeRequest, db: Session = Depends(get_db)):
    recipe = db.query(Recipe).filter(Recipe.id == request.recipe_id).first()
    if not recipe:
        raise HTTPException(status_code=404, detail="Recept nije pronadjen")

    # Dodaje u postojecu listu (ne brise je); preskace namirnice koje su vec na listi i nisu kupljene
    vec_ima = {
        (i.naziv or "").strip().lower()
        for i in db.query(ShoppingListItem).filter(ShoppingListItem.checked == False).all()  # noqa: E712
    }
    dodato = 0
    for s in recipe.sastojci or []:
        if not isinstance(s, dict):
            continue
        naziv = (s.get("naziv") or "").strip()
        if not naziv or naziv.lower() in vec_ima:
            continue
        vec_ima.add(naziv.lower())
        db.add(ShoppingListItem(naziv=naziv, kolicina=s.get("kolicina"), checked=False))
        dodato += 1
    db.commit()

    return {"items": _items_response(db), "naziv_jela": recipe.naziv_jela, "dodato": dodato}


@router.get("/")
def get_list(db: Session = Depends(get_db)):
    return {"items": _items_response(db)}


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