import os
import json
import logging
from typing import Literal, Optional

from anthropic import Anthropic
from dotenv import load_dotenv
from pydantic import BaseModel, ConfigDict, Field, ValidationError
from sqlalchemy.orm import Session
from app.models.database import UserProfile, MealPlan, Recipe, ChatMessage

load_dotenv()
log = logging.getLogger("chat")

# Najvise krugova alata po jednoj poruci (zastita od beskonacne petlje i troska)
MAX_TOOL_ROUNDS = 5
OBROK_TIPOVI = ("dorucak", "rucak", "vecera")


class ProfilIzmena(BaseModel):
    """Ista ogranicenja kao ProfileRequest u routes/profile.py. Nepoznata polja se odbijaju."""
    model_config = ConfigDict(extra="forbid")

    tezina_kg: Optional[float] = Field(default=None, gt=20, lt=400)
    visina_cm: Optional[float] = Field(default=None, gt=80, lt=260)
    godine: Optional[int] = Field(default=None, gt=9, lt=120)
    pol: Optional[Literal["muski", "zenski"]] = None
    nivo_aktivnosti: Optional[Literal["nizak", "srednji", "visok"]] = None
    cilj: Optional[Literal["mrsavljenje", "dobijanje_mise", "odrzavanje"]] = None
    raspodela_kalorija: Optional[Literal["vecera_najveca", "rucak_najveci", "dorucak_najveci", "ravnomerno"]] = None

client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

ACTIVITY_MULTIPLIERS = {"nizak": 1.2, "srednji": 1.55, "visok": 1.725}

TOOLS = [
    {
        "name": "update_profile",
        "description": "Azurira korisnikov profil (tezina, visina, godine, pol, nivo aktivnosti, cilj, ili preferenca raspodele kalorija). Prosledi samo polja koja se stvarno menjaju.",
        "input_schema": {
            "type": "object",
            "properties": {
                "tezina_kg": {"type": "number"},
                "visina_cm": {"type": "number"},
                "godine": {"type": "integer"},
                "pol": {"type": "string", "enum": ["muski", "zenski"]},
                "nivo_aktivnosti": {"type": "string", "enum": ["nizak", "srednji", "visok"]},
                "cilj": {"type": "string", "enum": ["mrsavljenje", "dobijanje_mise", "odrzavanje"]},
                "raspodela_kalorija": {"type": "string", "enum": ["vecera_najveca", "rucak_najveci", "dorucak_najveci", "ravnomerno"]},
            },
        },
    },
    {
        "name": "swap_meal",
        "description": "Menja jedan obrok u odredjenom danu trenutnog nedeljnog plana (npr. korisnik kaze da je pojeo nesto drugo, ili zeli da zameni obrok).",
        "input_schema": {
            "type": "object",
            "properties": {
                "dan": {"type": "string", "description": "Naziv dana, npr. Ponedeljak"},
                "obrok_tip": {"type": "string", "enum": ["dorucak", "rucak", "vecera"]},
                "novi_naziv": {"type": "string"},
                "nove_kalorije": {"type": "integer"},
            },
            "required": ["dan", "obrok_tip", "novi_naziv", "nove_kalorije"],
        },
    },
    {
        "name": "add_recipe",
        "description": "Dodaje novi recept u bazu recepata korisnika, na osnovu opisa koji korisnik da u chat-u (bez linka).",
        "input_schema": {
            "type": "object",
            "properties": {
                "naziv_jela": {"type": "string"},
                "sastojci": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "naziv": {"type": "string"},
                            "kolicina": {"type": "string"},
                        },
                    },
                },
                "koraci": {"type": "array", "items": {"type": "string"}},
                "priblizne_kalorije": {"type": "string"},
            },
            "required": ["naziv_jela", "sastojci", "koraci"],
        },
    },
]


