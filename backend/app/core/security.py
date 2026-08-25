import os
from fastapi import Header, HTTPException
from dotenv import load_dotenv

load_dotenv()

APP_SECRET_KEY = os.getenv("APP_SECRET_KEY")


async def verify_api_key(x_api_key: str = Header(None)):
    if not APP_SECRET_KEY:
        return  # ako kljuc nije podesen, preskace se provera (za lokalni dev)
    if x_api_key != APP_SECRET_KEY:
        raise HTTPException(status_code=401, detail="Nevazeci ili nedostajuci API kljuc")