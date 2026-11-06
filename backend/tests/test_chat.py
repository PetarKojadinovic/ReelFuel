"""Chat asistent: alati (bezbednosne provere) i petlja alata, sa lažnim Claude klijentom."""
from types import SimpleNamespace

from app.models.database import ChatMessage, MealPlan, Recipe, UserProfile
from app.services import chat_service as cs
from tests.conftest import PROFIL, napravi_plan_data


def _profil(db):
    db.add(UserProfile(**PROFIL, raspodela_kalorija="vecera_najveca", broj_treninga_nedeljno=4))
    db.commit()


# --- execute_tool ----------------------------------------------------------

def test_update_profile_menja_dozvoljeno(db):
    _profil(db)
    assert "azuriran" in cs.execute_tool("update_profile", {"tezina_kg": 83}, db)
    assert db.query(UserProfile).first().tezina_kg == 83


def test_update_profile_odbija_nedozvoljeno(db):
    _profil(db)
    for ulaz in ({"id": 99}, {"tezina_kg": 5}, {"pol": "x"}, {"cilj": "sve"}):
        assert "odbijena" in cs.execute_tool("update_profile", ulaz, db)
    p = db.query(UserProfile).first()
    assert p.id == 1 and p.tezina_kg == 85


def test_update_profile_bez_profila(db):
    assert cs.execute_tool("update_profile", {"tezina_kg": 80}, db) == "Ne postoji profil da se azurira."


def test_swap_meal(db):
    db.add(MealPlan(plan_data=napravi_plan_data("2026-11-02", kcal=500)))
    db.commit()
    r = cs.execute_tool("swap_meal", {"dan": "Utorak", "obrok_tip": "rucak", "novi_naziv": "Pljeskavica", "nove_kalorije": 800, "novi_proteini_g": 40}, db)
    assert "izmenjen" in r
    dan = next(d for d in db.query(MealPlan).first().plan_data["dani"] if d["dan"].lower() == "utorak")
    assert dan["obroci"]["rucak"]["naziv"] == "Pljeskavica"
    assert dan["ukupno_kalorija"] == 500 + 800 + 500


def test_swap_meal_odbija_los_ulaz(db):
    db.add(MealPlan(plan_data=napravi_plan_data("2026-11-02")))
    db.commit()
    osnova = {"dan": "Utorak", "obrok_tip": "rucak", "novi_naziv": "X", "nove_kalorije": 500}
    assert "odbijena" in cs.execute_tool("swap_meal", {**osnova, "obrok_tip": "uzina"}, db)
    assert "odbijena" in cs.execute_tool("swap_meal", {**osnova, "nove_kalorije": "puno"}, db)
    assert "odbijena" in cs.execute_tool("swap_meal", {**osnova, "nove_kalorije": 99999}, db)
    assert "nije pronadjen" in cs.execute_tool("swap_meal", {**osnova, "dan": "Osmica"}, db)


def test_add_recipe(db):
    r = cs.execute_tool("add_recipe", {"naziv_jela": "Ovsena", "sastojci": [{"naziv": "ovas"}], "koraci": ["kuvaj"], "proteini_g": 12}, db)
    assert "sacuvan" in r
    assert db.query(Recipe).one().proteini_g == 12
    assert "odbijen" in cs.execute_tool("add_recipe", {"naziv_jela": "X", "sastojci": "ovas", "koraci": []}, db)
    assert cs.execute_tool("obrisi_sve", {}, db) == "Nepoznata akcija."


# --- send_message (petlja alata) -------------------------------------------

def _odgovor(*blokovi, stop="end_turn"):
    return SimpleNamespace(stop_reason=stop, content=list(blokovi))


def _tekst(t):
    return SimpleNamespace(type="text", text=t)


def _alat(ime, ulaz, i="t1"):
    return SimpleNamespace(type="tool_use", name=ime, input=ulaz, id=i)


class LazniClaude:
    def __init__(self, odgovori):
        self.odgovori = list(odgovori)
        self.pozivi = []
        self.messages = SimpleNamespace(create=self._create)

    def _create(self, **kw):
        self.pozivi.append(kw)
        return self.odgovori.pop(0) if len(self.odgovori) > 1 else self.odgovori[0]


def test_chat_poziva_alat_i_pamti_razgovor(db, monkeypatch):
    _profil(db)
    k = LazniClaude([
        _odgovor(_alat("update_profile", {"tezina_kg": 84}), stop="tool_use"),
        _odgovor(_tekst("Upisao sam 84 kg.")),
    ])
    monkeypatch.setattr(cs, "client", k)
    assert cs.send_message("Sad imam 84 kg", db) == "Upisao sam 84 kg."
    assert db.query(UserProfile).first().tezina_kg == 84
    assert [(m.role, m.content) for m in db.query(ChatMessage).all()] == [
        ("user", "Sad imam 84 kg"), ("assistant", "Upisao sam 84 kg.")]
    assert len(k.pozivi) == 2


def test_chat_najvise_5_krugova_alata(db, monkeypatch):
    _profil(db)
    k = LazniClaude([_odgovor(_alat("update_profile", {"tezina_kg": 84}), _tekst("..."), stop="tool_use")])
    monkeypatch.setattr(cs, "client", k)
    cs.send_message("petlja", db)
    assert len(k.pozivi) == 1 + cs.MAX_TOOL_ROUNDS


def test_chat_ruta_ne_vraca_interni_tekst(api, monkeypatch):
    client, _ = api

    def puca(*a, **kw):
        raise RuntimeError("tajni interni detalj")

    monkeypatch.setattr("app.api.routes.chat.send_message", puca)
    r = client.post("/chat/", json={"message": "zdravo"})
    assert r.status_code == 500
    assert "tajni" not in r.text