def execute_tool(tool_name: str, tool_input: dict, db: Session) -> str:
    if tool_name == "update_profile":
        profile = db.query(UserProfile).first()
        if not profile:
            return "Ne postoji profil da se azurira."
        try:
            izmena = ProfilIzmena(**tool_input).model_dump(exclude_none=True)
        except ValidationError:
            return "Izmena odbijena: neispravna ili nedozvoljena polja profila."
        if not izmena:
            return "Nema polja za izmenu."
        for key, value in izmena.items():
            setattr(profile, key, value)
        db.commit()
        return f"Profil azuriran: {json.dumps(izmena, ensure_ascii=False)}"

    if tool_name == "swap_meal":
        dan = str(tool_input.get("dan") or "").strip().lower()
        obrok_tip = tool_input.get("obrok_tip")
        novi_naziv = str(tool_input.get("novi_naziv") or "").strip()[:200]
        try:
            nove_kalorije = int(tool_input.get("nove_kalorije"))
        except (TypeError, ValueError):
            return "Izmena odbijena: kalorije moraju biti broj."
        if not dan or obrok_tip not in OBROK_TIPOVI or not novi_naziv or not 0 <= nove_kalorije <= 5000:
            return "Izmena odbijena: neispravan dan, tip obroka, naziv ili kalorije."

        plan = db.query(MealPlan).order_by(MealPlan.id.desc()).first()
        if not plan:
            return "Ne postoji nedeljni plan da se izmeni."
        plan_data = dict(plan.plan_data or {})
        nadjen = False
        for day in plan_data.get("dani", []):
            if str(day.get("dan", "")).lower() == dan:
                obroci = day.setdefault("obroci", {})
                obroci[obrok_tip] = {
                    "naziv": novi_naziv,
                    "kalorije": nove_kalorije,
                    "izvor": "rucna_izmena",
                    "recipe_id": None,
                }
                day["ukupno_kalorija"] = sum(int(m.get("kalorije") or 0) for m in obroci.values())
                nadjen = True
        if not nadjen:
            return f"Dan '{tool_input.get('dan')}' nije pronadjen u planu."
        plan.plan_data = plan_data
        db.commit()
        return f"Obrok izmenjen za {tool_input['dan']} - {obrok_tip}."

    if tool_name == "add_recipe":
        naziv = str(tool_input.get("naziv_jela") or "").strip()[:200]
        if not naziv or not isinstance(tool_input.get("sastojci"), list) or not isinstance(tool_input.get("koraci"), list):
            return "Recept odbijen: nedostaje naziv, sastojci ili koraci."
        db_recipe = Recipe(
            naziv_jela=naziv,
            sastojci=tool_input["sastojci"],
            koraci=tool_input["koraci"],
            priblizne_kalorije=tool_input.get("priblizne_kalorije"),
            source_url="rucno_dodato_kroz_chat",
        )
        db.add(db_recipe)
        db.commit()
        db.refresh(db_recipe)
        return f"Recept '{tool_input['naziv_jela']}' sacuvan sa ID {db_recipe.id}."

    return "Nepoznata akcija."


def build_context(db: Session) -> str:
    profile = db.query(UserProfile).first()
    plan = db.query(MealPlan).order_by(MealPlan.id.desc()).first()

    profile_text = "Korisnik jos nema sacuvan profil." if not profile else f"""
Tezina: {profile.tezina_kg}kg, Visina: {profile.visina_cm}cm, Godine: {profile.godine}, Pol: {profile.pol}
Nivo aktivnosti: {profile.nivo_aktivnosti}, Cilj: {profile.cilj}, Preferenca rasporeda: {profile.raspodela_kalorija}
"""

    plan_text = "Korisnik jos nema generisan nedeljni plan." if not plan else json.dumps(plan.plan_data, ensure_ascii=False)

    return f"""Trenutni profil korisnika:
{profile_text}

Trenutni nedeljni plan ishrane:
{plan_text}"""


def send_message(user_message: str, db: Session) -> str:
    context = build_context(db)

    history = db.query(ChatMessage).order_by(ChatMessage.id.asc()).all()
    messages = [{"role": m.role, "content": m.content} for m in history]
    messages.append({"role": "user", "content": user_message})

    system_prompt = f"""Ti si licni AI asistent za ishranu i fitnes u aplikaciji ReelFuel.
Pomazes korisniku da razume i menja svoj profil, nedeljni plan ishrane, i recepte.
Kada korisnik trazi izmenu (npr. promeni tezinu, zameni obrok, dodaj novi recept), koristi odgovarajuci alat.
Ako korisnik samo postavlja pitanje ili trazi savet, odgovori direktno bez pozivanja alata.
Budi kratak, direktan i koristan.

{context}"""

    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1500,
        system=system_prompt,
        tools=TOOLS,
        messages=messages,
    )

    rounds = 0
    while response.stop_reason == "tool_use" and rounds < MAX_TOOL_ROUNDS:
        rounds += 1
        tool_results = []
        assistant_content = response.content

        for block in response.content:
            if block.type == "tool_use":
                result_text = execute_tool(block.name, block.input, db)
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": result_text,
                })

        messages.append({"role": "assistant", "content": assistant_content})
        messages.append({"role": "user", "content": tool_results})

        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1500,
            system=system_prompt,
            tools=TOOLS,
            messages=messages,
        )

    final_text = "".join([block.text for block in response.content if block.type == "text"])

    db.add(ChatMessage(role="user", content=user_message))
    db.add(ChatMessage(role="assistant", content=final_text))
    db.commit()

    return final_text