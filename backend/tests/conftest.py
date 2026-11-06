"""Testovi rade na privremenoj SQLite bazi; prava backend/reelfuel.db se ne dira."""
import os

# Pre importa aplikacije: testovi koriste svoje ključeve, a load_dotenv ne gazi već
# postavljene promenljive -> pravi ključevi iz .env se u testovima ne koriste, a slučajan
# poziv pravom Anthropic API-ju pada (nevažeći ključ) umesto da troši kredit.
TEST_API_KEY = "test-kljuc-samo-za-testove-123456"
os.environ["APP_SECRET_KEY"] = TEST_API_KEY
os.environ["ANTHROPIC_API_KEY"] = "test-nije-pravi-kljuc"

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.database import init_db


@pytest.fixture
def db(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'test.db'}", connect_args={"check_same_thread": False})
    init_db(engine)
    session = sessionmaker(bind=engine)()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


def napravi_plan_data(nedelja_od: str, kcal: int = 500) -> dict:
    """Minimalan nedeljni plan: 7 dana x 3 obroka, svaki obrok `kcal`."""
    from app.services.daily_nutrition import DANI, OBROCI

    return {
        "nedelja_od": nedelja_od,
        "dani": [
            {
                "dan": dan.capitalize(),
                "obroci": {t: {"naziv": f"{dan} {t}", "kalorije": kcal, "izvor": "generisan"} for t in OBROCI},
                "ukupno_kalorija": kcal * 3,
            }
            for dan in DANI
        ],
    }


@pytest.fixture
def api(tmp_path, monkeypatch):
    """HTTP klijent nad celom aplikacijom (sve rute, provera ključa) sa privremenom bazom.

    Bez `with TestClient(...)` -> startup (dnevna kopija, init_db prave baze) se NE pokreće.
    Vraća (client, Session); client šalje ispravan X-API-Key.
    """
    from fastapi.testclient import TestClient

    from app.main import app
    from app.models.database import get_db
    from app.services import backup, ingest_pipeline, nedelja_plan

    engine = create_engine(f"sqlite:///{tmp_path / 'api.db'}", connect_args={"check_same_thread": False})
    init_db(engine)
    Session = sessionmaker(bind=engine)

    def _db():
        s = Session()
        try:
            yield s
        finally:
            s.close()

    app.dependency_overrides[get_db] = _db
    # Pozadinski poslovi i kopija baze otvaraju bazu sami, ne preko get_db
    monkeypatch.setattr(ingest_pipeline, "SessionLocal", Session)
    monkeypatch.setattr(nedelja_plan, "SessionLocal", Session)
    monkeypatch.setattr(backup, "engine", engine)

    client = TestClient(app, headers={"X-API-Key": TEST_API_KEY})
    try:
        yield client, Session
    finally:
        app.dependency_overrides.clear()
        engine.dispose()


PROFIL = {
    "tezina_kg": 85,
    "visina_cm": 180,
    "godine": 25,
    "pol": "muski",
    "nivo_aktivnosti": "srednji",
    "cilj": "mrsavljenje",
    "ciljna_tezina_kg": 78,
}


class LazniLLM:
    """Zamena za Anthropic klijent: vraća zadate tekstove redom (poslednji se ponavlja) i pamti pozive."""

    def __init__(self, *odgovori: str):
        from types import SimpleNamespace

        self._ns = SimpleNamespace
        self.odgovori = list(odgovori)
        self.pozivi = []
        self.messages = SimpleNamespace(create=self._create)

    def _create(self, **kw):
        self.pozivi.append(kw)
        tekst = self.odgovori.pop(0) if len(self.odgovori) > 1 else self.odgovori[0]
        return self._ns(content=[self._ns(type="text", text=tekst)], stop_reason="end_turn")

    def poruka(self, i=-1) -> str:
        """Tekst korisničke poruke iz i-tog poziva."""
        c = self.pozivi[i]["messages"][-1]["content"]
        return c if isinstance(c, str) else " ".join(x.get("text", "") for x in c if isinstance(x, dict))
