"""Katalog vežbi: učitavanje, pretraga, povezivanje (AI), prevod i rute /exercise/{id}/detalji|katalog."""
import pytest

from app.models.database import Exercise, VezbaPrevod
from app.services import vezbe_katalog as vk
from tests.conftest import LazniLLM

PREVOD = '{"naziv": "Trbušnjaci 3/4", "koraci": ["Lezi.", "Podigni trup.", "Spusti se."]}'


def napravi_vezbu(Session, naziv="Trbušnjaci", grupa="stomak", katalog_id=None) -> int:
    s = Session()
    e = Exercise(naziv_vezbe=naziv, grupa_misica=grupa, serije_i_ponavljanja="3x12",
                 source_url="rucno_dodato", katalog_id=katalog_id)
    s.add(e)
    s.commit()
    i = e.id
    s.close()
    return i


def test_katalog_se_ucitava():
    k = vk.katalog()
    assert len(k) == 876
    e = k["3_4_Sit-Up"]
    assert e["primaryMuscles"] == ["abdominals"] and e["instructions"]
    # svaki mišić iz kataloga ima srpski naziv
    svi = {m for e in k.values() for m in e["primaryMuscles"] + e["secondaryMuscles"]}
    assert svi <= set(vk.MISICI)


def test_tacno_poklapanje_ne_gleda_velika_slova_i_znakove():
    assert vk.tacno_poklapanje("3/4 sit-up") == "3_4_Sit-Up"
    assert vk.tacno_poklapanje("čučanj") is None


def test_pretraga_po_nazivu_i_misicu():
    po_nazivu = vk.pretrazi("bench press")
    assert po_nazivu and all("bench" in r["naziv_en"].lower() for r in po_nazivu)
    po_misicu = vk.pretrazi("listovi")
    assert po_misicu and all("listovi" in r["glavni_misici"] for r in po_misicu)
    assert vk.pretrazi("   ") == []
    assert po_nazivu[0]["slika"].startswith(vk.SLIKE_URL)


def test_povezivanje_tacan_naziv_bez_ai(monkeypatch):
    k = LazniLLM("{}")
    monkeypatch.setattr(vk, "client", k)
    assert vk.nadji_u_katalogu("3/4 Sit-Up") == "3_4_Sit-Up"
    assert vk.nadji_u_katalogu("") is None
    assert k.pozivi == []


def test_povezivanje_preko_ai(monkeypatch):
    k = LazniLLM('```json\n{"naziv": "3/4 Sit-Up"}\n```')
    monkeypatch.setattr(vk, "client", k)
    assert vk.nadji_u_katalogu("Trbušnjaci do pola", "stomak") == "3_4_Sit-Up"
    assert "Trbušnjaci do pola" in k.poruka() and "stomak" in k.poruka()
    sistem = k.pozivi[0]["system"][0]
    assert "3/4 Sit-Up" in sistem["text"] and sistem["cache_control"]  # lista ide u keširan deo


def test_povezivanje_preko_engleskog_naziva(monkeypatch):
    monkeypatch.setattr(vk, "client", LazniLLM('{"engleski": "Pushups", "naziv": "Push ups (izmisljeno)"}'))
    assert vk.nadji_u_katalogu("Sklekovi") == "Pushups"


@pytest.mark.parametrize("odgovor", ['{"naziv": null}', '{"engleski": "Burpee", "naziv": null}', '{"naziv": "Izmisljena vezba"}', '{"naziv": 5}'])
def test_povezivanje_bez_poklapanja(monkeypatch, odgovor):
    monkeypatch.setattr(vk, "client", LazniLLM(odgovor))
    assert vk.nadji_u_katalogu("Nešto čudno") is None


