"""Unos obroka glasom ili kratkim opisom: "pojeo sam dva jaja i parče hleba" -> naziv, kalorije, proteini.

Glas: snimak -> Whisper (lokalno) -> tekst -> Claude proceni hranu.
Tekst se ne čuva; šalje se samo Anthropic API-ju (isto kao slika obroka).
"""
import logging
import os
import tempfile

from anthropic import Anthropic
from dotenv import load_dotenv

from app.services.daily_nutrition import to_g
from app.services.llm_utils import parse_json

load_dotenv()
log = logging.getLogger("glas")
client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

MAX_TEKST = 1000
MAX_STAVKI = 15

# Uvod za Whisper: latinica i rečnik hrane, da bi prepoznavanje išlo ka "jaja, hleb, piletina"
WHISPER_UVOD = "Pojeo sam dva jaja, parče hleba, jogurt i piletinu sa pirinčem."

SYSTEM_PROMPT = """Korisnik opisuje šta je pojeo (tekst može biti prepoznat iz govora, sa greškama, latinicom ili ćirilicom).
Izdvoj svaku namirnicu ili jelo i proceni kalorije i proteine za POMENUTU količinu.
Pravila:
- Ako količina nije rečena, uzmi uobičajenu porciju za odraslu osobu.
- "naziv" svake stavke kratko, na srpskom, LATINICOM, sa količinom (npr. "2 jaja", "parče hleba").
- "naziv_obroka": kratak zbirni naziv za ceo obrok, latinicom (npr. "Jaja i hleb").
- Ako u tekstu nema hrane ni pića, vrati "stavke": [].
- Brojevi su procena; ne izmišljaj hranu koja nije pomenuta.
Vrati ISKLJUČIVO JSON:
{"naziv_obroka": string|null, "stavke": [{"naziv": string, "kalorije": broj, "proteini_g": broj}]}"""


def _kcal(v):
    try:
        k = int(round(float(v)))
    except (TypeError, ValueError):
        return None
    return k if 0 <= k <= 5000 else None


def proceni_opis(tekst: str) -> dict:
    """Iz opisa obroka vrati {tekst, naziv, kalorije, proteini_g, stavke}. Prazne stavke = nema hrane."""
    tekst = (tekst or "").strip()[:MAX_TEKST]
    prazno = {"tekst": tekst, "naziv": None, "kalorije": None, "proteini_g": None, "stavke": []}
    if not tekst:
        return prazno

    msg = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=800,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": tekst}],
    )
    data = parse_json(msg.content[0].text)

    stavke = []
    for s in (data.get("stavke") or [])[:MAX_STAVKI]:
        if not isinstance(s, dict):
            continue
        naziv = str(s.get("naziv") or "").strip()[:120]
        kcal = _kcal(s.get("kalorije"))
        if not naziv or kcal is None:
            continue
        stavke.append({"naziv": naziv, "kalorije": kcal, "proteini_g": to_g(s.get("proteini_g"))})
    if not stavke:
        return prazno

    ukupno = sum(s["kalorije"] for s in stavke)
    proteini = None
    if all(s["proteini_g"] is not None for s in stavke):
        proteini = round(sum(s["proteini_g"] for s in stavke), 1)
    naziv = str(data.get("naziv_obroka") or "").strip()[:120] or ", ".join(s["naziv"] for s in stavke)[:120]
    return {
        "tekst": tekst,
        "naziv": naziv,
        "kalorije": min(ukupno, 5000),
        "proteini_g": proteini,
        "stavke": stavke,
    }


def proceni_snimak(sadrzaj: bytes, ekstenzija: str = ".m4a") -> dict:
    """Snimak glasa -> Whisper -> proceni_opis. Snimak se briše odmah posle prepoznavanja."""
    from app.services.transcription import transcribe_audio  # težak import (torch), samo kad zatreba

    fd, path = tempfile.mkstemp(suffix=ekstenzija, prefix="glas_")
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(sadrzaj)
        tekst = transcribe_audio(path, initial_prompt=WHISPER_UVOD)
    finally:
        try:
            os.remove(path)
        except OSError:
            log.warning("Snimak nije obrisan")
    return proceni_opis(tekst)
