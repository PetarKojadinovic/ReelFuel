from datetime import datetime

from sqlalchemy import create_engine, Column, Integer, String, Float, JSON, DateTime, Boolean
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = "sqlite:///./reelfuel.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()


class Recipe(Base):
    __tablename__ = "recipes"

    id = Column(Integer, primary_key=True, index=True)
    naziv_jela = Column(String)
    sastojci = Column(JSON)
    koraci = Column(JSON)
    priblizne_kalorije = Column(String, nullable=True)
    source_url = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)


class UserProfile(Base):
    __tablename__ = "user_profile"

    id = Column(Integer, primary_key=True, index=True)
    tezina_kg = Column(Float)
    visina_cm = Column(Float)
    godine = Column(Integer)
    pol = Column(String)  # "muski" ili "zenski"
    nivo_aktivnosti = Column(String)  # "nizak", "srednji", "visok"
    cilj = Column(String, default="mrsavljenje")
    updated_at = Column(DateTime, default=datetime.utcnow)
    raspodela_kalorija = Column(String, default="rucak_najveca")
    broj_treninga_nedeljno = Column(Integer, default=4)
    ciljna_tezina_kg = Column(Float, nullable=True)

class MealPlan(Base):
    __tablename__ = "meal_plans"

    id = Column(Integer, primary_key=True, index=True)
    plan_data = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)

class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    role = Column(String)  # "user" ili "assistant"
    content = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

class FoodLogEntry(Base):
    __tablename__ = "food_log"

    id = Column(Integer, primary_key=True, index=True)
    datum = Column(String)  # format "YYYY-MM-DD"
    obrok_tip = Column(String, nullable=True)  # "dorucak", "rucak", "vecera", ili None za slobodan unos
    naziv = Column(String)
    kalorije = Column(Integer)
    izvor = Column(String)  # "plan" ili "slobodan"
    created_at = Column(DateTime, default=datetime.utcnow)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Nove kolone u POSTOJECIM tabelama. SQLite nema migracije, a create_all ne dodaje
# kolone u tabelu koja vec postoji -> dodaju se ovde (ALTER TABLE), bez brisanja baze.
# Imena su fiksna u kodu (ne dolaze od korisnika).
NOVE_KOLONE = {
    "shopping_list": {"izvor": "VARCHAR"},
}


def _dodaj_kolone(bind):
    with bind.begin() as conn:
        for tabela, kolone in NOVE_KOLONE.items():
            postojece = {r[1] for r in conn.exec_driver_sql(f"PRAGMA table_info({tabela})")}
            if not postojece:
                continue  # tabela jos ne postoji; create_all ju je napravio sa svim kolonama
            for kolona, tip in kolone.items():
                if kolona not in postojece:
                    conn.exec_driver_sql(f"ALTER TABLE {tabela} ADD COLUMN {kolona} {tip}")


def init_db(bind=None):
    bind = bind or engine
    Base.metadata.create_all(bind=bind)
    _dodaj_kolone(bind)


class Exercise(Base):
    __tablename__ = "exercises"

    id = Column(Integer, primary_key=True, index=True)
    naziv_vezbe = Column(String)
    grupa_misica = Column(String)
    serije_i_ponavljanja = Column(String)
    detektovano_ponavljanja = Column(Integer, nullable=True)
    source_url = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

class WorkoutPlan(Base):
    __tablename__ = "workout_plans"

    id = Column(Integer, primary_key=True, index=True)
    plan_data = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)


class WorkoutLogEntry(Base):
    __tablename__ = "workout_log"

    id = Column(Integer, primary_key=True, index=True)
    datum = Column(String)
    dan_treninga = Column(String, nullable=True)
    naziv_vezbe = Column(String)
    serije_i_ponavljanja = Column(String, nullable=True)
    izvor = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)


class WeightLog(Base):
    __tablename__ = "weight_log"

    id = Column(Integer, primary_key=True, index=True)
    datum = Column(String)  # "YYYY-MM-DD"
    tezina_kg = Column(Float)
    created_at = Column(DateTime, default=datetime.utcnow)

class ShoppingListItem(Base):
    __tablename__ = "shopping_list"

    id = Column(Integer, primary_key=True, index=True)
    naziv = Column(String)
    kolicina = Column(String, nullable=True)
    checked = Column(Boolean, default=False)
    izvor = Column(String, nullable=True)  # "plan" (iz nedeljnog plana) / "recept" / None (stare stavke)
    created_at = Column(DateTime, default=datetime.utcnow)


class IngestJob(Base):
    __tablename__ = "ingest_jobs"

    id = Column(String, primary_key=True)
    url = Column(String)
    url_norm = Column(String, index=True)
    status = Column(String, default="u_toku")  # u_toku, gotovo, greska, potrebna_odluka, odbaceno
    faza = Column(String, default="")
    tip = Column(String, nullable=True)  # recept ili vezba
    rezultat = Column(JSON, nullable=True)
    greska = Column(String, nullable=True)
    sacuvano_id = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class KalorijskaKorekcija(Base):
    __tablename__ = "kalorijska_korekcija"

    id = Column(Integer, primary_key=True, index=True)
    delta = Column(Integer)
    razlog = Column(String)
    tezina_trend = Column(Float, nullable=True)  # kg nedeljno
    status = Column(String, default="predlog")  # predlog, prihvaceno, odbijeno, ponisteno
    created_at = Column(DateTime, default=datetime.utcnow)


class Proizvod(Base):
    """Keš proizvoda po bar-kodu (Open Food Facts ili očitana tabela sa pakovanja)."""
    __tablename__ = "proizvod"

    barkod = Column(String, primary_key=True)
    naziv = Column(String)
    kcal_100g = Column(Float)
    porcija_g = Column(Float, nullable=True)
    paket_g = Column(Float, nullable=True)
    izvor = Column(String)  # openfoodfacts, etiketa
    created_at = Column(DateTime, default=datetime.utcnow)