from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import date, timedelta
from app.models.database import get_db, FoodLogEntry, WorkoutLogEntry, WeightLog, UserProfile
from app.services.daily_nutrition import day_summary
from app.services.daily_nutrition import get_dnevni_cilj

router = APIRouter()

ACTIVITY_MULTIPLIERS = {"nizak": 1.2, "srednji": 1.55, "visok": 1.725}


@router.get("/weekly")
def get_weekly_report(db: Session = Depends(get_db)):
    profile = db.query(UserProfile).first()
    if not profile:
        return {"exists": False}

    dnevni_cilj = get_dnevni_cilj(db)

    today = date.today()
    last_7_dates = [(today - timedelta(days=i)).isoformat() for i in range(6, -1, -1)]

    # Ishrana - dani gde je uneto nesto i unutar +/- 150 kcal od cilja
    dani_pogodjen_cilj = 0
    dani_sa_unosom = 0
    for d in last_7_dates:
        entries = db.query(FoodLogEntry).filter(FoodLogEntry.datum == d).all()
        if entries:
            dani_sa_unosom += 1
            ukupno = day_summary(db, d, "23:59")["ukupno"]
            if abs(ukupno - dnevni_cilj) <= 150:
                dani_pogodjen_cilj += 1

    # Trening - broj dana sa bar jednim unosom u dnevniku treninga
    dani_treninga = 0
    for d in last_7_dates:
        count = db.query(WorkoutLogEntry).filter(WorkoutLogEntry.datum == d).count()
        if count > 0:
            dani_treninga += 1

    planirano_treninga = profile.broj_treninga_nedeljno or 4

    # Tezina - trend u poslednjih 7 dana
    weight_entries = (
        db.query(WeightLog)
        .filter(WeightLog.datum >= last_7_dates[0])
        .order_by(WeightLog.datum.asc())
        .all()
    )

    tezina_pocetak = weight_entries[0].tezina_kg if weight_entries else None
    tezina_kraj = weight_entries[-1].tezina_kg if weight_entries else None
    tezina_promena = None
    if tezina_pocetak is not None and tezina_kraj is not None:
        tezina_promena = round(tezina_kraj - tezina_pocetak, 1)

    return {
        "exists": True,
        "period": {"od": last_7_dates[0], "do": last_7_dates[-1]},
        "ishrana": {
            "dani_pogodjen_cilj": dani_pogodjen_cilj,
            "dani_sa_unosom": dani_sa_unosom,
            "ukupno_dana": 7,
            "dnevni_cilj_kalorija": dnevni_cilj,
        },
        "trening": {
            "odradjeno_dana": dani_treninga,
            "planirano_dana": planirano_treninga,
        },
        "tezina": {
            "pocetna": tezina_pocetak,
            "trenutna": tezina_kraj,
            "promena_kg": tezina_promena,
            "ciljna": profile.ciljna_tezina_kg,
        },
    }