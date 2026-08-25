import os
import json
from anthropic import Anthropic
from dotenv import load_dotenv

load_dotenv()

client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

SYSTEM_PROMPT_TEMPLATE = """Ti si licni trener koji pravi nedeljni plan treninga za {tip_treninga}.

{tip_specifikacija}

Pravila:
- Plan mora imati tacno {broj_dana} dana treninga nedeljno, ostali dani su odmor
- Ti sam biraj najbolji split (full body, upper/lower, push/pull/legs, itd.) na osnovu cilja korisnika i broja dana - obrazlozi izbor kratko u polju "tip_splita"
- Ako su ti dati "sacuvane vezbe" korisnika, iskoristi ih tamo gde odgovaraju danu, grupi misica, I tipu treninga ({tip_treninga}) - ne moras iskoristiti sve
- Za ostale vezbe, predlozi standardne vezbe koje odgovaraju danu/grupi misica, cilju korisnika, I MORAJU biti izvodljive u kontekstu {tip_treninga}
- Svaki trening dan treba da ima 4-6 vezbi
- Za svaku vezbu navedi serije i ponavljanja (npr. "3 serije x 10 ponavljanja")
- Ako je vezba iz sacuvanih vezbi korisnika, oznaci sa "izvor": "sacuvan", inace "izvor": "predlog"

Vrati ISKLJUCIVO validan JSON, bez ikakvog dodatnog teksta ili markdown blokova.

Format:
{{
  "tip_splita": "kratak opis izabranog splita i zasto",
  "dani": [
    {{
      "dan": "Ponedeljak",
      "tip_treninga": "npr. Gornji deo tela, ili Odmor",
      "je_odmor": false,
      "vezbe": [
        {{"naziv": "string", "grupa_misica": "string", "serije_i_ponavljanja": "string", "izvor": "sacuvan ili predlog", "exercise_id": broj ili null}}
      ]
    }}
  ]
}}"""

TIP_SPECIFIKACIJE = {
    "teretana": "Koristi ISKLJUCIVO vezbe koje zahtevaju teretanu i opremu: bucice, sipke/olimpijske sipke, sprave (cable, leg press, lat pulldown, itd.), klupe. Ne predlazi cisto telesne vezbe osim ako su deo zagrevanja.",
    "street_workout": "Koristi ISKLJUCIVO vezbe sa sopstvenom tezinom tela (calisthenics) koje se mogu raditi na otvorenom/u parku ili kod kuce: sklekovi, zgibovi (ako ima sipku), dips, cucnjevi bez tegova, planke, pistol squats, muscle-up progresije, itd. Bez tegova, bucica ili sprava."
}


def generate_single_plan(broj_dana: int, cilj: str, saved_exercises: list, tip_treninga: str) -> dict:
    exercises_text = "\n".join([
        f"- ID {e['id']}: {e['naziv_vezbe']} ({e['grupa_misica']}, {e['serije_i_ponavljanja']})"
        for e in saved_exercises
    ]) if saved_exercises else "Nema sacuvanih vezbi."

    user_message = f"""Cilj korisnika: {cilj}
Broj treninga nedeljno: {broj_dana}

Sacuvane vezbe korisnika:
{exercises_text}

Napravi nedeljni plan treninga za {tip_treninga}."""

    system_prompt = SYSTEM_PROMPT_TEMPLATE.format(
        broj_dana=broj_dana,
        tip_treninga=tip_treninga.replace("_", " "),
        tip_specifikacija=TIP_SPECIFIKACIJE[tip_treninga],
    )

    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=3000,
        system=system_prompt,
        messages=[{"role": "user", "content": user_message}],
    )

    raw_text = message.content[0].text.strip()
    if raw_text.startswith("```"):
        raw_text = raw_text.strip("`").replace("json", "", 1).strip()

    return json.loads(raw_text)


def generate_weekly_workout_plan(broj_dana: int, cilj: str, saved_exercises: list) -> dict:
    teretana_plan = generate_single_plan(broj_dana, cilj, saved_exercises, "teretana")
    street_plan = generate_single_plan(broj_dana, cilj, saved_exercises, "street_workout")

    return {
        "teretana": teretana_plan,
        "street_workout": street_plan,
    }