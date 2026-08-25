import os
import json
from anthropic import Anthropic
from dotenv import load_dotenv

load_dotenv()

client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

SYSTEM_PROMPT = """Ti dobijas listu svih sastojaka iz nedeljnog plana ishrane (sa ponavljanjima izmedju razlicitih obroka i dana).

Tvoj zadatak je da napravis KONSOLIDOVANU listu za kupovinu:
- Spoji iste ili vrlo slicne namirnice u jednu stavku (npr. "piletece grudi" i "pileca prsa" su ista stvar)
- Saberi kolicine gde je moguce (npr. "200g piletine" + "150g piletine" = "350g piletine")
- Ako se jedinice ne poklapaju ili ne mogu sabrati (npr. "2 jaja" i "po zelji"), ostavi kao odvojene stavke ili razumnu aproksimaciju
- Grupisi slicne namirnice ali ne pretvaraj u kategorije - svaka stavka treba da bude konkretna namirnica
- Zaokruzi kolicine na razumne vrednosti za kupovinu (npr. "1kg piletine" umesto "987g")

Vrati ISKLJUCIVO validan JSON, bez dodatnog teksta ili markdown blokova.

Format:
{
  "stavke": [
    {"naziv": "string", "kolicina": "string"}
  ]
}"""


def generate_shopping_list(plan_data: dict) -> list:
    all_ingredients = []
    for day in plan_data.get("dani", []):
        for meal_type, meal in day.get("obroci", {}).items():
            for s in meal.get("sastojci", []):
                all_ingredients.append(f"{s.get('kolicina', '')} {s.get('naziv', '')}".strip())

    if not all_ingredients:
        return []

    ingredients_text = "\n".join(f"- {i}" for i in all_ingredients)

    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=2000,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": f"Sastojci iz nedeljnog plana:\n{ingredients_text}"}],
    )

    raw_text = message.content[0].text.strip()
    if raw_text.startswith("```"):
        raw_text = raw_text.strip("`").replace("json", "", 1).strip()

    result = json.loads(raw_text)
    return result.get("stavke", [])