"""AI generatori (jelovnik, trening, kupovina, slika obroka, recept/vežba) i rute koje ih koriste.

Claude je zamenjen sa LazniLLM: proverava se šta šaljemo modelu i kako čitamo odgovor.
"""
import json

import pytest

from app.models.database import Exercise, MealPlan, Recipe
from app.services import (
    exercise_extractor,
    meal_photo,
    meal_plan_generator as mpg,
    recipe_extractor,
    shopping_list_generator as slg,
    workout_plan_generator as wpg,
)
from tests.conftest import PROFIL, LazniLLM, napravi_plan_data

PLAN = napravi_plan_data("2026-11-02")


# --- Jelovnik --------------------------------------------------------------

def test_jelovnik_salje_recepte_i_cilj_proteina(monkeypatch):
    k = LazniLLM("```json\n" + json.dumps({"dani": PLAN["dani"]}) + "\n```")
    monkeypatch.setattr(mpg, "client", k)
    recept = {"id": 7, "naziv_jela": "Piletina", "priblizne_kalorije": "oko 500", "proteini_g": 42,
              "sastojci": [{"naziv": "piletina", "kolicina": "200g"}]}
    plan = mpg.generate_weekly_plan(2100, [recept], "rucak_najveci", 160)
    assert len(plan["dani"]) == 7  # ```json ograda ne smeta
    poruka = k.poruka()
    assert "2100" in poruka and "160 g" in poruka
    assert "ID 7: Piletina" in poruka and "200g piletina" in poruka and "~42 g proteina" in poruka
    assert "rucak ~40-50%" in k.pozivi[0]["system"]


def test_jelovnik_nepoznata_raspodela_koristi_podrazumevanu():
    assert "vecera najveci obrok" in mpg.build_system_prompt("nesto")


def test_ruta_jelovnik(api, monkeypatch):
    client, Session = api
    assert client.post("/mealplan/generate").status_code == 400  # bez profila
    client.post("/profile/", json=PROFIL)
    monkeypatch.setattr("app.api.routes.meal_plan.generate_weekly_plan", lambda *a: {"dani": PLAN["dani"]})
    r = client.post("/mealplan/generate").json()
    assert r["plan"]["nedelja_od"]  # plan se veže za tekuću nedelju
    assert r["dnevni_cilj_kalorija"] > 0
    assert client.get("/mealplan/latest").json()["plan_id"] == r["plan_id"]


def test_ruta_jelovnik_greska_ai(api, monkeypatch):
    client, _ = api
    client.post("/profile/", json=PROFIL)

    def puca(*a):
        raise ValueError("Model nije vratio JSON: tajna")

    monkeypatch.setattr("app.api.routes.meal_plan.generate_weekly_plan", puca)
    r = client.post("/mealplan/generate")
    assert r.status_code == 500 and "tajna" not in r.text
    assert client.get("/mealplan/latest").json() == {"exists": False}


# --- Trening ---------------------------------------------------------------

def test_trening_dva_plana_i_sacuvane_vezbe(monkeypatch):
    k = LazniLLM('{"tip_splita": "upper/lower", "dani": []}')
    monkeypatch.setattr(wpg, "client", k)
    vezba = {"id": 3, "naziv_vezbe": "Zgib", "grupa_misica": "leđa", "serije_i_ponavljanja": "3x8"}
    plan = wpg.generate_weekly_workout_plan(4, "mrsavljenje", [vezba])
    assert set(plan) == {"teretana", "street_workout"}
    assert len(k.pozivi) == 2
    assert "teretanu" in k.pozivi[0]["system"] and "sopstvenom tezinom" in k.pozivi[1]["system"]
    assert "tacno 4 dana" in k.pozivi[0]["system"]
    assert "ID 3: Zgib" in k.poruka(0)


def test_ruta_trening(api, monkeypatch):
    client, Session = api
    assert client.post("/workoutplan/generate").status_code == 400
    client.post("/profile/", json={**PROFIL, "broj_treninga_nedeljno": 3})
    db = Session()
    db.add(Exercise(naziv_vezbe="Zgib", grupa_misica="leđa", serije_i_ponavljanja="3x8"))
    db.commit()
    db.close()
    primljeno = {}

    def gen(broj, cilj, vezbe):
        primljeno.update(broj=broj, cilj=cilj, vezbe=vezbe)
        return {"teretana": {"dani": []}, "street_workout": {"dani": []}}

    monkeypatch.setattr("app.api.routes.workout_plan.generate_weekly_workout_plan", gen)
    assert client.get("/workoutplan/latest").json() == {"exists": False}
    r = client.post("/workoutplan/generate").json()
    assert primljeno["broj"] == 3 and primljeno["vezbe"][0]["naziv_vezbe"] == "Zgib"
    assert client.get("/workoutplan/latest").json()["plan_id"] == r["plan_id"]

    monkeypatch.setattr("app.api.routes.workout_plan.generate_weekly_workout_plan",
                        lambda *a: (_ for _ in ()).throw(RuntimeError("x")))
    assert client.post("/workoutplan/generate").status_code == 500


