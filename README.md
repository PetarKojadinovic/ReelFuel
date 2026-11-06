# ReelFuel

Lična mobilna aplikacija za ishranu i trening. Podeliš (Share) TikTok/Instagram reel → backend ga skine, transkribuje i AI izvuče **recept** ili **vežbu** → ulazi u biblioteku, plan ishrane, plan treninga i dnevnik.

Princip: **automation-first** — što manje kucanja. Plan je podrazumevani dnevnik ("Pojeo sam"), podsetnici u vreme obroka, kalorije iz slike, glasa ili bar-koda, automatski nedeljni plan.

## Tech stack
- **Mobile**: Expo SDK 57, Expo Router, React Native, TypeScript (EAS development build, ne Expo Go)
- **Backend**: Python 3.13, FastAPI, SQLAlchemy + SQLite
- **AI/ML**: Claude Haiku 4.5 (Anthropic API, tool calling), Whisper (lokalno), MediaPipe Pose
- **Preuzimanje**: yt-dlp + FFmpeg (samo Instagram/TikTok, allowlist)

## Funkcionalnosti
- **Unos iz reela**: share-intent ili link iz clipboard-a → automatska klasifikacija recept/vežba → "Spremno za pregled".
- **Danas**: krug kalorija + traka proteina, obroci iz plana ("Pojeo sam" / "Nešto drugo" / "Preskočio sam"), današnji trening.
- **Unos obroka**: slika obroka, glas ("pojeo sam dva jaja i hleb"), bar-kod (Open Food Facts + čitanje etikete), ručno.
- **Hrana**: nedeljni jelovnik po datumima (AI), recepti, lista za kupovinu (iz plana ili recepta).
- **Trening**: raspored (teretana / napolju), moje vežbe, upis treninga u Google kalendar.
- **Ja**: profil i ciljevi, praćenje težine sa grafikonom, nedeljni izveštaj, predlozi korekcije kalorijskog cilja, podsetnici, chat asistent.

Kalorijski cilj: Mifflin-St Jeor + aktivnost + cilj + prihvaćene korekcije. Cilj proteina po g/kg prema cilju.

## Struktura
```
ReelFuel/
├─ start.bat / start.ps1     # jedan klik: backend + Expo
├─ AGENTS.md                 # pravila za AI agente
├─ CONTEXT.md                # detaljno stanje projekta, rute, poznati problemi
├─ backend/                  # FastAPI
│  ├─ app/main.py            # routeri, API ključ, CORS, init_db
│  ├─ app/api/routes/        # HTTP slojevi
│  ├─ app/services/          # logika (LLM, download, whisper, planovi...)
│  ├─ app/models/database.py # SQLAlchemy modeli
│  └─ tests/                 # pytest
└─ mobile/                   # Expo aplikacija
   └─ src/
      ├─ app/                # ekrani; (tabs)/ = Danas, Hrana, +, Trening, Ja
      ├─ components/         # ui.tsx, hrana/, trening/, ...
      ├─ services/           # api.ts, apiConfig.ts, notifications.ts...
      ├─ styles/common.ts
      └─ theme.ts
```

## Pokretanje
**Najlakše**: dupli klik na `start.bat`. Pokrene backend i Expo i ispiše adresu za telefon.

Ručno (PowerShell):
```powershell
# Backend
cd backend
.\venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --host 0.0.0.0    # Swagger: http://localhost:8000/docs
python -m pytest -q                              # testovi (requirements-dev.txt)

# Mobile
cd mobile
npx expo start -c
npx tsc --noEmit
eas build --profile development --platform android   # posle izmene native dela
```

Env fajlovi (nikad u git, samo `.env.example`):
- `backend/.env`: `ANTHROPIC_API_KEY`, `APP_SECRET_KEY` (najmanje 16 znakova)
- `mobile/.env`: `EXPO_PUBLIC_API_KEY` (ista vrednost kao `APP_SECRET_KEY`), `EXPO_PUBLIC_API_URL` (rezerva; aplikacija sama nalazi laptop)

Telefon i laptop moraju biti na istoj mreži. Server radi lokalno, nije na internetu.

## Ograničenja
- Jedan korisnik, deljeni `X-API-Key` (nije prava autentikacija). Hosting, HTTPS i nalozi su planirani.
- Neki Instagram reelovi nemaju audio → koristi se opis (caption).
- Whisper ponekad izmišlja tekst na muzici/tišini; sumnjivi segmenti se odbacuju.

## Troškovi
Whisper i MediaPipe rade lokalno (besplatno). Claude Haiku: oko $0.003–0.004 po obradi reela.
