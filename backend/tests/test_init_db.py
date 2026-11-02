"""init_db dodaje novu kolonu u STARU tabelu bez brisanja podataka."""
from sqlalchemy import create_engine

from app.models.database import init_db


def test_dodaje_izvor_u_staru_shopping_list(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'stara.db'}")
    with engine.begin() as c:
        c.exec_driver_sql(
            "CREATE TABLE shopping_list (id INTEGER PRIMARY KEY, naziv VARCHAR, kolicina VARCHAR, "
            "checked BOOLEAN, created_at DATETIME)"
        )
        c.exec_driver_sql("INSERT INTO shopping_list (naziv, checked) VALUES ('Hleb', 0)")

    init_db(engine)
    init_db(engine)  # drugi put ne sme da pukne

    with engine.connect() as c:
        kolone = {r[1] for r in c.exec_driver_sql("PRAGMA table_info(shopping_list)")}
        redovi = c.exec_driver_sql("SELECT naziv, izvor FROM shopping_list").fetchall()
    assert "izvor" in kolone
    assert redovi == [("Hleb", None)]
    engine.dispose()