def test_prevod_se_pamti(db, monkeypatch):
    k = LazniLLM(PREVOD)
    monkeypatch.setattr(vk, "client", k)
    d = vk.detalji(db, "3_4_Sit-Up")
    assert d["naziv"] == "Trbušnjaci 3/4" and d["koraci"][0] == "Lezi." and d["prevedeno"]
    assert d["glavni_misici"] == ["trbušnjaci"] and d["nivo"] == "početni" and d["oprema"] == "bez opreme"
    assert len(d["slike"]) == 2
    vk.detalji(db, "3_4_Sit-Up")
    assert len(k.pozivi) == 1  # drugi put iz baze
    assert db.get(VezbaPrevod, "3_4_Sit-Up").naziv == "Trbušnjaci 3/4"


@pytest.mark.parametrize("odgovor", ["nije json", '{"naziv": "X", "koraci": []}', '{"koraci": ["a"]}'])
def test_neuspeo_prevod_vraca_engleski(db, monkeypatch, odgovor):
    monkeypatch.setattr(vk, "client", LazniLLM(odgovor))
    d = vk.detalji(db, "3_4_Sit-Up")
    assert d["naziv"] == "3/4 Sit-Up" and not d["prevedeno"]
    assert db.get(VezbaPrevod, "3_4_Sit-Up") is None  # pokušaće opet


def test_ruta_detalji_povezuje_jednom(api, monkeypatch):
    client, Session = api
    i = napravi_vezbu(Session)
    k = LazniLLM('{"naziv": "3/4 Sit-Up"}', PREVOD)
    monkeypatch.setattr(vk, "client", k)
    r = client.get(f"/exercise/{i}/detalji").json()
    assert r["exercise"]["naziv_vezbe"] == "Trbušnjaci"
    assert r["katalog"]["id"] == "3_4_Sit-Up" and r["katalog"]["naziv"] == "Trbušnjaci 3/4"
    assert not r["greska_povezivanja"]
    client.get(f"/exercise/{i}/detalji")
    assert len(k.pozivi) == 2  # povezivanje + prevod, pa ništa više
    assert client.get("/exercise/list").json()["exercises"][0]["katalog_id"] == "3_4_Sit-Up"


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


def test_ruta_detalji_nestala_vezba_iz_kataloga(api):
    client, Session = api
    i = napravi_vezbu(Session, katalog_id="Ne_postoji_vise")
    assert client.get(f"/exercise/{i}/detalji").json()["katalog"] is None
    assert client.get("/exercise/999/detalji").status_code == 404


def test_ruta_rucni_izbor(api, monkeypatch):
    client, Session = api
    i = napravi_vezbu(Session, katalog_id="")
    monkeypatch.setattr(vk, "client", LazniLLM(PREVOD))
    assert client.put(f"/exercise/{i}/katalog", json={"katalog_id": "Izmisljeno"}).status_code == 400
    r = client.put(f"/exercise/{i}/katalog", json={"katalog_id": "3_4_Sit-Up"}).json()
    assert r["katalog"]["id"] == "3_4_Sit-Up"
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
    k = LazniLLM('{"engleski": "Pushups", "naziv": "Pushups"}', PREVOD)
    monkeypatch.setattr(vk, "client", k)
    r = client.get("/exercise/katalog/po-nazivu", params={"naziv": "Sklekovi", "grupa": "grudi"}).json()
    assert r["katalog"]["id"] == "Pushups" and not r["greska_povezivanja"]
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
    r = client.put("/exercise/katalog/po-nazivu", json={"naziv": "Sklek", "katalog_id": "Pushups"}).json()
    assert r["katalog"]["id"] == "Pushups"
    assert client.put("/exercise/katalog/po-nazivu", json={"naziv": "Sklek", "katalog_id": None}).json()["katalog"] is None
    s = Session()
    s.add(VezbaNazivVeza(naziv="stara", katalog_id="Nestala_vezba"))
    s.commit()
    s.close()
    assert client.get("/exercise/katalog/po-nazivu", params={"naziv": "Stara"}).json()["katalog"] is None
