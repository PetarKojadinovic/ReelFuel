import os
from anthropic import Anthropic
from dotenv import load_dotenv
from app.services.llm_utils import parse_json

load_dotenv()
client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

SYSTEM_PROMPT = """Na slici je obrok ili hrana. Prepoznaj sta je i proceni kalorije za PRIKAZANU porciju.
Pravila:
- Ako na slici nema hrane, vrati "naziv": null.
- Kalorije su samo procena: daj jedan broj i opseg (min i max).
- "pouzdanost" je "niska", "srednja" ili "visoka". Stavi "nisku" ako se porcija ne vidi jasno, ako je jelo mesano ili ne mozes da proceniš velicinu.
- Naziv kratko, na srpskom.
Vrati ISKLJUCIVO JSON: {"naziv": string ili null, "kalorije": broj ili null, "kalorije_min": broj ili null, "kalorije_max": broj ili null, "pouzdanost": "niska|srednja|visoka"}"""


def _int(v):
    try:
        return int(round(float(v)))
    except (TypeError, ValueError):
        return None


def analyze_meal_photo(b64: str, media_type: str) -> dict:
    msg = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=400,
        system=SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": b64}},
                    {"type": "text", "text": "Šta je na slici i koliko ima kalorija?"},
                ],
            }
        ],
    )
    data = parse_json(msg.content[0].text)
    return {
        "naziv": data.get("naziv"),
        "kalorije": _int(data.get("kalorije")),
        "kalorije_min": _int(data.get("kalorije_min")),
        "kalorije_max": _int(data.get("kalorije_max")),
        "pouzdanost": data.get("pouzdanost") or "niska",
    }