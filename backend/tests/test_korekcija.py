"""Predlog korekcije kalorijskog cilja (preko HTTP-a /korekcija)."""
from datetime import date, timedelta

from app.models.database import KalorijskaKorekcija, WeightLog
from tests.conftest import PROFIL


def _tezine(Session, kg_po_danu: list[float]):
    db = Session()
    start = date.today() - timedelta(days=len(kg_po_danu) - 1)
    for i, kg in enumerate(kg_po_danu):
        db.add(WeightLog(datum=(start + timedelta(days=i)).isoformat(), tezina_kg=kg))
    db.commit()
    db.close()


def test_bez_profila_nema_predloga(api):
    client, _ = api
    assert client.get("/korekcija/").json() == {"predlog": None, "korekcija": 0}


def test_premalo_merenja_nema_predloga(api):
    client, Session = api
    client.post("/profile/", json={**PROFIL, "cilj": "odrzavanje"})
    _tezine(Session, [85, 84])
    assert client.get("/korekcija/").json()["predlog"] is None


def test_prebrzo_mrsavljenje_na_odrzavanju_predlaze_vise(api):
    client, Session = api
    pocetni = client.post("/profile/", json={**PROFIL, "cilj": "odrzavanje"}).json()["dnevni_cilj_kalorija"]
    _tezine(Session, [86 - i * 0.15 for i in range(10)])  # ~1 kg nedeljno dole
    k = client.get("/korekcija/").json()
    assert k["predlog"]["delta"] == 100
    assert k["predlog"]["dnevni_cilj_posle"] == pocetni + 100

    # Prihvati -> cilj na profilu je veći za 100
    k = client.post(f"/korekcija/{k['predlog']['id']}/odgovor", json={"prihvati": True}).json()
    assert k["korekcija"] == 100
    assert client.get("/profile/").json()["dnevni_cilj_kalorija"] == pocetni + 100

    # Novi predlog najranije za 7 dana; "Vrati originalni" vraća cilj
    assert client.get("/korekcija/").json()["predlog"] is None
    assert client.post("/korekcija/reset").json()["korekcija"] == 0
    assert client.get("/profile/").json()["dnevni_cilj_kalorija"] == pocetni


def test_odbijen_predlog_ne_menja_cilj(api):
    client, Session = api
    pocetni = client.post("/profile/", json={**PROFIL, "cilj": "odrzavanje"}).json()["dnevni_cilj_kalorija"]
    _tezine(Session, [86 - i * 0.15 for i in range(10)])
    pid = client.get("/korekcija/").json()["predlog"]["id"]
    assert client.post(f"/korekcija/{pid}/odgovor", json={"prihvati": False}).json()["korekcija"] == 0
    assert client.get("/profile/").json()["dnevni_cilj_kalorija"] == pocetni


def test_ne_predlaze_manje_ispod_minimuma(api):
    """Mršavljenje stoji, ali cilj je već na minimumu za pol -> nema predloga za smanjenje."""
    client, Session = api
    client.post("/profile/", json={**PROFIL, "tezina_kg": 50, "visina_cm": 160, "pol": "zenski", "nivo_aktivnosti": "nizak", "godine": 60, "ciljna_tezina_kg": 45})
    _tezine(Session, [50.0] * 10)
    k = client.get("/korekcija/").json()
    assert k["predlog"] is None
    db = Session()
    assert db.query(KalorijskaKorekcija).count() == 0
    db.close()
