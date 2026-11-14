import hmac
import os

from dotenv import load_dotenv
from fastapi import Header, HTTPException

load_dotenv()

APP_SECRET_KEY = os.getenv("APP_SECRET_KEY") or ""

# Server ne sme da radi bez kljuca: slusa na 0.0.0.0, pa bi bez provere svako
# u istoj mrezi mogao da cita podatke i trosi Anthropic kredit.
if len(APP_SECRET_KEY) < 16:
    raise RuntimeError(
        "APP_SECRET_KEY nije podesen ili je prekratak (min 16 znakova) u backend/.env. "
        "Generisi ga: python -c \"import secrets; print(secrets.token_urlsafe(32))\""
    )


def kljuc_ispravan(x_api_key: str | None) -> bool:
    return bool(x_api_key) and hmac.compare_digest(x_api_key.encode(), APP_SECRET_KEY.encode())


async def verify_api_key(x_api_key: str = Header(None)):
    if not kljuc_ispravan(x_api_key):
        raise HTTPException(status_code=401, detail="Nevazeci ili nedostajuci API kljuc")
