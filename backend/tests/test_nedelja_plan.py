from datetime import date, datetime

from app.models.database import MealPlan
from app.services.nedelja_plan import plan_is_current
from tests.conftest import napravi_plan_data


def test_nema_plana(db):
    assert not plan_is_current(db, date(2026, 11, 9))


def test_plan_ove_nedelje_je_azuran(db):
    db.add(MealPlan(plan_data=napravi_plan_data("2026-11-02")))
    db.commit()
    assert plan_is_current(db, date(2026, 11, 8))  # nedelja, ista nedelja
    assert not plan_is_current(db, date(2026, 11, 9))  # ponedeljak: treba nov


def test_nedelja_od_ima_prednost_nad_created_at(db):
    # Napravljen u nedelju uveče po UTC-u, ali lokalno je već ponedeljak -> nedelja_od = ponedeljak
    db.add(MealPlan(plan_data=napravi_plan_data("2026-11-09"), created_at=datetime(2026, 11, 8, 23, 30)))
    db.commit()
    assert plan_is_current(db, date(2026, 11, 9))


def test_stari_plan_bez_nedelja_od_koristi_created_at(db):
    data = napravi_plan_data("2026-11-02")
    del data["nedelja_od"]
    db.add(MealPlan(plan_data=data, created_at=datetime(2026, 11, 4, 10, 0)))
    db.commit()
    assert plan_is_current(db, date(2026, 11, 6))
    assert not plan_is_current(db, date(2026, 11, 10))
