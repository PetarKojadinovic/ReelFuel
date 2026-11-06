"""Bar-kod, nedeljni izveštaj, analiza pokreta, Whisper, skidanje videa, nedeljno osvežavanje."""
from datetime import date, timedelta
from types import SimpleNamespace

import httpx
import numpy as np
import pytest

from app.models.database import FoodLogEntry, MealPlan, Proizvod, WeightLog, WorkoutLogEntry
from app.services import nedelja_plan, pose_analysis, proizvod_service as ps, transcription, video_downloader as vd
from tests.conftest import PROFIL, LazniLLM

# --- Bar-kod: Open Food Facts ----------------------------------------------


def _off(monkeypatch, status=200, data=None, greska=False):
    pozivi = []

    def get(url, **kw):
        pozivi.append(url)
        if greska:
            raise httpx.ConnectError("nema mreze")
        return SimpleNamespace(status_code=status, json=lambda: data)

    monkeypatch.setattr(ps.httpx, "get", get)
    return pozivi


def _proizvod(**n):
    return {"status": 1, "product": {"product_name": "Čokolada", "brands": "Milka,Mondelez",
                                     "nutriments": n, "serving_quantity": "25", "product_quantity": 100}}


def test_off_kcal_brend_i_porcija(monkeypatch):
    _off(monkeypatch, data=_proizvod(**{"energy-kcal_100g": 530, "proteins_100g": 6.3}))
    r = ps._iz_open_food_facts("3045140105502")
    assert r == {"naziv": "Milka Čokolada", "kcal_100g": 530.0, "proteini_100g": 6.3, "porcija_g": 25.0, "paket_g": 100.0}


def test_off_preracunava_kj(monkeypatch):
    _off(monkeypatch, data=_proizvod(**{"energy-kj_100g": 418.4, "proteins_100g": 0}))
    r = ps._iz_open_food_facts("5449000000996")
    assert round(r["kcal_100g"]) == 100
    assert r["proteini_100g"] == 0  # 0 g proteina je validno (npr. sok)


def test_off_dugacak_brend_se_ne_dodaje(monkeypatch):
    d = _proizvod(**{"energy-kcal_100g": 50})
    d["product"]["brands"] = "Neka Velika Firma Services SA/NV"
    _off(monkeypatch, data=d)
    assert ps._iz_open_food_facts("12345678")["naziv"] == "Čokolada"


@pytest.mark.parametrize("kw", [
    {"status": 404, "data": None},
    {"data": {"status": 0}},
    {"data": _proizvod(proteins_100g=5)},  # bez kalorija
    {"greska": True},
])
def test_off_nema_podatka(monkeypatch, kw):
    _off(monkeypatch, **kw)
    assert ps._iz_open_food_facts("12345678") is None


def test_barkod_kes_i_ruta(api, monkeypatch):
    client, _ = api
    pozivi = _off(monkeypatch, data=_proizvod(**{"energy-kcal_100g": 530}))
    assert client.get("/proizvod/3045140105502").json()["kcal_100g"] == 530
    assert client.get("/proizvod/3045140105502").json()["izvor"] == "openfoodfacts"
    assert len(pozivi) == 1  # drugi put iz keša
    assert pozivi[0].startswith("https://world.openfoodfacts.org/")  # fiksna adresa
    assert client.get("/proizvod/abc").status_code == 400
    assert client.get("/proizvod/123").status_code == 400
    _off(monkeypatch, status=404)
    assert client.get("/proizvod/99999999").json() == {"pronadjen": False, "barkod": "99999999"}


def test_etiketa(api, monkeypatch):
    client, Session = api
    k = LazniLLM('{"naziv": "Keks", "kcal_100g": 480, "proteini_100g": 7, "porcija_g": 30, "paket_g": null}')
    monkeypatch.setattr(ps, "client", k)
    r = client.post("/proizvod/12345678/etiketa", json={"slika_base64": "AAAA", "naziv": " Moj keks "}).json()
    assert r["naziv"] == "Moj keks" and r["kcal_100g"] == 480 and r["izvor"] == "etiketa"
    db = Session()
    assert db.get(Proizvod, "12345678").porcija_g == 30
    db.close()


