"""Kalorije proizvoda po bar-kodu.

1) lokalni keš (tabela Proizvod)
2) Open Food Facts (besplatna otvorena baza, fiksna adresa — nije proizvoljan URL)
3) ako nema: korisnik slika tabelu nutritivnih vrednosti → Claude je pročita
"""
import logging
import os
import re
from typing import Optional

import httpx
from anthropic import Anthropic
from dotenv import load_dotenv

from app.models.database import Proizvod
from app.services.llm_utils import parse_json

load_dotenv()
log = logging.getLogger("proizvod")
client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

OFF_URL = "https://world.openfoodfacts.org/api/v2/product/{barkod}.json"
OFF_FIELDS = "product_name,product_name_sr,product_name_sl,product_name_en,brands,nutriments,serving_quantity,product_quantity"
USER_AGENT = "ReelFuel/1.0 (licni projekat)"

BARKOD_RE = re.compile(r"^\d{8,14}$")


def _num(v) -> Optional[float]:
    try:
        f = float(v)
        return f if f > 0 else None
    except (TypeError, ValueError):
        return None


def to_dict(p: Proizvod) -> dict:
    return {
        "pronadjen": True,
        "barkod": p.barkod,
        "naziv": p.naziv,
        "kcal_100g": round(p.kcal_100g) if p.kcal_100g is not None else None,
        "porcija_g": p.porcija_g,
        "paket_g": p.paket_g,
        "izvor": p.izvor,
    }


def _iz_open_food_facts(barkod: str) -> Optional[dict]:
    try:
        r = httpx.get(
            OFF_URL.format(barkod=barkod),
            params={"fields": OFF_FIELDS},
            headers={"User-Agent": USER_AGENT},
            timeout=8.0,
            follow_redirects=False,
        )
    except httpx.HTTPError:
        log.warning("Open Food Facts nije dostupan")
        return None
    if r.status_code != 200:
        return None
    data = r.json()
    if data.get("status") != 1:
        return None
    p = data.get("product") or {}
    n = p.get("nutriments") or {}

    kcal = _num(n.get("energy-kcal_100g"))
    if kcal is None:
        kj = _num(n.get("energy-kj_100g")) or _num(n.get("energy_100g"))
        kcal = kj / 4.184 if kj else None
    if kcal is None:
        return None  # bez kalorija nam proizvod ne koristi

    naziv = next(
        (p.get(k) for k in ("product_name_sr", "product_name_sl", "product_name", "product_name_en") if p.get(k)),
        None,
    ) or "Proizvod"
    brend = (p.get("brands") or "").split(",")[0].strip()
    # Kratak brend ("Milka") ide ispred naziva; dugački nazivi firmi ("X SERVICES SA/NV") ne
    if brend and len(brend) <= 20 and brend.lower() not in naziv.lower():
        naziv = f"{brend} {naziv}"

    return {
        "naziv": naziv[:120],
        "kcal_100g": kcal,
        "porcija_g": _num(p.get("serving_quantity")),
        "paket_g": _num(p.get("product_quantity")),
    }


def nadji_proizvod(db, barkod: str) -> dict:
    p = db.get(Proizvod, barkod)
    if p:
        return to_dict(p)

    off = _iz_open_food_facts(barkod)
    if not off:
        return {"pronadjen": False, "barkod": barkod}

    p = Proizvod(barkod=barkod, izvor="openfoodfacts", **off)
    db.add(p)
    db.commit()
    return to_dict(p)


ETIKETA_PROMPT = """Na slici je pakovanje hrane ili tabela nutritivnih vrednosti.
Pročitaj vrednosti SA SLIKE, ne izmišljaj.
- "kcal_100g": energija u kcal na 100 g (ili 100 ml). Ako piše samo kJ, podeli sa 4.184.
  Ako je data samo vrednost po porciji i poznata je masa porcije, preračunaj na 100 g.
- "porcija_g": masa jedne porcije u gramima ako piše, inače null.
- "paket_g": neto masa pakovanja u gramima ako piše, inače null.
- "naziv": kratak naziv proizvoda ako se vidi, inače null.
Ako na slici ne možeš da pročitaš energiju, vrati "kcal_100g": null.
Vrati ISKLJUČIVO JSON: {"naziv": string|null, "kcal_100g": broj|null, "porcija_g": broj|null, "paket_g": broj|null}"""


def procitaj_etiketu(db, barkod: str, b64: str, media_type: str, naziv: Optional[str] = None) -> dict:
    msg = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=300,
        system=ETIKETA_PROMPT,
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": b64}},
                    {"type": "text", "text": "Pročitaj kalorije sa pakovanja."},
                ],
            }
        ],
    )
    data = parse_json(msg.content[0].text)
    kcal = _num(data.get("kcal_100g"))
    if kcal is None or kcal > 950:  # čista mast ima ~900 kcal/100g; više je greška čitanja
        return {"pronadjen": False, "barkod": barkod, "procitano": False}

    p = db.get(Proizvod, barkod) or Proizvod(barkod=barkod)
    p.naziv = ((naziv or "").strip() or data.get("naziv") or "Proizvod")[:120]
    p.kcal_100g = kcal
    p.porcija_g = _num(data.get("porcija_g"))
    p.paket_g = _num(data.get("paket_g"))
    p.izvor = "etiketa"
    db.merge(p)
    db.commit()
    return to_dict(db.get(Proizvod, barkod))
