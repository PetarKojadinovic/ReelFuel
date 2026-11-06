"""Funkcijski testovi preko HTTP-a: ključ, profil, težina, dnevnik hrane, kopija, nedelja."""
from datetime import date, timedelta

from app.models.database import MealPlan
from tests.conftest import PROFIL, TEST_API_KEY, napravi_plan_data
from app.services.daily_nutrition import week_start


# --- X-API-Key -------------------------------------------------------------

def test_bez_kljuca_401(api):
    client, _ = api
    r = client.get("/profile/", headers={"X-API-Key": ""})
    assert r.status_code == 401


def test_pogresan_kljuc_401(api):
    client, _ = api
    assert client.get("/profile/", headers={"X-API-Key": TEST_API_KEY + "x"}).status_code == 401
    assert client.get("/", headers={"X-API-Key": "pogresan"}).status_code == 401


def test_dobar_kljuc_200(api):
    client, _ = api
    assert client.get("/").status_code == 200


# --- Profil ----------------------------------------------------------------

def test_profil_ne_postoji(api):
    client, _ = api
    assert client.get("/profile/").json() == {"exists": False}


def test_profil_cuva_i_racuna_cilj(api):
    client, _ = api
    r = client.post("/profile/", json=PROFIL)
    assert r.status_code == 200
    d = r.json()
    # Mifflin-St Jeor: 10*85 + 6.25*180 - 5*25 + 5 = 1855; * 1.55 = 2875
    assert d["bmr"] == 1855
    assert d["tdee"] == 2875
    assert 1500 <= d["dnevni_cilj_kalorija"] < d["tdee"]  # mršavljenje = ispod TDEE
    assert d["dnevni_cilj_proteina"] > 0

    p = client.get("/profile/").json()
    assert p["exists"] and p["tezina_kg"] == 85
    assert p["broj_treninga_nedeljno"] == 4  # podrazumevano
    # Prvo čuvanje upisuje i težinu za danas
    s = client.get("/weightlog/summary").json()
    assert s["trenutna_tezina"] == 85


def test_profil_zadrzava_broj_treninga(api):
    client, _ = api
    client.post("/profile/", json={**PROFIL, "broj_treninga_nedeljno": 5})
    client.post("/profile/", json={**PROFIL, "tezina_kg": 84})  # stari klijent ne šalje polje
    assert client.get("/profile/").json()["broj_treninga_nedeljno"] == 5


def test_profil_validacija(api):
    client, _ = api
    assert client.post("/profile/", json={**PROFIL, "pol": "x"}).status_code == 422
    assert client.post("/profile/", json={**PROFIL, "tezina_kg": 5}).status_code == 422
    assert client.post("/profile/", json={**PROFIL, "godine": 500}).status_code == 422
    assert client.post("/profile/", json={**PROFIL, "broj_treninga_nedeljno": 9}).status_code == 422
    assert client.get("/profile/").json() == {"exists": False}


# --- Težina ----------------------------------------------------------------

def test_tezina_azurira_profil_i_progres(api):
    client, _ = api
    client.post("/profile/", json=PROFIL)  # 85 danas, cilj 78
    danas = date.today()
    client.post("/weightlog/", json={"datum": (danas - timedelta(days=10)).isoformat(), "tezina_kg": 86})
    client.post("/weightlog/", json={"datum": danas.isoformat(), "tezina_kg": 82})
    s = client.get("/weightlog/summary").json()
    assert s["pocetna_tezina"] == 86
    assert s["trenutna_tezina"] == 82
    assert s["progres_procenat"] == 50  # (86-82)/(86-78)
    assert client.get("/profile/").json()["tezina_kg"] == 82


def test_stara_tezina_ne_menja_trenutnu(api):
    """Upis za prošli datum ne sme da pregazi trenutnu težinu u profilu."""
    client, _ = api
    client.post("/profile/", json=PROFIL)  # 85 danas
    juce = (date.today() - timedelta(days=1)).isoformat()
    client.post("/weightlog/", json={"datum": juce, "tezina_kg": 90})
    assert client.get("/profile/").json()["tezina_kg"] == 85


def test_isti_dan_se_prepisuje(api):
    client, _ = api
    danas = date.today().isoformat()
    client.post("/weightlog/", json={"datum": danas, "tezina_kg": 80})
    client.post("/weightlog/", json={"datum": danas, "tezina_kg": 79.5})
    client.post("/profile/", json={**PROFIL, "tezina_kg": 79.5})
    assert len(client.get("/weightlog/summary").json()["istorija"]) == 1


def test_tezina_validacija(api):
    client, _ = api
    danas = date.today().isoformat()
    assert client.post("/weightlog/", json={"datum": danas, "tezina_kg": -3}).status_code == 422
    assert client.post("/weightlog/", json={"datum": danas, "tezina_kg": 1000}).status_code == 422
    assert client.post("/weightlog/", json={"datum": "juce", "tezina_kg": 80}).status_code == 422


# --- Dnevnik hrane ---------------------------------------------------------

def test_dnevnik_hrane_sabira_dan(api):
    client, _ = api
    client.post("/profile/", json=PROFIL)
    d = "2026-11-06"
    a = client.post("/log/", json={"datum": d, "naziv": "Jaja", "kalorije": 300, "proteini_g": 20}).json()
    client.post("/log/", json={"datum": d, "naziv": "Hleb", "kalorije": 200})
    client.post("/log/", json={"datum": "2026-11-05", "naziv": "Juče", "kalorije": 999})

    dan = client.get(f"/log/{d}").json()
    assert dan["ukupno_uneto"] == 500
    assert dan["ukupno_proteina"] == 20
    assert dan["preostalo"] == dan["dnevni_cilj_kalorija"] - 500

    client.delete(f"/log/{a['entry_id']}")
    assert client.get(f"/log/{d}").json()["ukupno_uneto"] == 200


def test_dnevnik_hrane_validacija(api):
    client, _ = api
    assert client.post("/log/", json={"datum": "2026-11-06", "naziv": "x", "kalorije": -50}).status_code == 422
    assert client.post("/log/", json={"datum": "2026-11-06", "naziv": "x", "kalorije": 100, "proteini_g": -1}).status_code == 422
    assert client.post("/log/", json={"datum": "danas", "naziv": "x", "kalorije": 100}).status_code == 422


# --- Kopija baze -----------------------------------------------------------

def test_kopija_preko_api(api, tmp_path):
    client, _ = api
    assert client.get("/backup/").json()["kopije"] == []
    k = client.post("/backup/").json()
    assert k["naziv"].startswith("reelfuel-")
    assert (tmp_path / "backups" / k["naziv"]).exists()  # pored TEST baze, ne prave
    assert len(client.get("/backup/").json()["kopije"]) == 1


# --- Nedeljni plan ---------------------------------------------------------

def test_nedelja_bez_profila(api):
    client, _ = api
    assert client.post("/nedelja/osvezi").json() == {"status": "nema_profila"}


def test_nedelja_azurno_kad_plan_postoji(api):
    client, Session = api
    client.post("/profile/", json=PROFIL)
    db = Session()
    db.add(MealPlan(plan_data=napravi_plan_data(week_start(date.today()).isoformat())))
    db.commit()
    db.close()
    assert client.post("/nedelja/osvezi").json() == {"status": "azurno"}
    assert client.get("/nedelja/status").json() == {"status": "azurno"}
