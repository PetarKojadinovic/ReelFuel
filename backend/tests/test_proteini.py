"""Proteini: dnevni cilj, zbir u danu, cuvanje uz obrok iz plana i zamenu."""
from datetime import date, timedelta
from types import SimpleNamespace

from app.api.routes.dan import AkcijaRequest, akcija
from app.models.database import FoodLogEntry, MealPlan, UserProfile
from app.services.daily_nutrition import day_summary, dnevni_cilj_proteina, to_g, week_start
from tests.conftest import napravi_plan_data


def _profil(**kw):
    base = dict(tezina_kg=80.0, visina_cm=180.0, godine=25, pol="muski", nivo_aktivnosti="srednji",
                cilj="odrzavanje", ciljna_tezina_kg=None)
    base.update(kw)
    return SimpleNamespace(**base)


def test_cilj_proteina_po_cilju():
    assert dnevni_cilj_proteina(_profil(cilj="odrzavanje")) == 130  # 80 * 1.6 = 128 -> 130
    assert dnevni_cilj_proteina(_profil(cilj="dobijanje_mise")) == 145  # 144 -> 145
    assert dnevni_cilj_proteina(_profil(cilj="mrsavljenje")) == 160


def test_mrsavljenje_koristi_nizu_ciljnu_tezinu():
    assert dnevni_cilj_proteina(_profil(cilj="mrsavljenje", ciljna_tezina_kg=70.0)) == 140
    # ciljna veca od trenutne se ne koristi
    assert dnevni_cilj_proteina(_profil(cilj="mrsavljenje", ciljna_tezina_kg=90.0)) == 160


def test_bez_profila_nema_cilja():
    assert dnevni_cilj_proteina(None) is None


def test_to_g():
    assert to_g("32.44") == 32.4
    assert to_g(None) is None
    assert to_g("oko 30") is None
    assert to_g(-1) is None
    assert to_g(9999) is None


def _setup(db):
    db.add(UserProfile(tezina_kg=80, visina_cm=180, godine=25, pol="muski", nivo_aktivnosti="srednji",
                       cilj="odrzavanje"))
    data = napravi_plan_data(week_start(date.today()).isoformat())
    for d in data["dani"]:
        for m in d["obroci"].values():
            m["proteini_g"] = 30
    db.add(MealPlan(plan_data=data))
    db.commit()


def test_dan_sabira_proteine(db):
    _setup(db)
    danas = date.today().isoformat()
    akcija(danas, "dorucak", AkcijaRequest(akcija="pojeo"), db)
    akcija(danas, "rucak", AkcijaRequest(akcija="zamena", naziv="Burek", kalorije=700, proteini_g=20), db)
    akcija(danas, "vecera", AkcijaRequest(akcija="preskocio"), db)
    db.add(FoodLogEntry(datum=danas, naziv="Stari unos", kalorije=100, izvor="slobodan"))  # bez proteina
    db.commit()

    s = day_summary(db, danas, "23:59")
    assert s["dnevni_cilj_proteina"] == 130
    assert s["proteini_potvrdjeno"] == 50  # 30 iz plana + 20 iz zamene, preskoceno 0
    assert s["proteini_procena"] == 0
    assert s["proteini_nepoznato"] == 1
    assert s["obroci"][0]["proteini_g"] == 30


def test_procena_proteina_za_neoznacen_obrok(db):
    _setup(db)
    sutra = (date.today() + timedelta(days=1)).isoformat()
    s = day_summary(db, sutra, "23:59")
    assert s["proteini_procena"] == 90
    assert s["proteini_ukupno"] == 90


def test_stari_plan_bez_proteina(db):
    db.add(MealPlan(plan_data=napravi_plan_data(week_start(date.today()).isoformat())))
    db.commit()
    danas = date.today().isoformat()
    akcija(danas, "dorucak", AkcijaRequest(akcija="pojeo"), db)
    s = day_summary(db, danas, "00:00")
    assert s["obroci"][0]["proteini_g"] is None
    assert s["proteini_potvrdjeno"] == 0
    assert s["proteini_nepoznato"] == 1
