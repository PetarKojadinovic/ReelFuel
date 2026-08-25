import os
import json
from anthropic import Anthropic
from dotenv import load_dotenv

load_dotenv()

client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

SYSTEM_PROMPT = """Ti si asistent koji iz transkripta govornog videa (recept sa TikTok/Instagram) izvlači strukturisan recept.
Vrati ISKLJUČIVO validan JSON, bez ikakvog dodatnog teksta, markdown blokova ili objašnjenja.

Format:
{
  "naziv_jela": "string",
  "sastojci": [{"naziv": "string", "kolicina": "string"}],
  "koraci": ["string"],
  "priblizne_kalorije": "string ili null ako se ne moze proceniti"
}

Ako transkript ima greske u prepoznavanju govora, koristi kontekst da pretpostavis najverovatnije reci (npr. kuvarski termini, namirnice)."""

def extract_recipe(transcript: str) -> dict:
    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1000,
        system=SYSTEM_PROMPT,
        messages=[
            {"role": "user", "content": f"Transkript: {transcript}"}
        ]
    )

    raw_text = message.content[0].text.strip()

    # ukloni markdown code block ako Claude ipak doda ```json
    if raw_text.startswith("```"):
        raw_text = raw_text.strip("`").replace("json", "", 1).strip()

    return json.loads(raw_text)