from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from app.models.database import get_db, MealPlan, ShoppingListItem
from app.services.shopping_list_generator import generate_shopping_list

router = APIRouter()


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

    items = db.query(ShoppingListItem).all()
    return {
        "items": [
            {"id": i.id, "naziv": i.naziv, "kolicina": i.kolicina, "checked": i.checked}
            for i in items
        ]
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