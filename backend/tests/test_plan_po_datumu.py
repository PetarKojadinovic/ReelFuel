"""/plan/ubaci za dan druge nedelje ne sme da menja tekuci plan (bug iz CONTEXT.md §7)."""
from datetime import date

import pytest

from app.api.routes import meal_plan as meal_plan_route
from app.api.routes import plan as plan_route
from app.models.database import MealPlan, Recipe, UserProfile
from app.services.daily_nutrition import day_plan, prenesi_izmene
from tests.conftest import napravi_plan_data

SREDA = date(2026, 11, 4)  # tekuca nedelja pocinje 2026-11-02; sledeca 2026-11-09


class _FakeDate(date):
    @classmethod
    def today(cls):
        return SREDA


@pytest.fixture
def plan_i_recept(db, monkeypatch):
    monkeypatch.setattr(plan_route, "date", _FakeDate)
    plan = MealPlan(plan_data=napravi_plan_data("2026-11-02"))
    recept = Recipe(naziv_jela="Piletina sa pirincem", sastojci=[], koraci=[], priblizne_kalorije="650 kcal")
    db.add_all([plan, recept])
    db.commit()
    return plan, recept


def test_ubaci_u_sledecu_nedelju_ne_menja_tekucu(db, plan_i_recept):
    plan, recept = plan_i_recept
    # SREDA + 5 = ponedeljak 2026-11-09 (sledeca nedelja)
    plan_route.ubaci(plan_route.UbaciRequest(recipe_id=recept.id, dan_offset=5, obrok_tip="rucak"), db)

    tekuci_ponedeljak = day_plan(db, "2026-11-02")
    sledeci_ponedeljak = day_plan(db, "2026-11-09")
    assert tekuci_ponedeljak["obroci"]["rucak"]["naziv"] == "ponedeljak rucak"
    assert sledeci_ponedeljak["obroci"]["rucak"]["naziv"] == "Piletina sa pirincem"
    assert sledeci_ponedeljak["obroci"]["rucak"]["kalorije"] == 650
    assert sledeci_ponedeljak["ukupno_kalorija"] == 500 + 650 + 500


def test_ubaci_u_tekucu_nedelju_menja_plan(db, plan_i_recept):
    plan, recept = plan_i_recept
    # SREDA + 1 = cetvrtak iste nedelje
    plan_route.ubaci(plan_route.UbaciRequest(recipe_id=recept.id, dan_offset=1, obrok_tip="vecera"), db)

    db.refresh(plan)
    cetvrtak = next(d for d in plan.plan_data["dani"] if d["dan"] == "Cetvrtak")
    assert cetvrtak["obroci"]["vecera"]["naziv"] == "Piletina sa pirincem"
    assert "izmene" not in plan.plan_data


def test_izmena_se_prenosi_u_novi_plan(db, plan_i_recept, monkeypatch):
    plan, recept = plan_i_recept
    plan_route.ubaci(plan_route.UbaciRequest(recipe_id=recept.id, dan_offset=5, obrok_tip="rucak"), db)

    # Ponedeljak sledece nedelje: pravi se novi plan (LLM zamenjen laznim planom)
    class _Ponedeljak(date):
        @classmethod
        def today(cls):
            return date(2026, 11, 9)

    monkeypatch.setattr(meal_plan_route, "date", _Ponedeljak)
    monkeypatch.setattr(meal_plan_route, "generate_weekly_plan", lambda *a, **k: napravi_plan_data("x", kcal=400))
    monkeypatch.setattr(meal_plan_route, "get_dnevni_cilj", lambda db: 2000)
    db.add(UserProfile(tezina_kg=80, visina_cm=180, godine=25, pol="muski", nivo_aktivnosti="srednji"))
    db.commit()

    meal_plan_route.generate_plan(db)

    novi_ponedeljak = day_plan(db, "2026-11-09")
    assert novi_ponedeljak["obroci"]["rucak"]["naziv"] == "Piletina sa pirincem"
    assert novi_ponedeljak["obroci"]["dorucak"]["kalorije"] == 400
    # Prosla nedelja zadrzava svoj (stari) plan
    assert day_plan(db, "2026-11-02")["obroci"]["rucak"]["naziv"] == "ponedeljak rucak"


def test_prenesi_izmene_odbacuje_prosle_i_cuva_kasnije():
    stari = {"izmene": {
        "2026-11-01": {"rucak": {"naziv": "prosli"}},
        "2026-11-10": {"rucak": {"naziv": "ova nedelja", "kalorije": 300}},
        "2026-11-20": {"vecera": {"naziv": "kasnije"}},
    }}
    novi = prenesi_izmene(stari, napravi_plan_data("2026-11-09"))
    utorak = next(d for d in novi["dani"] if d["dan"] == "Utorak")
    assert utorak["obroci"]["rucak"]["naziv"] == "ova nedelja"
    assert novi["izmene"] == {"2026-11-20": {"vecera": {"naziv": "kasnije"}}}


def test_slotovi_ova_i_sledeca_nedelja_po_datumu(db, plan_i_recept):
    _, recept = plan_i_recept
    res = plan_route.slotovi(recipe_id=recept.id, sada="00:00", db=db)
    slotovi = res["slotovi"]
    datumi = [s["datum"] for s in slotovi]

    # od srede 2026-11-04 do nedelje 2026-11-15, po 3 obroka, po redu
    assert datumi[0] == "2026-11-04" and datumi[-1] == "2026-11-15"
    assert len(slotovi) == 12 * 3
    assert datumi == sorted(datumi)
    assert [s["obrok_tip"] for s in slotovi[:3]] == ["dorucak", "rucak", "vecera"]
    assert {s["nedelja"] for s in slotovi if s["datum"] < "2026-11-09"} == {0}
    assert {s["nedelja"] for s in slotovi if s["datum"] >= "2026-11-09"} == {1}
    assert res["danas"] == "2026-11-04"


def test_ubaci_poslednji_dan_sledece_nedelje(db, plan_i_recept):
    _, recept = plan_i_recept
    # SREDA + 11 = nedelja 2026-11-15
    res = plan_route.ubaci(plan_route.UbaciRequest(recipe_id=recept.id, dan_offset=11, obrok_tip="vecera"), db)
    assert res["datum"] == "2026-11-15"
    assert day_plan(db, "2026-11-15")["obroci"]["vecera"]["naziv"] == "Piletina sa pirincem"
    assert day_plan(db, "2026-11-08")["obroci"]["vecera"]["naziv"] == "nedelja vecera"
