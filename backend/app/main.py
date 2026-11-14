import math
import os

from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.security import verify_api_key, kljuc_ispravan
from app.core import rate_limit
from app.models.database import init_db, SessionLocal, IngestJob
from app.services.backup import dnevna_kopija
from app.api.routes import (
    recipe,
    profile,
    meal_plan,
    chat,
    food_log,
    exercise,
    workout_plan,
    workout_log,
    weight_log,
    shopping_list,
    report,
    ingest,
    dan,
    nedelja,
    korekcija,
    plan,
    proizvod,
    backup,
)



def docs_ukljucen() -> bool:
    """Swagger (/docs) radi bez ključa i otkriva sve rute -> na serveru DOCS=0."""
    return os.getenv("DOCS", "1").strip().lower() not in ("0", "false", "ne")


def cors_adrese() -> list[str]:
    """CORS treba samo za web verziju u browseru (APK ga ne koristi). Prazno = isključen.

    Lokalno je podrazumevano "*" (web testiranje); na serveru CORS_ORIGINS= (prazno).
    """
    return [a.strip() for a in os.getenv("CORS_ORIGINS", "*").split(",") if a.strip()]


_docs = docs_ukljucen()
app = FastAPI(
    title="ReelFuel API",
    dependencies=[Depends(verify_api_key)],
    docs_url="/docs" if _docs else None,
    redoc_url="/redoc" if _docs else None,
    openapi_url="/openapi.json" if _docs else None,
)

if cors_adrese():
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_adrese(),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


@app.middleware("http")
async def ogranici_skupe_zahteve(request: Request, call_next):
    grupa = rate_limit.grupa_za(request.method, request.url.path, request.url.query)
    if grupa and kljuc_ispravan(request.headers.get("x-api-key")):
        cekaj = rate_limit.ogranicenje.pokusaj(grupa, rate_limit.LIMITI[grupa])
        if cekaj is not None:
            return JSONResponse(
                status_code=429,
                content={"detail": f"Previše zahteva za kratko vreme. Pokušaj ponovo za {math.ceil(cekaj / 60)} min."},
                headers={"Retry-After": str(cekaj)},
            )
    return await call_next(request)


@app.on_event("startup")
def on_startup():
    dnevna_kopija()  # pre init_db, da kopija bude stanje pre eventualnog ALTER TABLE
    init_db()
    db = SessionLocal()
    try:
        db.query(IngestJob).filter(IngestJob.status == "u_toku").update(
            {
                "status": "greska",
                "faza": "",
                "greska": "Obrada je prekinuta restartom servera. Pokušaj ponovo.",
            }
        )
        db.commit()
    finally:
        db.close()


app.include_router(recipe.router, prefix="/recipe", tags=["recipe"])
app.include_router(profile.router, prefix="/profile", tags=["profile"])
app.include_router(meal_plan.router, prefix="/mealplan", tags=["mealplan"])
app.include_router(chat.router, prefix="/chat", tags=["chat"])
app.include_router(food_log.router, prefix="/log", tags=["log"])
app.include_router(exercise.router, prefix="/exercise", tags=["exercise"])
app.include_router(workout_plan.router, prefix="/workoutplan", tags=["workoutplan"])
app.include_router(workout_log.router, prefix="/workoutlog", tags=["workoutlog"])
app.include_router(weight_log.router, prefix="/weightlog", tags=["weightlog"])
app.include_router(shopping_list.router, prefix="/shoppinglist", tags=["shoppinglist"])
app.include_router(report.router, prefix="/report", tags=["report"])
app.include_router(ingest.router, prefix="/ingest", tags=["ingest"])
app.include_router(dan.router, prefix="/dan", tags=["dan"])
app.include_router(nedelja.router, prefix="/nedelja", tags=["nedelja"])
app.include_router(korekcija.router, prefix="/korekcija", tags=["korekcija"])
app.include_router(plan.router, prefix="/plan", tags=["plan"])
app.include_router(proizvod.router, prefix="/proizvod", tags=["proizvod"])
app.include_router(backup.router, prefix="/backup", tags=["backup"])


@app.get("/")
def root():
    return {"status": "ReelFuel backend radi"}