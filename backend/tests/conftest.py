"""Testovi rade na privremenoj SQLite bazi; prava backend/reelfuel.db se ne dira."""
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
