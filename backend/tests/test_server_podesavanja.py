"""Podešavanja za server: granica skupih zahteva, /docs i CORS iz .env."""
import pytest

from app.core import rate_limit
from app.core.rate_limit import Ogranicenje, grupa_za


@pytest.mark.parametrize(
    "metoda, putanja, upit, grupa",
    [
        ("POST", "/ingest/", "", "obrada"),
        ("POST", "/recipe/", "", "obrada"),
        ("POST", "/exercise", "", "obrada"),
        ("POST", "/chat/", "", "ai"),
        ("POST", "/dan/glas", "", "ai"),
        ("POST", "/dan/opis", "", "ai"),
        ("POST", "/dan/analiza-slike", "", "ai"),
        ("POST", "/mealplan/generate", "", "ai"),
        ("POST", "/shoppinglist/generate-from-recipe", "", "ai"),
        ("POST", "/proizvod/3017620422003/etiketa", "", "ai"),
        ("GET", "/exercise/5/detalji", "", "ai"),
        ("GET", "/exercise/katalog/po-nazivu", "naziv=Plank", "ai"),
        ("POST", "/nedelja/osvezi", "force=true", "ai"),
        # Nisu skupi
        ("POST", "/nedelja/osvezi", "", None),
        ("POST", "/ingest/abc/save", "", None),
        ("GET", "/ingest/", "", None),
        ("POST", "/dan/2026-11-14/rucak", "", None),
        ("GET", "/exercise/list", "", None),
        ("GET", "/exercise/katalog", "q=squat", None),
        ("GET", "/chat/history", "", None),
        ("POST", "/recipe/manual", "", None),
    ],
)
def test_grupa_za(metoda, putanja, upit, grupa):
    assert grupa_za(metoda, putanja, upit) == grupa


def test_klizni_prozor():
    o = Ogranicenje()
    assert o.pokusaj("ai", 2, prozor=100, sada=0) is None
    assert o.pokusaj("ai", 2, prozor=100, sada=10) is None
    assert o.pokusaj("ai", 2, prozor=100, sada=20) == 80  # prvi izlazi iz prozora u t=100
    assert o.pokusaj("obrada", 2, prozor=100, sada=20) is None  # druga grupa se broji posebno
    assert o.pokusaj("ai", 2, prozor=100, sada=100) is None
    assert o.pokusaj("ai", 0, sada=0) is None  # 0 = bez granice


def test_api_vraca_429_posle_granice(api, monkeypatch):
    api, _ = api
    monkeypatch.setitem(rate_limit.LIMITI, "ai", 2)
    for _ in range(2):
        assert api.post("/dan/opis", json={"tekst": ""}).status_code != 429
    r = api.post("/dan/opis", json={"tekst": ""})
    assert r.status_code == 429
    assert "Pokušaj ponovo za" in r.json()["detail"]
    assert int(r.headers["Retry-After"]) > 0
    # Obične rute rade i dalje
    assert api.get("/profile/").status_code == 200


def test_bez_kljuca_se_ne_broji(api, monkeypatch):
    api, _ = api
    monkeypatch.setitem(rate_limit.LIMITI, "ai", 1)
    for _ in range(3):
        assert api.post("/dan/opis", json={"tekst": "x"}, headers={"X-API-Key": "pogresan"}).status_code == 401
    assert api.post("/dan/opis", json={"tekst": ""}).status_code != 429


@pytest.mark.parametrize("vrednost, ukljucen", [(None, True), ("1", True), ("0", False), ("false", False), (" NE ", False)])
def test_docs_iz_env(monkeypatch, vrednost, ukljucen):
    from app.main import docs_ukljucen

    if vrednost is None:
        monkeypatch.delenv("DOCS", raising=False)
    else:
        monkeypatch.setenv("DOCS", vrednost)
    assert docs_ukljucen() is ukljucen


def test_cors_iz_env(monkeypatch):
    from app.main import cors_adrese

    monkeypatch.delenv("CORS_ORIGINS", raising=False)
    assert cors_adrese() == ["*"]
    monkeypatch.setenv("CORS_ORIGINS", "")
    assert cors_adrese() == []
    monkeypatch.setenv("CORS_ORIGINS", "http://localhost:8081, https://a.b")
    assert cors_adrese() == ["http://localhost:8081", "https://a.b"]
