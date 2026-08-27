import os
import json
from anthropic import Anthropic
from dotenv import load_dotenv
import base64


load_dotenv()

client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

SYSTEM_PROMPT = """Ti si asistent koji izvlaci strukturisan recept iz VIŠE izvora istog videa
sa TikTok/Instagram: audio transkripta, opisa objave (caption), i frejmova snimljenih sa videa
(na kojima moze pisati tekst sastojaka/koraka).

Sastojci i koraci mogu biti izgovoreni, napisani u opisu, ili ispisani preko slike na snimku —
koristi BILO KOJI izvor gde ih nadjes. Ako se izvori razlikuju, veruj onom koji izgleda precizniji
(npr. pisani tekst > nejasan izgovor).

Vrati ISKLJUČIVO validan JSON, bez dodatnog teksta ili markdown blokova.

Format:
{
  "naziv_jela": "string",
  "sastojci": [{"naziv": "string", "kolicina": "string"}],
  "koraci": ["string"],
  "priblizne_kalorije": "string ili null ako se ne moze proceniti"
}"""

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


def _image_block(path: str) -> dict:
    with open(path, "rb") as f:
        data = base64.standard_b64encode(f.read()).decode("utf-8")
    return {
        "type": "image",
        "source": {"type": "base64", "media_type": "image/jpeg", "data": data},
    }


def extract_recipe(transcript: str = "", caption: str = "", frame_paths: list[str] | None = None) -> dict:
    content = [{
        "type": "text",
        "text": (
            f"Audio transkript: {transcript or '(nema govora / tisina)'}\n\n"
            f"Opis objave: {caption or '(nema opisa)'}"
        ),
    }]

    if frame_paths:
        for path in frame_paths:
            content.append(_image_block(path))

    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1000,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": content}],
    )

    raw_text = message.content[0].text.strip()
    if raw_text.startswith("```"):
        raw_text = raw_text.strip("`").replace("json", "", 1).strip()

    return json.loads(raw_text)