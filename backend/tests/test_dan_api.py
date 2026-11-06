"""Rute /dan (dan iz plana, akcije, slika, opis, glas) i preostali delovi obrade linka."""
import os

import pytest

from app.models.database import MealPlan
from app.services import glas_obrok, ingest_pipeline as ip
from tests.conftest import PROFIL, LazniLLM, napravi_plan_data
from app.services.daily_nutrition import week_start
from datetime import date

DANAS = date.today().isoformat()


@pytest.fixture
def sa_planom(api):
    client, Session = api
    client.post("/profile/", json=PROFIL)
    db = Session()
    db.add(MealPlan(plan_data=napravi_plan_data(week_start(date.today()).isoformat(), kcal=500)))
    db.commit()
    db.close()
    return client


# --- Dan i akcije ----------------------------------------------------------

def test_dan_lose_vreme_i_datum(sa_planom):
    c = sa_planom
    assert c.get("/dan/2026-13-40").status_code == 400
    assert c.get(f"/dan/{DANAS}?sada=25:00").status_code == 400
    assert c.get(f"/dan/{DANAS}?dorucak=abc").status_code == 400
    assert c.get(f"/dan/{DANAS}?sada=7:5&dorucak=07:00&rucak=12:30&vecera=19:00").status_code == 200


def test_pojeo_preskocio_zamena(sa_planom):
    c = sa_planom
    assert c.post(f"/dan/{DANAS}/dorucak", json={"akcija": "pojeo"}).status_code == 200
    assert c.post(f"/dan/{DANAS}/rucak", json={"akcija": "preskocio"}).status_code == 200
    assert c.post(f"/dan/{DANAS}/vecera", json={"akcija": "zamena", "naziv": "Pica", "kalorije": 900, "proteini_g": 35}).status_code == 200
    dan = c.get(f"/dan/{DANAS}?sada=23:59").json()
    stanja = {o["obrok_tip"]: o["status"] for o in dan["obroci"]}
    assert stanja == {"dorucak": "pojeo", "rucak": "preskoceno", "vecera": "zamenjeno"}
    assert dan["ukupno"] == 500 + 900


def test_zamena_trazi_naziv_i_kalorije(sa_planom):
    c = sa_planom
    assert c.post(f"/dan/{DANAS}/rucak", json={"akcija": "zamena", "naziv": " "}).status_code == 400
    assert c.post(f"/dan/{DANAS}/rucak", json={"akcija": "zamena", "naziv": "X", "kalorije": 9000}).status_code == 400
    assert c.post(f"/dan/{DANAS}/uzina", json={"akcija": "pojeo"}).status_code == 422


def test_pojeo_bez_plana(api):
    client, _ = api
    assert client.post(f"/dan/{DANAS}/rucak", json={"akcija": "pojeo"}).status_code == 400


# --- Slika, opis, glas -----------------------------------------------------

def test_slika_obroka_ruta(api, monkeypatch):
    client, _ = api
    monkeypatch.setattr("app.api.routes.dan.analyze_meal_photo", lambda b, m: {"naziv": "Pica", "kalorije": 800})
    assert client.post("/dan/analiza-slike", json={"slika_base64": "AAAA"}).json()["naziv"] == "Pica"
    assert client.post("/dan/analiza-slike", json={"slika_base64": "A" * 8_000_001}).status_code == 413
    monkeypatch.setattr("app.api.routes.dan.analyze_meal_photo", lambda b, m: (_ for _ in ()).throw(ValueError("tajna")))
    r = client.post("/dan/analiza-slike", json={"slika_base64": "AAAA"})
    assert r.status_code == 500 and "tajna" not in r.text


def test_opis_ruta_greska(api, monkeypatch):
    client, _ = api
    monkeypatch.setattr("app.api.routes.dan.proceni_opis", lambda t: (_ for _ in ()).throw(ValueError("tajna")))
    r = client.post("/dan/opis", json={"tekst": "dva jaja"})
    assert r.status_code == 500 and "tajna" not in r.text
    assert client.post("/dan/opis", json={"tekst": ""}).status_code == 422


