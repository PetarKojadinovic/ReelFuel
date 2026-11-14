"""Katalog vežbi: učitavanje, pretraga, povezivanje (AI), prevod i rute /exercise/{id}/detalji|katalog."""
import re
from pathlib import Path

import pytest

from app.models.database import Exercise, VezbaPrevod
from app.services import vezbe_katalog as vk
from tests.conftest import LazniLLM

PREVOD = '{"naziv": "Trbušnjaci", "koraci": ["Lezi.", "Podigni trup.", "Spusti se."]}'


def napravi_vezbu(Session, naziv="Trbušnjaci", grupa="stomak", katalog_id=None) -> int:
    s = Session()
    e = Exercise(naziv_vezbe=naziv, grupa_misica=grupa, serije_i_ponavljanja="3x12",
                 source_url="rucno_dodato", katalog_id=katalog_id)
    s.add(e)
    s.commit()
    i = e.id
    s.close()
    return i


@pytest.fixture(autouse=True)
def test_katalog(monkeypatch):
    """Mali katalog iz tests/data (pravi katalog nije u gitu)."""
    monkeypatch.setattr(vk, "KATALOG_PUTANJA", Path(__file__).parent / "data" / "vezbe_katalog.json")
    vk.katalog.cache_clear()
    vk._po_nazivu.cache_clear()
    yield
    vk.katalog.cache_clear()
    vk._po_nazivu.cache_clear()


def test_katalog_se_ucitava():
    k = vk.katalog()
    e = k["2gPfomN"]
    assert e["name"] == "3/4 sit-up" and e["primaryMuscles"] == ["abdominals"] and e["instructions"]
    assert not any(re.match(r"step\s*:?\s*\d", t, re.I) for v in k.values() for t in v["instructions"])


def test_pravi_katalog_svi_misici_imaju_prevod():
    vk.katalog.cache_clear()
    vk.KATALOG_PUTANJA = Path(__file__).parents[1] / "data" / "vezbe_katalog.json"
    if not vk.KATALOG_PUTANJA.exists():
        pytest.skip("pravi katalog nije preuzet")
    k = vk.katalog()
    assert len(k) > 1000
    svi = {m for e in k.values() for m in e["primaryMuscles"] + e["secondaryMuscles"]}
    assert svi <= set(vk.MISICI)
    assert {o for e in k.values() for o in e["equipment"]} <= set(vk.OPREMA)
    assert {b for e in k.values() for b in e["bodyParts"]} <= set(vk.KATEGORIJA)


def test_nema_fajla_prazan_katalog(monkeypatch, tmp_path):
    monkeypatch.setattr(vk, "KATALOG_PUTANJA", tmp_path / "nema.json")
    vk.katalog.cache_clear()
    assert vk.katalog() == {} and vk.pretrazi("squat") == []


def test_tacno_poklapanje_ne_gleda_velika_slova_i_znakove():
    assert vk.tacno_poklapanje("3/4 SIT UP!") == "2gPfomN"
    assert vk.tacno_poklapanje("Pull-Up") == "lBDjFxJ"
    assert vk.tacno_poklapanje("čučanj") is None


def test_prevod_vezbe_bez_koraka(db, monkeypatch):
    monkeypatch.setattr(vk, "client", LazniLLM('{"naziv": "Nešto", "koraci": []}'))
    d = vk.detalji(db, "bezKoraka")
    assert d["prevedeno"] and d["koraci"] == []
    assert d["slike"] == [] and d["slika"] is None  # GIF sa nepoznatog hosta se ne šalje telefonu
    assert d["telo_glavni"] == []  # nazubljeni nema na crtežu


def test_pretraga_po_nazivu_i_misicu():
    po_nazivu = vk.pretrazi("push up")
    assert [r["naziv_en"] for r in po_nazivu] == ["push-up", "clock push-up"]
    po_misicu = vk.pretrazi("listovi")
    assert [r["naziv_en"] for r in po_misicu] == ["standing calves"]
    assert vk.pretrazi("grudi") and vk.pretrazi("pectorals") == vk.pretrazi("grudi")
    assert vk.pretrazi("   ") == []
    assert po_nazivu[0]["slika"].startswith(vk.GIF_HOST)


def test_povezivanje_tacan_naziv_bez_ai(monkeypatch):
    k = LazniLLM("{}")
    monkeypatch.setattr(vk, "client", k)
    assert vk.nadji_u_katalogu("3/4 sit-up") == "2gPfomN"
    assert vk.nadji_u_katalogu("") is None
    assert k.pozivi == []


