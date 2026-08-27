import os
import json
import base64
from anthropic import Anthropic
from dotenv import load_dotenv

load_dotenv()

client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

SYSTEM_PROMPT = """Ti si fitnes asistent koji izvlaci strukturisane podatke o vezbi iz VISE izvora
istog videa sa TikTok/Instagram: audio transkripta, opisa objave (caption), analize pokreta,
i frejmova snimljenih sa videa (na kojima moze pisati naziv vezbe, serije/ponavljanja ili grupa misica).

Podaci mogu biti izgovoreni, napisani u opisu, ili ispisani preko slike na snimku (cest slucaj kad
je pozadinska muzika a tekst vezbe je overlay na ekranu) - koristi BILO KOJI izvor gde ih nadjes.

Zakljuci:
- Naziv vezbe (iz bilo kog izvora; ako se nigde ne pominje, pokusaj da pretpostavis iz konteksta slika, inace "Nepoznata vezba")
- Grupu misica koja se najverovatnije koristi
- Serije i ponavljanja (prioritet: ono sto pise na ekranu/u opisu > detektovan broj iz analize pokreta > izgovoreno)

Vrati ISKLJUCIVO validan JSON, bez dodatnog teksta ili markdown blokova.

Format:
{
  "naziv_vezbe": "string",
  "grupa_misica": "string",
  "serije_i_ponavljanja": "string opis, npr. '3 serije x 12 ponavljanja'"
}"""


def _image_block(path: str) -> dict:
    with open(path, "rb") as f:
        data = base64.standard_b64encode(f.read()).decode("utf-8")
    return {
        "type": "image",
        "source": {"type": "base64", "media_type": "image/jpeg", "data": data},
    }


def extract_exercise(
    transcript: str,
    pose_result: dict,
    caption: str = "",
    frame_paths: list[str] | None = None,
) -> dict:
    content = [{
        "type": "text",
        "text": (
            f"Transkript: {transcript or '(nema govora)'}\n\n"
            f"Opis objave: {caption or '(nema opisa)'}\n\n"
            f"Analiza pokreta: {json.dumps(pose_result, ensure_ascii=False)}"
        ),
    }]

    if frame_paths:
        for path in frame_paths:
            content.append(_image_block(path))

    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=500,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": content}],
    )

    raw_text = message.content[0].text.strip()
    if raw_text.startswith("```"):
        raw_text = raw_text.strip("`").replace("json", "", 1).strip()

    return json.loads(raw_text)