def test_etiketa_nemoguce_kalorije(api, monkeypatch):
    client, Session = api
    monkeypatch.setattr(ps, "client", LazniLLM('{"kcal_100g": 2000}'))
    r = client.post("/proizvod/12345678/etiketa", json={"slika_base64": "AAAA"}).json()
    assert r["procitano"] is False
    db = Session()
    assert db.get(Proizvod, "12345678") is None
    db.close()


def test_etiketa_ogranicenja(api, monkeypatch):
    client, _ = api
    assert client.post("/proizvod/12345678/etiketa", json={"slika_base64": "A" * 8_000_001}).status_code == 413
    assert client.post("/proizvod/12345678/etiketa", json={"slika_base64": "A", "media_type": "image/gif"}).status_code == 422
    monkeypatch.setattr(ps, "client", LazniLLM("nije json"))
    r = client.post("/proizvod/12345678/etiketa", json={"slika_base64": "AAAA"})
    assert r.status_code == 500 and "json" not in r.text.lower()


# --- Nedeljni izveštaj -----------------------------------------------------


def test_izvestaj_bez_profila(api):
    client, _ = api
    assert client.get("/report/weekly").json() == {"exists": False}


def test_izvestaj_nedelje(api):
    client, Session = api
    client.post("/profile/", json={**PROFIL, "broj_treninga_nedeljno": 3})
    cilj = client.get("/profile/").json()["dnevni_cilj_kalorija"]
    danas = date.today()
    d = lambda n: (danas - timedelta(days=n)).isoformat()  # noqa: E731
    db = Session()
    db.add_all([
        FoodLogEntry(datum=d(1), naziv="pogodak", kalorije=cilj - 100, izvor="slobodan"),
        FoodLogEntry(datum=d(2), naziv="previše", kalorije=cilj + 500, izvor="slobodan"),
        FoodLogEntry(datum=d(10), naziv="van perioda", kalorije=cilj, izvor="slobodan"),
        WorkoutLogEntry(datum=d(1), naziv_vezbe="Zgib", izvor="plan"),
        WorkoutLogEntry(datum=d(1), naziv_vezbe="Sklek", izvor="plan"),
        WorkoutLogEntry(datum=d(3), naziv_vezbe="Zgib", izvor="plan"),
        WeightLog(datum=d(6), tezina_kg=86.0),
    ])
    db.commit()
    db.close()

    r = client.get("/report/weekly").json()
    assert r["period"] == {"od": d(6), "do": d(0)}
    assert r["ishrana"]["dani_sa_unosom"] == 2
    assert r["ishrana"]["dani_pogodjen_cilj"] == 1
    assert r["trening"] == {"odradjeno_dana": 2, "planirano_dana": 3}
    assert r["tezina"]["pocetna"] == 86.0 and r["tezina"]["trenutna"] == 85.0  # 85 iz profila danas
    assert r["tezina"]["promena_kg"] == -1.0 and r["tezina"]["ciljna"] == 78


# --- Analiza pokreta -------------------------------------------------------


def _sinus(ponavljanja, tacaka=120, amplituda=0.1, sum=0.0, seed=1):
    t = np.linspace(0, ponavljanja * 2 * np.pi, tacaka)
    rng = np.random.default_rng(seed)
    return 0.5 + amplituda * np.sin(t) + rng.normal(0, sum, tacaka)


@pytest.mark.parametrize("n", [1, 5, 12])
def test_broji_ponavljanja(n):
    assert pose_analysis.count_repetitions(_sinus(n)) == n


def test_sum_nije_ponavljanje():
    assert pose_analysis.count_repetitions(_sinus(0, sum=0.003)) == 0
    assert pose_analysis.count_repetitions(_sinus(6, sum=0.005)) == 6


class _LazniVideo:
    def __init__(self, frejmova):
        self.n, self.i = frejmova, 0

    def get(self, prop):
        return 30

    def isOpened(self):  # noqa: N802 - ime iz cv2
        return True

    def read(self):
        self.i += 1
        return (self.i <= self.n), np.zeros((2, 2, 3), dtype=np.uint8)

    def release(self):
        pass


