import os
import json
from anthropic import Anthropic
from dotenv import load_dotenv

load_dotenv()

client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

RASPODELE = {
    "vecera_najveca": "dorucak ~15-20% dnevnog cilja, rucak ~25-30%, vecera ~45-55% (vecera najveci obrok)",
    "rucak_najveci": "dorucak ~15-20% dnevnog cilja, rucak ~40-50%, vecera ~25-30% (rucak najveci obrok)",
    "dorucak_najveci": "dorucak ~40-45% dnevnog cilja, rucak ~30-35%, vecera ~20-25% (dorucak najveci obrok)",
    "ravnomerno": "priblizno jednaka raspodela: svaki obrok ~30-35% dnevnog cilja",
}


def build_system_prompt(raspodela_kljuc: str) -> str:
    raspodela_opis = RASPODELE.get(raspodela_kljuc, RASPODELE["vecera_najveca"])
    return f"""Ti si nutricionista koji pravi nedeljni plan ishrane za mrsavljenje (deficit kalorija).

Pravila:
- Plan mora imati 7 dana (ponedeljak-nedelja), svaki dan sa 3 obroka: dorucak, rucak, vecera
- RASPODELA KALORIJA PO OBROCIMA: {raspodela_opis}
- Sto manje ponavljanja istih obroka tokom nedelje
- Ako su ti dati "sacuvani recepti" korisnika (sa sastojcima), iskoristi ih tamo gde odgovaraju kalorijskom cilju - kad ih koristis, PREUZMI TACNE sastojke koje su ti date za taj recept
- Za ostale (nove) obroke, predlozi jednostavne, realne obroke i navedi njihove sastojke sa priblicnim kolicinama
- SVAKI obrok MORA imati listu sastojaka sa kolicinama (npr. "200g piletece grudi", "1 solja pirinca") - ovo je OBAVEZNO za svaki obrok, bez izuzetka
- PROTEINI: ako je dat dnevni cilj proteina, rasporedi proteine kroz sva 3 obroka tako da dnevni zbir bude sto blizi cilju (bar 90% cilja). Biraj obroke bogate proteinima (meso, riba, jaja, mlecni proizvodi, mahunarke).
- SVAKI obrok MORA imati "proteini_g" (procena grama proteina iz sastojaka)
- Zbir kalorija za svaki dan treba da bude sto blizi zadatom dnevnom cilju (dozvoljena razlika +/- 150 kalorija)
- Ako je obrok iz sacuvanih recepata korisnika, oznaci ga sa "izvor": "sacuvan", inace "izvor": "predlog"

Vrati ISKLJUCIVO validan JSON, bez ikakvog dodatnog teksta ili markdown blokova.

Format:
{{
  "dani": [
    {{
      "dan": "Ponedeljak",
      "obroci": {{
        "dorucak": {{
          "naziv": "string",
          "kalorije": broj,
          "proteini_g": broj,
          "izvor": "sacuvan ili predlog",
          "recipe_id": broj ili null,
          "sastojci": [{{"naziv": "string", "kolicina": "string"}}]
        }},
        "rucak": {{...}},
        "vecera": {{...}}
      }},
      "ukupno_kalorija": broj,
      "ukupno_proteina": broj
    }}
  ]
}}"""


def generate_weekly_plan(
    dnevni_cilj_kalorija: int,
    saved_recipes: list,
    raspodela_kalorija: str = "vecera_najveca",
    dnevni_cilj_proteina: int | None = None,
) -> dict:
    recipes_lines = []
    for r in saved_recipes:
        sastojci_text = ", ".join([f"{s.get('kolicina', '')} {s.get('naziv', '')}".strip() for s in r.get("sastojci", [])])
        prot = f", ~{round(r['proteini_g'])} g proteina" if r.get("proteini_g") else ""
        recipes_lines.append(f"- ID {r['id']}: {r['naziv_jela']} ({r['priblizne_kalorije']}{prot}) - sastojci: {sastojci_text}")

    recipes_text = "\n".join(recipes_lines) if recipes_lines else "Nema sacuvanih recepata."

    cilj_proteina = f"{dnevni_cilj_proteina} g" if dnevni_cilj_proteina else "nije zadat"
    user_message = f"""Dnevni cilj kalorija: {dnevni_cilj_kalorija}
Dnevni cilj proteina: {cilj_proteina}

Sacuvani recepti korisnika:
{recipes_text}

Napravi nedeljni plan ishrane."""

    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=6000,
        system=build_system_prompt(raspodela_kalorija),
        messages=[{"role": "user", "content": user_message}],
    )

    raw_text = message.content[0].text.strip()
    if raw_text.startswith("```"):
        raw_text = raw_text.strip("`").replace("json", "", 1).strip()

    return json.loads(raw_text)