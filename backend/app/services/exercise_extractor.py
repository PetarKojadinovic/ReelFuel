import os
import json
from anthropic import Anthropic
from dotenv import load_dotenv

load_dotenv()

client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

SYSTEM_PROMPT = """Ti si fitnes asistent koji iz transkripta govora i analize pokreta iz video snimka izvlaci strukturisane podatke o vezbi.

Dobices:
1. Transkript onoga sto je izgovoreno u videu (moze biti nepotpun ili nejasan)
2. Rezultat analize pokreta (priblizan broj ponavljanja na osnovu pracenja pokreta tela)

Na osnovu ova dva izvora, zakljuci:
- Naziv vezbe (ako se pominje u transkriptu, koristi to; ako ne, pokusaj da pretpostavis na osnovu konteksta, inace stavi "Nepoznata vezba")
- Grupu misica koja se najverovatnije koristi za tu vezbu
- Serije i ponavljanja (koristi detektovan broj ponavljanja ako je dostupan, inace izvedi iz transkripta ako se pominje)

Vrati ISKLJUCIVO validan JSON, bez ikakvog dodatnog teksta ili markdown blokova.

Format:
{
  "naziv_vezbe": "string",
  "grupa_misica": "string",
  "serije_i_ponavljanja": "string opis, npr. '3 serije x 12 ponavljanja'"
}"""


def extract_exercise(transcript: str, pose_result: dict) -> dict:
    user_message = f"""Transkript: {transcript}

Analiza pokreta: {json.dumps(pose_result, ensure_ascii=False)}"""

    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=500,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_message}],
    )

    raw_text = message.content[0].text.strip()
    if raw_text.startswith("```"):
        raw_text = raw_text.strip("`").replace("json", "", 1).strip()

    return json.loads(raw_text)