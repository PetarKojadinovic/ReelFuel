import os
import json
from anthropic import Anthropic
from dotenv import load_dotenv
from sqlalchemy.orm import Session
from app.models.database import UserProfile, MealPlan, Recipe, ChatMessage

load_dotenv()

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
        for key, value in tool_input.items():
            setattr(profile, key, value)
        db.commit()
        return f"Profil azuriran: {json.dumps(tool_input, ensure_ascii=False)}"

    if tool_name == "swap_meal":
        plan = db.query(MealPlan).order_by(MealPlan.id.desc()).first()
        if not plan:
            return "Ne postoji nedeljni plan da se izmeni."
        plan_data = plan.plan_data
        for day in plan_data.get("dani", []):
            if day["dan"].lower() == tool_input["dan"].lower():
                day["obroci"][tool_input["obrok_tip"]] = {
                    "naziv": tool_input["novi_naziv"],
                    "kalorije": tool_input["nove_kalorije"],
                    "izvor": "rucna_izmena",
                    "recipe_id": None,
                }
                ukupno = sum(m["kalorije"] for m in day["obroci"].values())
                day["ukupno_kalorija"] = ukupno
        plan.plan_data = plan_data
        db.commit()
        return f"Obrok izmenjen za {tool_input['dan']} - {tool_input['obrok_tip']}."

    if tool_name == "add_recipe":
        db_recipe = Recipe(
            naziv_jela=tool_input["naziv_jela"],
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

    while response.stop_reason == "tool_use":
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