def test_dnevnik_treninga(api):
    client, _ = api
    e = client.post("/workoutlog/", json={"datum": "2026-11-06", "naziv_vezbe": "Zgib", "serije_i_ponavljanja": "3x8"}).json()
    assert [u["naziv_vezbe"] for u in client.get("/workoutlog/2026-11-06").json()["unosi"]] == ["Zgib"]
    client.delete(f"/workoutlog/{e['entry_id']}")
    assert client.get("/workoutlog/2026-11-06").json()["unosi"] == []


# --- Kupovina --------------------------------------------------------------

def test_kupovina_salje_sve_sastojke(monkeypatch):
    k = LazniLLM('{"stavke": [{"naziv": "Jaja", "kolicina": "10"}]}')
    monkeypatch.setattr(slg, "client", k)
    plan = {"dani": [{"obroci": {"dorucak": {"sastojci": [{"naziv": "jaja", "kolicina": "2"}]},
                                 "rucak": {"sastojci": [{"naziv": "jaja", "kolicina": "3"}, {"naziv": "so"}]}}}]}
    assert slg.generate_shopping_list(plan) == [{"naziv": "Jaja", "kolicina": "10"}]
    assert "- 2 jaja" in k.poruka() and "- 3 jaja" in k.poruka() and "- so" in k.poruka()


def test_kupovina_bez_sastojaka_ne_zove_ai(monkeypatch):
    k = LazniLLM("{}")
    monkeypatch.setattr(slg, "client", k)
    assert slg.generate_shopping_list({"dani": [{"obroci": {"dorucak": {}}}]}) == []
    assert k.pozivi == []


def test_ruta_kupovina_greske(api, monkeypatch):
    client, Session = api
    assert client.post("/shoppinglist/generate").status_code == 400  # nema plana
    db = Session()
    db.add(MealPlan(plan_data=PLAN))
    db.commit()
    db.close()
    monkeypatch.setattr("app.api.routes.shopping_list.generate_shopping_list",
                        lambda p: (_ for _ in ()).throw(ValueError("x")))
    assert client.post("/shoppinglist/generate").status_code == 500
    assert client.post("/shoppinglist/generate-from-recipe", json={"recipe_id": 999}).status_code == 404


# --- Slika obroka ----------------------------------------------------------

def test_slika_obroka_zaokruzuje_brojeve(monkeypatch):
    k = LazniLLM('Evo: {"naziv": "Pica", "kalorije": "812.6", "kalorije_min": 700, "kalorije_max": null, "proteini_g": 30.4}')
    monkeypatch.setattr(meal_photo, "client", k)
    r = meal_photo.analyze_meal_photo("AAAA", "image/jpeg")
    assert r == {"naziv": "Pica", "kalorije": 813, "kalorije_min": 700, "kalorije_max": None, "proteini_g": 30, "pouzdanost": "niska"}
    slika = k.pozivi[0]["messages"][0]["content"][0]
    assert slika["source"] == {"type": "base64", "media_type": "image/jpeg", "data": "AAAA"}


def test_slika_bez_hrane(monkeypatch):
    monkeypatch.setattr(meal_photo, "client", LazniLLM('{"naziv": null, "kalorije": "nema", "pouzdanost": "visoka"}'))
    r = meal_photo.analyze_meal_photo("AAAA", "image/png")
    assert r["naziv"] is None and r["kalorije"] is None and r["pouzdanost"] == "visoka"


# --- Izvlačenje recepta / vežbe --------------------------------------------

def test_recept_iz_opisa_i_transkripta(monkeypatch):
    k = LazniLLM('{"naziv_jela": "Palačinke", "sastojci": [], "koraci": []}')
    monkeypatch.setattr(recipe_extractor, "client", k)
    assert recipe_extractor.extract_recipe("", "2 jaja")["naziv_jela"] == "Palačinke"
    assert "2 jaja" in k.poruka() and "(nema)" in k.poruka()


def test_vezba_dobija_analizu_pokreta(monkeypatch):
    k = LazniLLM('{"naziv_vezbe": "Čučanj", "grupa_misica": "noge", "serije_i_ponavljanja": "3x12"}')
    monkeypatch.setattr(exercise_extractor, "client", k)
    r = exercise_extractor.extract_exercise("radi čučnjeve", {"detektovano_ponavljanja": 12}, "")
    assert r["naziv_vezbe"] == "Čučanj"
    assert '"detektovano_ponavljanja": 12' in k.poruka()


