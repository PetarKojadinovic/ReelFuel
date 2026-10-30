import os
import json
from anthropic import Anthropic
from dotenv import load_dotenv
from app.services.llm_utils import parse_json

load_dotenv()
client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

SYSTEM_PROMPT = """Iz opisa videa, transkripta govora i analize pokreta izvuci podatke o vezbi.
Ime vezbe uzmi iz opisa ili transkripta ako je pomenuto; ako nije, pogodi iz konteksta, a inace stavi "Nepoznata vezba".
Za serije/ponavljanja koristi opis ili transkript; detektovan broj ponavljanja je samo orijentir.
Vrati ISKLJUCIVO validan JSON.

Format:
{"naziv_vezbe": "string", "grupa_misica": "string", "serije_i_ponavljanja": "string"}"""


def extract_exercise(transcript: str, pose_result: dict, caption: str = "") -> dict:
    user = (
        f"Opis videa:\n{caption or '(nema)'}\n\n"
        f"Transkript govora:\n{transcript or '(nema)'}\n\n"
        f"Analiza pokreta: {json.dumps(pose_result, ensure_ascii=False)}"
    )
    msg = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=500,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user}],
    )
    return parse_json(msg.content[0].text)