def test_povezivanje_preko_ai(monkeypatch):
    k = LazniLLM('```json\n{"naziv": "3/4 sit-up"}\n```')
    monkeypatch.setattr(vk, "client", k)
    assert vk.nadji_u_katalogu("Trbušnjaci do pola", "stomak") == "2gPfomN"
    assert "Trbušnjaci do pola" in k.poruka() and "stomak" in k.poruka()
    sistem = k.pozivi[0]["system"][0]
    assert "3/4 sit-up" in sistem["text"] and sistem["cache_control"]  # lista ide u keširan deo


def test_povezivanje_preko_engleskog_naziva(monkeypatch):
    monkeypatch.setattr(vk, "client", LazniLLM('{"engleski": "pull-up", "naziv": "Push ups (izmisljeno)"}'))
    assert vk.nadji_u_katalogu("Zgibovi") == "lBDjFxJ"


@pytest.mark.parametrize("odgovor", ['{"naziv": null}', '{"engleski": "Dance", "naziv": null}', '{"naziv": "Izmisljena vezba"}', '{"naziv": 5}'])
def test_povezivanje_bez_poklapanja(monkeypatch, odgovor):
    monkeypatch.setattr(vk, "client", LazniLLM(odgovor))
    assert vk.nadji_u_katalogu("Nešto čudno") is None


def test_prevod_se_pamti(db, monkeypatch):
    k = LazniLLM(PREVOD)
    monkeypatch.setattr(vk, "client", k)
    d = vk.detalji(db, "2gPfomN")
    assert d["naziv"] == "Trbušnjaci" and d["koraci"][0] == "Lezi." and d["prevedeno"]
    assert d["glavni_misici"] == ["trbušnjaci"] and d["sporedni_misici"] == ["pregibači kuka", "donja leđa"]
    assert d["oprema"] == "bez opreme" and d["kategorija"] == "stomak" and d["nivo"] is None
    assert d["telo_glavni"] == ["abs"] and d["telo_sporedni"] == ["lower-back"]  # pregibači kuka nema na crtežu
    assert d["slike"] == ["https://static.exercisedb.dev/media/2gPfomN.gif"] and d["izvor"] == "ExerciseDB"
    vk.detalji(db, "2gPfomN")
    assert len(k.pozivi) == 1  # drugi put iz baze
    assert db.get(VezbaPrevod, "2gPfomN").naziv == "Trbušnjaci"


@pytest.mark.parametrize("odgovor", ["nije json", '{"naziv": "X", "koraci": []}', '{"koraci": ["a"]}'])
def test_neuspeo_prevod_vraca_engleski(db, monkeypatch, odgovor):
    monkeypatch.setattr(vk, "client", LazniLLM(odgovor))
    d = vk.detalji(db, "2gPfomN")
    assert d["naziv"] == "3/4 sit-up" and not d["prevedeno"]
    assert db.get(VezbaPrevod, "2gPfomN") is None  # pokušaće opet


def test_ruta_detalji_povezuje_jednom(api, monkeypatch):
    client, Session = api
    i = napravi_vezbu(Session)
    k = LazniLLM('{"naziv": "3/4 sit-up"}', PREVOD)
    monkeypatch.setattr(vk, "client", k)
    r = client.get(f"/exercise/{i}/detalji").json()
    assert r["exercise"]["naziv_vezbe"] == "Trbušnjaci"
    assert r["katalog"]["id"] == "2gPfomN" and r["katalog"]["naziv"] == "Trbušnjaci"
    assert not r["greska_povezivanja"]
    client.get(f"/exercise/{i}/detalji")
    assert len(k.pozivi) == 2  # povezivanje + prevod, pa ništa više
    assert client.get("/exercise/list").json()["exercises"][0]["katalog_id"] == "2gPfomN"


def test_ruta_detalji_nema_u_katalogu_se_pamti(api, monkeypatch):
    client, Session = api
    i = napravi_vezbu(Session, naziv="Ples")
    k = LazniLLM('{"naziv": null}')
    monkeypatch.setattr(vk, "client", k)
    assert client.get(f"/exercise/{i}/detalji").json()["katalog"] is None
    client.get(f"/exercise/{i}/detalji")
    assert len(k.pozivi) == 1
    assert client.get("/exercise/list").json()["exercises"][0]["katalog_id"] is None


def test_ruta_detalji_greska_ai_se_ne_pamti(api, monkeypatch):
    client, Session = api
    i = napravi_vezbu(Session)

    def puca(**kw):
        raise RuntimeError("nema interneta")

    k = LazniLLM("{}")
    k.messages.create = puca
    monkeypatch.setattr(vk, "client", k)
    r = client.get(f"/exercise/{i}/detalji").json()
    assert r["katalog"] is None and r["greska_povezivanja"]
    s = Session()
    assert s.get(Exercise, i).katalog_id is None
    s.close()