def _lazni_mediapipe(monkeypatch, kukovi, frejmova):
    vrednosti = iter(kukovi)

    class Landmarker:
        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def detect_for_video(self, img, ts):
            y = next(vrednosti, None)
            if y is None:
                return SimpleNamespace(pose_landmarks=[])
            tacka = SimpleNamespace(y=y)
            return SimpleNamespace(pose_landmarks=[[tacka] * 33])

    monkeypatch.setattr(pose_analysis.vision.PoseLandmarker, "create_from_options", staticmethod(lambda o: Landmarker()))
    monkeypatch.setattr(pose_analysis.cv2, "VideoCapture", lambda p: _LazniVideo(frejmova))
    monkeypatch.setattr(pose_analysis.cv2, "cvtColor", lambda f, c: f)
    monkeypatch.setattr(pose_analysis.mp, "Image", lambda **kw: None)
    monkeypatch.setattr(pose_analysis.mp_tasks, "BaseOptions", lambda **kw: None)
    monkeypatch.setattr(pose_analysis.vision, "PoseLandmarkerOptions", lambda **kw: None)


def test_analiza_videa_broji_ponavljanja(monkeypatch):
    _lazni_mediapipe(monkeypatch, list(_sinus(4, tacaka=80)), frejmova=80)
    r = pose_analysis.analyze_video("x.mp4", sample_every_n_frames=1)
    assert r["detektovano_ponavljanja"] == 4


def test_analiza_videa_bez_osobe(monkeypatch):
    _lazni_mediapipe(monkeypatch, [0.5] * 5, frejmova=60)  # osoba vidljiva u samo 5 frejmova
    r = pose_analysis.analyze_video("x.mp4", sample_every_n_frames=3)
    assert r["detektovano_ponavljanja"] is None and "Nedovoljno" in r["napomena"]


# --- Whisper ---------------------------------------------------------------


def _model(rezultat):
    pozivi = []

    def transcribe(path, **kw):
        pozivi.append(kw)
        return rezultat

    return SimpleNamespace(transcribe=transcribe), pozivi


def test_whisper_izbacuje_lose_segmente(monkeypatch):
    m, pozivi = _model({"segments": [
        {"text": " Dva jaja ", "no_speech_prob": 0.1, "avg_logprob": -0.3, "compression_ratio": 1.4},
        {"text": "...", "no_speech_prob": 0.4, "avg_logprob": -3.0, "compression_ratio": 0.3},
        {"text": " i mleko", "no_speech_prob": 0.0, "avg_logprob": -0.2, "compression_ratio": 1.2},
    ]})
    monkeypatch.setattr(transcription, "get_model", lambda: m)
    assert transcription.transcribe_audio("a.mp3", initial_prompt="hrana") == "Dva jaja i mleko"
    assert pozivi[0]["language"] == "sr" and pozivi[0]["condition_on_previous_text"] is False
    assert pozivi[0]["initial_prompt"] == "hrana"


def test_whisper_bez_segmenata(monkeypatch):
    monkeypatch.setattr(transcription, "get_model", lambda: _model({"text": "  zdravo ", "segments": []})[0])
    assert transcription.transcribe_audio("a.mp3") == "zdravo"


# --- Skidanje videa --------------------------------------------------------


def test_filter_trajanja_i_uzivo():
    assert vd._filter({"duration": 30}) is None
    assert "601" in vd._filter({"duration": 601})
    assert "uzivo" in vd._filter({"is_live": True})
    vd.proveri_trajanje(None)
    vd.proveri_trajanje(600)
    with pytest.raises(vd.PreuzimanjeOdbijeno):
        vd.proveri_trajanje(601)
    with pytest.raises(vd.PreuzimanjeOdbijeno):
        vd._mora_postojati("nema/fajla.mp4")


def test_osnovna_podesavanja_preuzimanja():
    """Nikad ceo profil/playlistu, ograničena veličina i filter trajanja."""
    assert vd.BASE_OPTS["noplaylist"] is True and vd.BASE_OPTS["playlist_items"] == "1"
    assert vd.BASE_OPTS["max_filesize"] == 200 * 1024 * 1024
    assert vd.BASE_OPTS["match_filter"] is vd._filter


class _LazniYDL:
    info = {"title": "T", "description": "Opis", "uploader": "u", "duration": 42}

    def __init__(self, opts):
        _LazniYDL.opts = opts

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def extract_info(self, url, download=False):
        assert download is False
        return self.info


