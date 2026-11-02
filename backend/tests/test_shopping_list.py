"""Nova lista iz plana zamenjuje samo stavke iz plana, ne i one iz recepta (bug iz CONTEXT.md §7)."""
import pytest

from app.api.routes import shopping_list as sl
from app.models.database import MealPlan, Recipe, ShoppingListItem
from tests.conftest import napravi_plan_data


@pytest.fixture
def lazni_llm(monkeypatch):
    stavke = {"lista": [{"naziv": "Jaja", "kolicina": "10 kom"}, {"naziv": "Mleko", "kolicina": "1 l"}]}
    monkeypatch.setattr(sl, "generate_shopping_list", lambda plan_data: stavke["lista"])
    return stavke


def _nazivi(db):
    return sorted(i.naziv for i in db.query(ShoppingListItem).all())


def test_generate_cuva_stavke_iz_recepta(db, lazni_llm):
    db.add(MealPlan(plan_data=napravi_plan_data("2026-11-02")))
    db.add(Recipe(naziv_jela="Palacinke", sastojci=[{"naziv": "Brasno", "kolicina": "300 g"}], koraci=[]))
    db.commit()

    sl.generate_from_recipe(sl.GenerateFromRecipeRequest(recipe_id=1), db)
    sl.generate(db)
    assert _nazivi(db) == ["Brasno", "Jaja", "Mleko"]

    # Novi plan: stare stavke iz plana se menjaju, recept ostaje
    lazni_llm["lista"] = [{"naziv": "Piletina", "kolicina": "1 kg"}]
    sl.generate(db)
    assert _nazivi(db) == ["Brasno", "Piletina"]


def test_generate_bez_duplikata_sa_receptom(db, lazni_llm):
    db.add(MealPlan(plan_data=napravi_plan_data("2026-11-02")))
    db.add(Recipe(naziv_jela="Omlet", sastojci=[{"naziv": "jaja", "kolicina": "3"}], koraci=[]))
    db.commit()

    sl.generate_from_recipe(sl.GenerateFromRecipeRequest(recipe_id=1), db)
    sl.generate(db)
    assert _nazivi(db) == ["Mleko", "jaja"]


def test_kupljene_stavke_iz_plana_se_brisu(db, lazni_llm):
    db.add(MealPlan(plan_data=napravi_plan_data("2026-11-02")))
    db.commit()
    sl.generate(db)
    jaja = db.query(ShoppingListItem).filter_by(naziv="Jaja").one()
    sl.toggle_item(jaja.id, db)

    sl.generate(db)
    assert _nazivi(db) == ["Jaja", "Mleko"]
    assert all(not i.checked for i in db.query(ShoppingListItem).all())
