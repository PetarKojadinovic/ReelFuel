import sqlite3
from datetime import datetime, timedelta

from sqlalchemy import create_engine

from app.models.database import init_db
from app.services import backup


def _baza(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'test.db'}")
    init_db(engine)
    with engine.begin() as c:
        c.exec_driver_sql("INSERT INTO weight_log (datum, tezina_kg) VALUES ('2026-11-06', 81.5)")
    return engine


def test_kopija_sadrzi_podatke(tmp_path):
    engine = _baza(tmp_path)
    k = backup.napravi_kopiju(engine, tmp_path / "b")
    con = sqlite3.connect(tmp_path / "b" / k["naziv"])
    assert con.execute("SELECT tezina_kg FROM weight_log").fetchone()[0] == 81.5
    con.close()
    engine.dispose()


def test_cuva_samo_poslednjih_10(tmp_path):
    engine = _baza(tmp_path)
    t0 = datetime(2026, 11, 1, 8, 0, 0)
    for i in range(13):
        backup.napravi_kopiju(engine, tmp_path / "b", t0 + timedelta(hours=i))
    kopije = backup.lista_kopija(engine, tmp_path / "b")
    assert len(kopije) == backup.ZADRZI
    assert kopije[0]["vreme"] == (t0 + timedelta(hours=12)).isoformat()
    engine.dispose()


def test_dnevna_kopija_jednom_dnevno(tmp_path):
    engine = _baza(tmp_path)
    dan = datetime(2026, 11, 6, 9, 0, 0)
    assert backup.dnevna_kopija(engine, tmp_path / "b", dan) is not None
    assert backup.dnevna_kopija(engine, tmp_path / "b", dan + timedelta(hours=3)) is None
    assert backup.dnevna_kopija(engine, tmp_path / "b", dan + timedelta(days=1)) is not None
    assert len(backup.lista_kopija(engine, tmp_path / "b")) == 2
    engine.dispose()