def test_ai_bez_json_odgovora_je_greska(monkeypatch):
    monkeypatch.setattr(recipe_extractor, "client", LazniLLM("Izvini, ne mogu."))
    with pytest.raises(ValueError):
        recipe_extractor.extract_recipe("x", "y")


# --- Rute /recipe/ i /exercise/ (stari put bez ingest-a) --------------------

URL = "https://www.tiktok.com/@kuvar/video/123"


@pytest.fixture
def lazno_preuzimanje(monkeypatch, tmp_path):
    video = tmp_path / "v.mp4"
    frejmovi = tmp_path / "frames_x"

    def download_video(url):
        video.write_bytes(b"x")
        return str(video)

    def extract_frames(path):
        frejmovi.mkdir()
        (frejmovi / "f0.jpg").write_bytes(b"x")
        return [str(frejmovi / "f0.jpg")]

    for modul in ("app.api.routes.recipe", "app.api.routes.exercise"):
        monkeypatch.setattr(f"{modul}.download_video", download_video)
        monkeypatch.setattr(f"{modul}.transcribe_audio", lambda p: (_ for _ in ()).throw(RuntimeError("nema zvuka")))
        monkeypatch.setattr(f"{modul}.get_caption", lambda u: "opis")
        monkeypatch.setattr(f"{modul}.extract_frames", extract_frames)
    return video, frejmovi


def test_ruta_recept_iz_linka(api, monkeypatch, lazno_preuzimanje):
    client, Session = api
    video, frejmovi = lazno_preuzimanje
    monkeypatch.setattr("app.api.routes.recipe.extract_recipe",
                        lambda transcript, caption: {"naziv_jela": "Supa", "sastojci": [], "koraci": [], "proteini_g": "12"})
    r = client.post("/recipe/", json={"url": URL}).json()
    assert r["transcript"] == ""  # video bez zvuka ne obara obradu
    assert not video.exists() and not frejmovi.exists()  # privremeni fajlovi obrisani
    recepti = client.get("/recipe/list").json()["recipes"]
    assert recepti[0]["naziv_jela"] == "Supa" and recepti[0]["proteini_g"] == 12
    assert client.delete(f"/recipe/{r['recipe_id']}").json()["deleted"]
    assert client.delete(f"/recipe/{r['recipe_id']}").status_code == 404


def test_ruta_recept_zabranjen_link(api):
    client, _ = api
    assert client.post("/recipe/", json={"url": "http://127.0.0.1:8000/docs"}).status_code == 400
    assert client.post("/exercise/", json={"url": "file:///etc/passwd"}).status_code == 400


def test_ruta_recept_greska_bez_detalja(api, monkeypatch, lazno_preuzimanje):
    client, _ = api
    video, _ = lazno_preuzimanje
    monkeypatch.setattr("app.api.routes.recipe.extract_recipe", lambda **kw: (_ for _ in ()).throw(ValueError("interno")))
    r = client.post("/recipe/", json={"url": URL})
    assert r.status_code == 500 and "interno" not in r.text
    assert not video.exists()


def test_ruta_vezba_iz_linka(api, monkeypatch, lazno_preuzimanje):
    client, _ = api
    video, frejmovi = lazno_preuzimanje
    monkeypatch.setattr("app.api.routes.exercise.analyze_video", lambda p: {"detektovano_ponavljanja": 9})
    monkeypatch.setattr("app.api.routes.exercise.extract_exercise",
                        lambda t, pose, caption: {"naziv_vezbe": "Sklek", "grupa_misica": "grudi", "serije_i_ponavljanja": "3x10"})
    r = client.post("/exercise/", json={"url": URL})
    assert r.status_code == 200, r.text
    assert r.json()["exercise"]["naziv_vezbe"] == "Sklek"
    assert not video.exists() and not frejmovi.exists()
    vezbe = client.get("/exercise/list").json()["exercises"]
    assert vezbe[0]["detektovano_ponavljanja"] == 9
    assert client.delete(f"/exercise/{vezbe[0]['id']}").json()["deleted"]
    assert client.delete(f"/exercise/{vezbe[0]['id']}").status_code == 404


def test_rucni_recept_i_vezba(api, monkeypatch):
    client, Session = api
    r = client.post("/recipe/manual", json={"naziv_jela": "Salata", "sastojci": [], "koraci": [], "proteini_g": 5}).json()
    e = client.post("/exercise/manual", json={"naziv_vezbe": "Plank", "grupa_misica": "core", "serije_i_ponavljanja": "3x60s"}).json()
    db = Session()
    assert db.get(Recipe, r["recipe_id"]).source_url == "rucno_dodato"
    assert db.get(Exercise, e["exercise_id"]).naziv_vezbe == "Plank"
    db.close()
    assert client.post("/recipe/manual", json={"naziv_jela": "X", "sastojci": [], "koraci": [], "proteini_g": -1}).status_code == 422
