import logging
import threading
import time
from datetime import datetime, timedelta

from app.models.database import SessionLocal, MealPlan

log = logging.getLogger("nedelja")
_lock = threading.Lock()
_state = {"running": False, "last_fail": 0.0}
RETRY_SECONDS = 30 * 60


def _week_start(d):
    return d - timedelta(days=d.weekday())


def plan_is_current(db) -> bool:
    last = db.query(MealPlan).order_by(MealPlan.id.desc()).first()
    if not last or not last.created_at:
        return False
    return _week_start(last.created_at.date()) >= _week_start(datetime.utcnow().date())


def current_status(db) -> str:
    if _state["running"]:
        return "u_toku"
    if plan_is_current(db):
        return "azurno"
    if time.time() - _state["last_fail"] < RETRY_SECONDS:
        return "greska"
    return "treba"


def try_start(force: bool = False) -> str:
    with _lock:
        if _state["running"]:
            return "u_toku"
        if force:
            _state["last_fail"] = 0.0
        elif time.time() - _state["last_fail"] < RETRY_SECONDS:
            return "greska"
        _state["running"] = True
        return "pokrenuto"


def osvezi_nedelju():
    from app.api.routes.meal_plan import generate_plan as gen_meal
    from app.api.routes.workout_plan import generate_plan as gen_workout
    from app.api.routes.shopping_list import generate as gen_shopping

    db = SessionLocal()
    try:
        gen_meal(db)
        for fn in (gen_workout, gen_shopping):
            try:
                fn(db)
            except Exception:
                log.exception("Deo nedeljnog osvezavanja nije uspeo: %s", fn.__module__)
    except Exception:
        log.exception("Nedeljno osvezavanje plana nije uspelo")
        _state["last_fail"] = time.time()
    finally:
        db.close()
        _state["running"] = False