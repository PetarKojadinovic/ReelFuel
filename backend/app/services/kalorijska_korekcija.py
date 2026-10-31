from datetime import date, datetime, timedelta

from app.models.database import KalorijskaKorekcija, WeightLog
from app.services.daily_nutrition import dnevni_cilj, kcal_offset

STEP = 100
MAX_OFFSET = 300
MIN_DAYS_BETWEEN = 7
MIN_KCAL = {"muski": 1500, "zenski": 1200}
# Zeljeni raspon promene tezine u % telesne mase nedeljno (orijentaciono)
TARGET = {"mrsavljenje": (-1.0, -0.25), "odrzavanje": (-0.25, 0.25), "dobijanje_mise": (0.1, 0.5)}
CILJ_OPIS = {
    "mrsavljenje": "gubitak od 0.25 do 1% telesne mase nedeljno",
    "odrzavanje": "promena do 0.25% nedeljno",
    "dobijanje_mise": "porast od 0.1 do 0.5% nedeljno",
}


def _slope_kg_per_week(points):
    n = len(points)
    x = [(d - points[0][0]).days for d, _ in points]
    y = [kg for _, kg in points]
    mx, my = sum(x) / n, sum(y) / n
    den = sum((xi - mx) ** 2 for xi in x)
    if den == 0:
        return None
    return sum((xi - mx) * (yi - my) for xi, yi in zip(x, y)) / den * 7


def _weights(db):
    since = (date.today() - timedelta(days=14)).isoformat()
    rows = db.query(WeightLog).filter(WeightLog.datum >= since).order_by(WeightLog.datum.asc()).all()
    pts = []
    for r in rows:
        try:
            pts.append((date.fromisoformat(r.datum), float(r.tezina_kg)))
        except (ValueError, TypeError):
            continue
    return pts


def _payload(row, base, offset):
    return {
        "id": row.id,
        "delta": row.delta,
        "razlog": row.razlog,
        "trend_kg_nedeljno": row.tezina_trend,
        "dnevni_cilj_pre": base + offset,
        "dnevni_cilj_posle": base + offset + row.delta,
    }


def _napravi_predlog(db, profile, base, offset):
    if not profile.godine or profile.godine < 18:
        return None

    last = db.query(KalorijskaKorekcija).order_by(KalorijskaKorekcija.created_at.desc()).first()
    if last and (datetime.utcnow() - last.created_at) < timedelta(days=MIN_DAYS_BETWEEN):
        return None

    pts = _weights(db)
    if len(pts) < 3 or (pts[-1][0] - pts[0][0]).days < 7:
        return None
    slope = _slope_kg_per_week(pts)
    if slope is None:
        return None
    tezina = pts[-1][1]
    pct = slope / tezina * 100

    low, high = TARGET.get(profile.cilj, TARGET["odrzavanje"])
    if low <= pct <= high:
        return None
    delta = -STEP if pct > high else STEP

    if abs(offset + delta) > MAX_OFFSET:
        return None

    if delta < 0:
        bmi = tezina / ((profile.visina_cm / 100) ** 2)
        if bmi < 18.5:
            return None
        if profile.cilj == "mrsavljenje" and profile.ciljna_tezina_kg and tezina <= profile.ciljna_tezina_kg:
            return None
        if base + offset + delta < MIN_KCAL.get(profile.pol, 1500):
            return None

    if abs(slope) < 0.05:
        opis = "Tvoja težina se skoro ne menja"
    else:
        opis = f"Tvoja težina {'opada' if slope < 0 else 'raste'} oko {abs(slope):.2f} kg nedeljno ({abs(pct):.2f}% telesne mase)"
    razlog = f"{opis}, a orijentacioni raspon za tvoj cilj je {CILJ_OPIS.get(profile.cilj, '')}."

    row = KalorijskaKorekcija(delta=delta, razlog=razlog, tezina_trend=round(slope, 2), status="predlog")
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def get_state(db):
    from app.models.database import UserProfile

    profile = db.query(UserProfile).first()
    base = dnevni_cilj(profile)
    if base is None:
        return {"predlog": None, "korekcija": 0}
    offset = kcal_offset(db)

    pending = (
        db.query(KalorijskaKorekcija)
        .filter(KalorijskaKorekcija.status == "predlog")
        .order_by(KalorijskaKorekcija.id.desc())
        .first()
    )
    row = pending or _napravi_predlog(db, profile, base, offset)
    return {"predlog": _payload(row, base, offset) if row else None, "korekcija": offset}


def odgovori(db, korekcija_id: int, prihvati: bool):
    row = db.get(KalorijskaKorekcija, korekcija_id)
    if row and row.status == "predlog":
        row.status = "prihvaceno" if prihvati else "odbijeno"
        db.commit()
    return get_state(db)


def reset(db):
    db.query(KalorijskaKorekcija).filter(KalorijskaKorekcija.status == "prihvaceno").update({"status": "ponisteno"})
    db.commit()
    return get_state(db)