def test_glas_ruta(api, monkeypatch):
    client, _ = api
    primljeno = {}

    def proceni(sadrzaj, ext):
        primljeno.update(sadrzaj=sadrzaj, ext=ext)
        return {"tekst": "dva jaja", "naziv": "Jaja", "kalorije": 150}

    monkeypatch.setattr("app.api.routes.dan.proceni_snimak", proceni)
    r = client.post("/dan/glas", files={"snimak": ("snimak.M4A", b"audio", "audio/mp4")})
    assert r.json()["naziv"] == "Jaja" and primljeno == {"sadrzaj": b"audio", "ext": ".m4a"}
    assert client.post("/dan/glas", files={"snimak": ("x.exe", b"MZ", "application/octet-stream")}).status_code == 400
    assert client.post("/dan/glas", files={"snimak": ("x.m4a", b"", "audio/mp4")}).status_code == 400
    assert client.post("/dan/glas", files={"snimak": ("x.m4a", b"0" * (5 * 1024 * 1024 + 1), "audio/mp4")}).status_code == 413
    monkeypatch.setattr("app.api.routes.dan.proceni_snimak", lambda s, e: (_ for _ in ()).throw(RuntimeError("tajna")))
    r = client.post("/dan/glas", files={"snimak": ("x.m4a", b"audio", "audio/mp4")})
    assert r.status_code == 500 and "tajna" not in r.text


def test_snimak_se_brise_posle_prepoznavanja(monkeypatch):
    putanje = []

    def whisper(path, initial_prompt=None):
        putanje.append(path)
        assert os.path.exists(path) and initial_prompt
        return "pojeo sam jabuku"

    monkeypatch.setattr("app.services.transcription.transcribe_audio", whisper)
    monkeypatch.setattr(glas_obrok, "client", LazniLLM('{"naziv_obroka": "Jabuka", "stavke": [{"naziv": "jabuka", "kalorije": 80, "proteini_g": 0.3}]}'))
    r = glas_obrok.proceni_snimak(b"audio", ".m4a")
    assert r["naziv"] == "Jabuka" and r["kalorije"] == 80
    assert not os.path.exists(putanje[0])


def test_snimak_se_brise_i_kad_whisper_padne(monkeypatch):
    putanje = []

    def whisper(path, initial_prompt=None):
        putanje.append(path)
        raise RuntimeError("whisper")

    monkeypatch.setattr("app.services.transcription.transcribe_audio", whisper)
    with pytest.raises(RuntimeError):
        glas_obrok.proceni_snimak(b"audio", ".m4a")
    assert not os.path.exists(putanje[0])


# --- Obrada linka: klasifikacija i vežba -----------------------------------

def test_klasifikacija(monkeypatch):
    k = LazniLLM('```json\n{"tip": "vezba", "dovoljno_podataka": false}\n```')
    monkeypatch.setattr(ip, "client", k)
    assert ip._classify("3x10 čučnjeva", "radimo noge") == ("vezba", False)
    assert "Transkript: radimo noge" in k.poruka()
    monkeypatch.setattr(ip, "client", LazniLLM('{"tip": "pesma", "dovoljno_podataka": true}'))
    assert ip._classify("x") == ("nepoznato", True)  # nepoznat tip -> "nepoznato"
    assert ip._classify("", "") == ("nepoznato", False)  # bez teksta AI se ne zove


def test_vezba_iz_linka(api, monkeypatch, tmp_path):
    client, _ = api
    video = tmp_path / "v.mp4"

    def download_video(url):
        video.write_bytes(b"x")
        return str(video)

    monkeypatch.setattr(ip, "fetch_metadata", lambda u: {"description": "3x10 čučnjeva", "duration": 20})
    monkeypatch.setattr(ip, "_classify", lambda c, t="": ("vezba", False))
    monkeypatch.setattr(ip, "download_video", download_video)
    monkeypatch.setattr(ip, "transcribe_audio", lambda p, **kw: (_ for _ in ()).throw(RuntimeError("nema zvuka")))
    monkeypatch.setattr(ip, "analyze_video", lambda p, sample_every_n_frames: {"detektovano_ponavljanja": 10})
    monkeypatch.setattr(ip, "extract_exercise", lambda t, pose, caption: {"naziv_vezbe": "Čučanj", "grupa_misica": "noge", "serije_i_ponavljanja": "3x10"})

    job = client.post("/ingest/", json={"url": "https://www.tiktok.com/@trener/video/9"}).json()
    s = client.get(f"/ingest/{job['job_id']}").json()
    assert s["status"] == "gotovo" and s["tip"] == "vezba"
    assert s["rezultat"]["detektovano_ponavljanja"] == 10
    assert not video.exists()  # video obrisan posle obrade
    sacuvano = client.post(f"/ingest/{job['job_id']}/save", json={}).json()
    assert sacuvano["tip"] == "vezba"
    assert client.get("/exercise/list").json()["exercises"][0]["naziv_vezbe"] == "Čučanj"
