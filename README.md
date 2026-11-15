# ReelFuel

A personal nutrition and training app. Share a TikTok or Instagram reel with the app. The backend downloads it, transcribes it, and an AI extracts a **recipe** or an **exercise**. The result goes into your library, meal plan, workout plan and daily log.

Principle: **automation-first**, so you type as little as possible:
- The meal plan is the default log ("I ate it").
- Reminders come at meal times.
- Calories come from a photo, your voice or a barcode.
- A new weekly plan is made automatically.

## Tech stack
- **Mobile**: Expo SDK 57, Expo Router, React Native, TypeScript. EAS builds (development and preview APK), not Expo Go.
- **Backend**: Python 3.13, FastAPI, SQLAlchemy + SQLite.
- **AI/ML**:
  - Claude Haiku 4.5 (Anthropic API, with tool calling)
  - Whisper `small`, runs locally on CPU
  - MediaPipe Pose
- **Download**: yt-dlp + FFmpeg. Only an allowlist of Instagram and TikTok links is accepted.
- **Hosting**: Hetzner Cloud VPS (Ubuntu 24.04), Caddy (HTTPS), systemd, free DuckDNS subdomain.

## Features
- **Reel import**:
  - Share the reel, or copy its link and the app offers it from the clipboard.
  - The app sorts it as a recipe or an exercise.
  - The result waits in a "Ready for review" list.
- **Today**:
  - Calorie ring and protein bar.
  - Meals from the plan: "I ate it", "Something else" or "I skipped it".
  - Today's workout.
  - Weekly plan status and calorie-target correction suggestions.
- **Meal logging**:
  - From a photo or your voice ("I had two eggs and bread").
  - From a barcode. Product data comes from Open Food Facts. For an unknown product, the AI reads a photo of the nutrition label.
  - From a typed name (AI estimate), or fully by hand.
- **Food**:
  - AI weekly meal plan by date.
  - Recipe library.
  - Shopping list, made from the plan or from a recipe.
- **Training**:
  - Workout schedule (gym or outdoor).
  - Your saved exercises, with a catalog GIF, the muscles used on a body diagram, and step-by-step instructions.
  - Your workouts can be added to Google Calendar.
- **Me**:
  - Profile and goals.
  - Weight tracking with a chart, and a weekly report.
  - Reminders.
  - Database backup.
  - A chat assistant that can change the plan and profile through tools.

Calorie target: Mifflin-St Jeor + activity level + goal + accepted corrections. It is computed in one place only, `get_dnevni_cilj`. Protein target: g/kg of body weight, based on the goal.

## Architecture
```
Phone (APK) --HTTPS, X-API-Key--> Caddy (443) --> uvicorn 127.0.0.1:8000 --> SQLite
                                                    +- yt-dlp + FFmpeg
                                                    +- Whisper (CPU)
                                                    +- MediaPipe Pose
                                                    +- Anthropic API
```
The backend runs 24/7 on the server. For development, it can also run on a laptop on the same Wi-Fi network as the phone.

## Repository layout
```
ReelFuel/
├─ start.bat / start.ps1     # one click: local backend + Expo
├─ AGENTS.md                 # rules for AI coding agents
├─ CONTEXT.md                # detailed project state, routes, known issues
├─ deploy/                   # server scripts + step-by-step guide (deploy/README.md)
├─ scripts/                  # exercise catalog download, app icons, Whisper threshold check
├─ backend/                  # FastAPI
│  ├─ app/main.py            # routers, API key, CORS, rate limit, init_db
│  ├─ app/core/              # security, URL allowlist, rate limit
│  ├─ app/api/routes/        # thin HTTP layer
│  ├─ app/services/          # logic (LLM, download, Whisper, plans, ...)
│  ├─ app/models/database.py # SQLAlchemy models
│  └─ tests/                 # pytest
└─ mobile/                   # Expo app
   ├─ __tests__/             # jest tests
   └─ src/
      ├─ app/                # screens; (tabs)/ = Today, Food, +, Training, Me
      ├─ components/         # ui.tsx, hrana/, trening/, ...
      ├─ services/           # api.ts, apiConfig.ts, notifications.ts, ...
      ├─ styles/common.ts
      └─ theme.ts
```
The source code uses Serbian names for fields, routes and screens (`tezina_kg`, `/dan`, `zamena.tsx`), and the UI text is in Serbian.

## Running locally
**Easiest**: double-click `start.bat`. It starts the backend and Expo, and prints the address for the phone.

By hand (PowerShell):
```powershell
# Backend
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt -r requirements-dev.txt
python ..\scripts\exercisedb_katalog.py          # exercise catalog (not in git), once after cloning
uvicorn app.main:app --reload --host 0.0.0.0     # Swagger: http://localhost:8000/docs
python -m pytest -q                              # tests

# Mobile
cd mobile
npm install
npx expo start -c
npx tsc --noEmit
npm test
eas build --profile development --platform android   # after a change to native code
```
The MediaPipe model `backend/models/pose_landmarker.task` is not in git. Download it separately.

Env files are never committed. Only the `.env.example` files are in git.
- `backend/.env`:
  - `ANTHROPIC_API_KEY`
  - `APP_SECRET_KEY` (at least 16 characters)
  - server only: `DOCS`, `CORS_ORIGINS`, `LIMIT_AI_NA_SAT`, `LIMIT_OBRADA_NA_SAT` (see `backend/.env.example`)
- `mobile/.env`:
  - `EXPO_PUBLIC_API_KEY`: same value as `APP_SECRET_KEY`
  - `EXPO_PUBLIC_API_URL`: fallback only. The development build finds the laptop by itself.

## Server and standalone APK
The full step-by-step guide (in Serbian) is in `deploy/README.md`. It covers the Hetzner server, the DuckDNS domain, the first upload of the database, and backups.
```powershell
.\deploy\posalji.ps1 -Server <IP>                           # deploy a new backend version (last commit)
ssh root@<IP> "journalctl -u reelfuel -n 100 --no-pager"    # server logs
```
On the server:
- `/docs` is turned off and CORS is off.
- Expensive requests are limited per hour (AI calls and reel processing).
- A database backup runs every day at 03:30.

The **preview** APK has all the JavaScript inside it, so it works without the laptop. Its server address and key are stored in EAS environment variables, because `.env` is not uploaded:
```powershell
cd mobile
eas env:create --environment preview --name EXPO_PUBLIC_API_URL --value https://<DOMAIN> --visibility plaintext
eas env:create --environment preview --name EXPO_PUBLIC_API_KEY --value <APP_SECRET_KEY> --visibility sensitive
eas build --profile preview --platform android
```

## Tests
- **Backend**: pytest, 207 tests, about 95% coverage. The AI and the internet are replaced by fakes in the tests, and each test uses a temporary database.
- **Mobile**: jest + jest-expo + React Native Testing Library, 136 tests, about 23% coverage. They include a contract test that records every API request made by `api.ts`.

## Limitations
- The app has one user and a shared `X-API-Key`. This is not real authentication, because the key is inside the APK. Set a monthly spend limit in the Anthropic console.
- Instagram often blocks datacenter IP addresses, so downloading a reel on the server can fail.
- Some Instagram reels have no audio. The app then uses the caption.
- Whisper sometimes invents text on music or silence. Suspicious segments are dropped.
- The free ExerciseDB catalog has small GIFs (180p) and is missing some basic exercises.

## Costs
- Server: Hetzner CX23, about €6/month + VAT.
- Whisper and MediaPipe run on the server at no extra cost.
- Claude Haiku costs about $0.003–0.004 for each reel processed.
