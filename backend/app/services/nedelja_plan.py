import logging
import threading
import time
from datetime import date

from app.models.database import SessionLocal, MealPlan
from app.services.daily_nutrition import week_start

log = logging.getLogger("nedelja")
_lock = threading.Lock()
_state = {"running": False, "last_fail": 0.0}
RETRY_SECONDS = 30 * 60


def plan_is_current(db, danas: date | None = None) -> bool:
    """Da li najnoviji jelovnik pokriva tekuću nedelju (po lokalnom datumu, kao /mealplan/generate)."""
    last = db.query(MealPlan).order_by(MealPlan.id.desc()).first()
    if not last:
        return False
    od = (last.plan_data or {}).get("nedelja_od")
    if od:
        try:
            nedelja = date.fromisoformat(od)
        except ValueError:
            nedelja = None
    else:
        nedelja = None
    if nedelja is None:
        if not last.created_at:
            return False
        nedelja = week_start(last.created_at.date())
    return nedelja >= week_start(danas or date.today())


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