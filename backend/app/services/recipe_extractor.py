import os
from anthropic import Anthropic
from dotenv import load_dotenv
from app.services.llm_utils import parse_json

load_dotenv()
client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

SYSTEM_PROMPT = """Iz opisa (caption) i transkripta govora videa sa TikToka/Instagrama izvuci strukturisan recept.
Opis cesto sadrzi sastojke i postupak - koristi ga kao glavni izvor, transkript samo dopunjava. Ako se kolicine razlikuju, veruj opisu.
Transkript moze imati greske prepoznavanja; koristi kontekst da pogodis kuvarske termine.
Ne izmisljaj sastojke koji nisu pomenuti. Kalorije su procena: napisi ih sa "oko", ili null ako se ne mogu proceniti.
Vrati ISKLJUCIVO validan JSON bez dodatnog teksta.

Format:
{"naziv_jela": "string", "sastojci": [{"naziv": "string", "kolicina": "string"}], "koraci": ["string"], "priblizne_kalorije": "string ili null"}"""


def extract_recipe(transcript: str, caption: str = "") -> dict:
    user = f"Opis videa:\n{caption or '(nema)'}\n\nTranskript govora:\n{transcript or '(nema)'}"
    msg = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1500,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user}],
    )
    return parse_json(msg.content[0].text)