def test_metapodaci_bez_preuzimanja(monkeypatch):
    monkeypatch.setattr(vd.yt_dlp, "YoutubeDL", _LazniYDL)
    assert vd.fetch_metadata("u") == {"title": "T", "description": "Opis", "uploader": "u", "duration": 42}
    assert _LazniYDL.opts["skip_download"] and _LazniYDL.opts["noplaylist"]
    assert vd.get_caption("u") == "Opis"


def test_frejmovi_iz_videa(monkeypatch, tmp_path):
    monkeypatch.setattr(vd, "DOWNLOAD_DIR", str(tmp_path))

    def run(cmd, **kw):
        if cmd[0] == "ffprobe":
            return SimpleNamespace(stdout="12.0\n")
        open(cmd[cmd.index("-q:v") + 2], "wb").write(b"jpg")
        return SimpleNamespace(stdout="")

    monkeypatch.setattr(vd.subprocess, "run", run)
    frejmovi = vd.extract_frames("v.mp4", max_frames=3)
    assert len(frejmovi) == 3 and all(f.endswith(".jpg") for f in frejmovi)


# --- Nedeljno osvežavanje (pozadinski posao) -------------------------------


@pytest.fixture
def cisto_stanje(monkeypatch):
    monkeypatch.setattr(nedelja_plan, "_state", {"running": False, "last_fail": 0.0})


def test_osvezi_nedelju_pravi_sve_tri_stvari(api, monkeypatch, cisto_stanje):
    client, _ = api
    client.post("/profile/", json=PROFIL)
    pozvano = []
    monkeypatch.setattr("app.api.routes.meal_plan.generate_plan", lambda db: pozvano.append("jelovnik"))
    monkeypatch.setattr("app.api.routes.workout_plan.generate_plan", lambda db: pozvano.append("trening"))
    monkeypatch.setattr("app.api.routes.shopping_list.generate", lambda db: pozvano.append("kupovina"))
    assert client.post("/nedelja/osvezi").json() == {"status": "pokrenuto"}
    assert pozvano == ["jelovnik", "trening", "kupovina"]
    assert nedelja_plan._state["running"] is False


def test_osvezi_nedelju_greska_jelovnika(api, monkeypatch, cisto_stanje):
    client, _ = api
    client.post("/profile/", json=PROFIL)

    def puca(db):
        raise RuntimeError("AI ne radi")

    monkeypatch.setattr("app.api.routes.meal_plan.generate_plan", puca)
    client.post("/nedelja/osvezi")
    assert client.get("/nedelja/status").json() == {"status": "greska"}
    # Bez force ne pokušava odmah ponovo (štedi AI kredit); sa force pokušava
    assert client.post("/nedelja/osvezi").json() == {"status": "greska"}
    assert client.post("/nedelja/osvezi?force=true").json() == {"status": "pokrenuto"}


def test_osvezi_nedelju_greska_treninga_ne_zaustavlja_kupovinu(api, monkeypatch, cisto_stanje):
    client, Session = api
    client.post("/profile/", json=PROFIL)
    pozvano = []
    monkeypatch.setattr("app.api.routes.meal_plan.generate_plan", lambda db: pozvano.append("jelovnik"))
    monkeypatch.setattr("app.api.routes.workout_plan.generate_plan", lambda db: (_ for _ in ()).throw(RuntimeError()))
    monkeypatch.setattr("app.api.routes.shopping_list.generate", lambda db: pozvano.append("kupovina"))
    client.post("/nedelja/osvezi")
    assert pozvano == ["jelovnik", "kupovina"]
    assert nedelja_plan._state["last_fail"] == 0.0  # jelovnik je uspeo -> nije greška


def test_vec_radi(monkeypatch, cisto_stanje):
    assert nedelja_plan.try_start() == "pokrenuto"
    assert nedelja_plan.try_start() == "u_toku"


def test_status_u_toku(db, monkeypatch, cisto_stanje):
    nedelja_plan._state["running"] = True
    assert nedelja_plan.current_status(db) == "u_toku"
    nedelja_plan._state["running"] = False
    assert nedelja_plan.current_status(db) == "treba"
    db.add(MealPlan(plan_data={"nedelja_od": "nije-datum", "dani": []}))
    db.commit()
    assert nedelja_plan.current_status(db) in ("azurno", "treba")  # loš datum ne obara server
