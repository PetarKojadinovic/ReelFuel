from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from app.core.security import verify_api_key
from app.api.routes import recipe, profile
from app.models.database import init_db
from app.api.routes import recipe, profile, meal_plan, chat, food_log, exercise, workout_plan, workout_log, weight_log, shopping_list, report

app = FastAPI(title="ReelFuel API", dependencies=[Depends(verify_api_key)])

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    init_db()

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

@app.get("/")
def root():
    return {"status": "ReelFuel backend radi"}