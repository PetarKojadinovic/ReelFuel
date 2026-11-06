"""Funkcijski testovi za obradu linka (POST /ingest/ ... save), bez interneta i bez AI-ja.

TestClient izvršava pozadinski posao odmah posle odgovora, pa je status posle POST-a konačan.
"""
import pytest

from app.models.database import Recipe
from app.services import ingest_pipeline as ip
from app.services.video_downloader import PreuzimanjeOdbijeno

URL = "https://www.instagram.com/reel/ABC123/?utm_source=ig_web_copy_link"
RECEPT = {"naziv_jela": "Palačinke", "sastojci": [{"naziv": "jaja", "kolicina": "2"}], "koraci": ["Umuti"], "priblizne_kalorije": "450", "proteini_g": 18}


@pytest.fixture
def lazno(monkeypatch):
    """Zameni internet/AI delove obrade. Vraća dict kojim test podešava ponašanje."""
    stanje = {"caption": "Palačinke: 2 jaja, mleko, brašno. Umuti i peci.", "tip": ("recept", True), "audio": True, "pozvano": []}

    def meta(url):
        stanje["pozvano"].append("meta")
        if stanje.get("predug"):
            raise PreuzimanjeOdbijeno("Video traje 900 s (dozvoljeno najvise 600 s)")
        return {"description": stanje["caption"], "duration": 30}

    def classify(caption, transcript=""):
        stanje["pozvano"].append("classify")
        return stanje["tip"]

    def audio(url):
        stanje["pozvano"].append("audio")
        if not stanje["audio"]:
            raise RuntimeError("unable to obtain file audio codec with ffprobe")
        return "nepostojeci.mp3"

    def recept(transcript, caption):
        stanje["pozvano"].append("recept")
        stanje["recept_ulaz"] = (transcript, caption)
        return dict(RECEPT)

    monkeypatch.setattr(ip, "fetch_metadata", meta)
    monkeypatch.setattr(ip, "_classify", classify)
    monkeypatch.setattr(ip, "download_audio", audio)
    monkeypatch.setattr(ip, "transcribe_audio", lambda path, **kw: stanje.get("transkript", ""))
    monkeypatch.setattr(ip, "extract_recipe", recept)
    return stanje


def test_zabranjen_domen_400(api, lazno):
    client, _ = api
    r = client.post("/ingest/", json={"url": "https://evil.example.com/reel/1"})
    assert r.status_code == 400
    assert lazno["pozvano"] == []  # ništa se ne skida


def test_recept_iz_opisa_pa_sacuvaj(api, lazno):
    client, Session = api
    job = client.post("/ingest/", json={"url": URL}).json()
    s = client.get(f"/ingest/{job['job_id']}").json()
    assert s["status"] == "gotovo" and s["tip"] == "recept"
    assert s["rezultat"]["naziv_jela"] == "Palačinke"
    assert "audio" not in lazno["pozvano"]  # opis je bio dovoljan -> bez Whispera

    assert [x["naziv"] for x in client.get("/ingest/").json()["stavke"]] == ["Palačinke"]
    sacuvano = client.post(f"/ingest/{job['job_id']}/save", json={}).json()
    assert sacuvano["tip"] == "recept"
    db = Session()
    r = db.get(Recipe, sacuvano["id"])
    assert r.naziv_jela == "Palačinke" and r.proteini_g == 18 and r.source_url == URL
    db.close()
    # Sačuvano više nije u "Spremno za pregled"; drugi save ne pravi duplikat
    assert client.get("/ingest/").json()["stavke"] == []
    assert client.post(f"/ingest/{job['job_id']}/save", json={}).json()["id"] == sacuvano["id"]


def test_isti_link_se_ne_obradjuje_ponovo(api, lazno):
    client, _ = api
    prvi = client.post("/ingest/", json={"url": URL}).json()
    lazno["pozvano"].clear()
    drugi = client.post("/ingest/", json={"url": URL.split("?")[0] + "/"}).json()
    assert drugi == {"job_id": prvi["job_id"], "status": "gotovo"}
    assert lazno["pozvano"] == []


def test_kratak_opis_koristi_govor(api, lazno):
    client, _ = api
    lazno.update(caption="Najbolji ručak!", tip=("recept", False), transkript="dva jaja i mleko")
    job = client.post("/ingest/", json={"url": URL}).json()
    assert client.get(f"/ingest/{job['job_id']}").json()["status"] == "gotovo"
    assert "audio" in lazno["pozvano"]
    assert lazno["recept_ulaz"] == ("dva jaja i mleko", "Najbolji ručak!")


def test_reel_bez_zvuka_koristi_opis(api, lazno):
    """Zvuk skinut zbog autorskih prava: skidanje audija padne, recept se pravi iz opisa."""
    client, _ = api
    lazno.update(tip=("recept", False), audio=False)
    job = client.post("/ingest/", json={"url": URL}).json()
    s = client.get(f"/ingest/{job['job_id']}").json()
    assert s["status"] == "gotovo"
    assert lazno["recept_ulaz"] == ("", lazno["caption"])


def test_bez_opisa_i_bez_zvuka_greska(api, lazno):
    client, _ = api
    lazno.update(caption="", tip=("recept", False), audio=False)
    job = client.post("/ingest/", json={"url": URL}).json()
    s = client.get(f"/ingest/{job['job_id']}").json()
    assert s["status"] == "greska"
    assert s["greska"] == "Obrada nije uspela. Proveri link ili probaj ponovo."  # bez internog teksta


def test_predug_video_jasna_poruka(api, lazno):
    client, _ = api
    lazno["predug"] = True
    job = client.post("/ingest/", json={"url": URL}).json()
    s = client.get(f"/ingest/{job['job_id']}").json()
    assert s["status"] == "greska" and "600" in s["greska"]


def test_nepoznat_tip_trazi_odluku(api, lazno):
    client, _ = api
    lazno.update(caption="lep dan", tip=("nepoznato", False))
    job = client.post("/ingest/", json={"url": URL}).json()
    assert client.get(f"/ingest/{job['job_id']}").json()["status"] == "potrebna_odluka"
    # Korisnik kaže "recept" -> nova obrada sa tim tipom
    lazno["tip"] = ("recept", True)
    job2 = client.post("/ingest/", json={"url": URL, "tip": "recept"}).json()
    assert client.get(f"/ingest/{job2['job_id']}").json()["status"] == "gotovo"


def test_odbaci(api, lazno):
    client, _ = api
    job = client.post("/ingest/", json={"url": URL}).json()
    assert client.post(f"/ingest/{job['job_id']}/odbaci").json() == {"ok": True}
    assert client.get("/ingest/").json()["stavke"] == []
    assert client.post("/ingest/nepostoji/odbaci").status_code == 404
    assert client.get("/ingest/nepostoji").status_code == 404