def test_ruta_detalji_vezba_iz_starog_kataloga_se_ponovo_povezuje(api, monkeypatch):
    client, Session = api
    i = napravi_vezbu(Session, katalog_id="Ne_postoji_vise")
    monkeypatch.setattr(vk, "client", LazniLLM('{"naziv": "3/4 sit-up"}', PREVOD))
    assert client.get(f"/exercise/{i}/detalji").json()["katalog"]["id"] == "2gPfomN"
    assert client.get("/exercise/999/detalji").status_code == 404


def test_ruta_rucni_izbor(api, monkeypatch):
    client, Session = api
    i = napravi_vezbu(Session, katalog_id="")
    monkeypatch.setattr(vk, "client", LazniLLM(PREVOD))
    assert client.put(f"/exercise/{i}/katalog", json={"katalog_id": "Izmisljeno"}).status_code == 400
    r = client.put(f"/exercise/{i}/katalog", json={"katalog_id": "2gPfomN"}).json()
    assert r["katalog"]["id"] == "2gPfomN"
    r = client.put(f"/exercise/{i}/katalog", json={"katalog_id": None}).json()
    assert r["katalog"] is None
    assert client.put("/exercise/999/katalog", json={"katalog_id": None}).status_code == 404


def test_ruta_pretraga(api):
    client, _ = api
    r = client.get("/exercise/katalog", params={"q": "squat"}).json()["rezultati"]
    assert 0 < len(r) <= 20
    assert client.get("/exercise/katalog", params={"q": "x" * 101}).status_code == 422


# --- Vežbe iz plana treninga (samo naziv) ------------------------------------

def test_po_nazivu_pamti_vezu(api, monkeypatch):
    client, _ = api
    k = LazniLLM('{"engleski": "pull-up", "naziv": "pull-up"}', PREVOD)
    monkeypatch.setattr(vk, "client", k)
    r = client.get("/exercise/katalog/po-nazivu", params={"naziv": "Sklekovi", "grupa": "grudi"}).json()
    assert r["katalog"]["id"] == "lBDjFxJ" and not r["greska_povezivanja"]
    # isti naziv (druga velika slova/razmaci) iz sledećeg plana -> bez novog poziva AI-ja
    client.get("/exercise/katalog/po-nazivu", params={"naziv": "  sklekovi "})
    assert len(k.pozivi) == 2  # povezivanje + prevod


def test_po_nazivu_nema_i_greska(api, monkeypatch):
    client, Session = api
    from app.models.database import VezbaNazivVeza

    monkeypatch.setattr(vk, "client", LazniLLM('{"naziv": null}'))
    assert client.get("/exercise/katalog/po-nazivu", params={"naziv": "Ples"}).json()["katalog"] is None

    def puca(**kw):
        raise RuntimeError("nema interneta")

    k = LazniLLM("{}")
    k.messages.create = puca
    monkeypatch.setattr(vk, "client", k)
    r = client.get("/exercise/katalog/po-nazivu", params={"naziv": "Zgibovi"}).json()
    assert r["katalog"] is None and r["greska_povezivanja"]
    s = Session()
    assert s.get(VezbaNazivVeza, "zgibovi") is None  # greška se ne pamti
    assert s.get(VezbaNazivVeza, "ples").katalog_id == ""
    s.close()
    assert client.get("/exercise/katalog/po-nazivu", params={"naziv": ""}).status_code == 422


def test_po_nazivu_rucni_izbor(api, monkeypatch):
    client, Session = api
    from app.models.database import VezbaNazivVeza

    monkeypatch.setattr(vk, "client", LazniLLM(PREVOD))
    assert client.put("/exercise/katalog/po-nazivu", json={"naziv": "Sklek", "katalog_id": "X"}).status_code == 400
    r = client.put("/exercise/katalog/po-nazivu", json={"naziv": "Sklek", "katalog_id": "lBDjFxJ"}).json()
    assert r["katalog"]["id"] == "lBDjFxJ"
    assert client.put("/exercise/katalog/po-nazivu", json={"naziv": "Sklek", "katalog_id": None}).json()["katalog"] is None
    s = Session()
    s.add(VezbaNazivVeza(naziv="stara", katalog_id="Nestala_vezba"))
    s.commit()
    s.close()
    monkeypatch.setattr(vk, "client", LazniLLM('{"naziv": "3/4 sit-up"}', PREVOD))
    assert client.get("/exercise/katalog/po-nazivu", params={"naziv": "Stara"}).json()["katalog"]["id"] == "2gPfomN"
