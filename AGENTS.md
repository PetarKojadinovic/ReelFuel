# AGENTS.md — pravila za AI agente na ReelFuel projektu

Pročitaj ovaj fajl PRVI, pa onda `CONTEXT.md` (šta projekat jeste, šta radi, šta je u kom stanju).
Ako postoje `mobile/AGENTS.md` i `mobile/CLAUDE.md`, to su ostaci Expo šablona — ovaj fajl ima prednost.

## 1. Ko je korisnik i kako radi
- Petar, student softverskog inženjerstva (FERI, Slovenija). Windows + **PowerShell**.
- Odgovaraj na **srpskom**. Kratko i konkretno.
- Petar **kopira kod ručno**: kada menjaš fajl, daj **ceo fajl** (ili jasno označen blok sa tačnim mestom zamene), ne "..." isečke.
- Uvek daj tačne komande za PowerShell (ne bash) kada ih predlažeš.

## 2. Tvrda pravila
1. **Tajne nikad u git.** `.env` fajlovi se ne commit-uju, samo `.env.example`. Nikad ne ispisuj, ne loguj i ne hardkoduj `ANTHROPIC_API_KEY`, `APP_SECRET_KEY`, ngrok token, IP adrese. Pre svakog commit-a: `git grep --cached -n "sk-ant-"` mora biti prazno.
2. **Ne briši bazu** (`backend/reelfuel.db`) osim kad dodaješ kolonu u postojeću tabelu (nema migracija) — i tada prvo upozori korisnika da će izgubiti podatke.
3. **Ne dodaj zavisnosti bez razloga.** Reci šta i zašto; za mobile proveri kompatibilnost sa Expo SDK 57 (`npx expo install` ili tačna verzija, npr. `expo-share-intent@8`).
4. **Ne tvrdi da nešto radi ako nije testirano.** Razlikuj "napisano" od "potvrđeno na telefonu/webu". Ako ne možeš da pokreneš, reci to.
5. **Zdravstveni podaci su osetljivi** (težina, kalorije, ciljevi). Ne šalji ih trećim stranama mimo postojećeg LLM poziva, ne loguj ih.
6. **Domen allowlist / validacija linkova**: backend sme da skida samo TikTok/Instagram (i slične dozvoljene) linkove — ne dodaj generičan "skini bilo koji URL" (SSRF rizik).
7. Kada dodaš/izmeniš funkcionalnost, **ažuriraj `CONTEXT.md`** (status, endpointi, poznati problemi).

## 3. Komande (PowerShell, iz korena repoa `C:\Users\DELL\Desktop\ReelFuel`)

**Najlakše: dupli klik na `start.bat`** (pokreće `start.ps1`): nađe IP mreže, ugasi stare procese na 8000/8081, otvori prozore "ReelFuel backend" i "ReelFuel Expo" i ispiše adresu za telefon. `start.ps1` drži u čistom ASCII (PowerShell 5.1 kvari UTF-8 bez BOM-a).

Ručno — Backend:
```powershell
cd backend
.\venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --host 0.0.0.0     # Swagger: http://localhost:8000/docs
```
Mobile:
```powershell
cd mobile
npx expo start -c            # -c je obavezno kad se menja .env (EXPO_PUBLIC_*)
npx tsc --noEmit             # provera tipova
eas build --profile development --platform android   # novi build kad se menja native (plugin, app.json, nova native lib)
```
Git provera pred push:
```powershell
git status
git grep --cached -n "sk-ant-"
```
Env promenljive:
- `backend/.env`: `ANTHROPIC_API_KEY`, `APP_SECRET_KEY` (+ ostalo iz `backend/.env.example`)
- `mobile/.env`: `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_API_KEY` (mora biti ISTA vrednost kao `APP_SECRET_KEY`)

## 4. Struktura repoa
```
ReelFuel/
├─ AGENTS.md, CONTEXT.md, README.md, .gitignore, .easignore
├─ backend/                      # FastAPI (Python 3.13)
│  ├─ app/main.py                # registruje SVE routere + verify_api_key + CORS + init_db
│  ├─ app/core/security.py       # X-API-Key provera
│  ├─ app/models/database.py     # SQLAlchemy modeli (SQLite)
│  ├─ app/api/routes/            # tanki HTTP slojevi
│  ├─ app/services/              # sva logika (LLM, download, whisper, pose, planovi...)
│  ├─ models/pose_landmarker.task# MediaPipe model (nije u gitu ako je veliki)
│  └─ requirements.txt, .env.example
└─ mobile/                       # Expo SDK 57 + Expo Router
   └─ src/
      ├─ app/                    # ekrani (file-based routing); (tabs)/ = donja navigacija
      ├─ components/             # WeightChart, NotificationHandler(.web), NedeljaIKorekcija...
      ├─ services/               # api.ts, apiConfig.ts, notifications.ts, mealTimes.ts
      ├─ styles/common.ts        # zajednički stilovi (common, typography, spacing, radius)
      ├─ theme.ts                # boje (primary #7CFF3D, secondary #1BBE6D, background #141414)
      └─ utils/date.ts
```
Ostaci Expo šablona su obrisani (2026-11-01). Ne vraćaj `themed-*`, `constants/theme.ts`, `hooks/use-*` — tema je `src/theme.ts` + `src/styles/common.ts`.
Za Expo API proveri dokumentaciju za SDK 57: https://docs.expo.dev/versions/v57.0.0/

## 5. Konvencije
- **Backend**: route fajl = samo validacija + poziv servisa; logika ide u `services/`. Svaki novi route modul **mora** da se import-uje i uključi u `main.py` (već dva puta puklo sa `NameError`). Nazivi polja/ruta su na srpskom (`tezina_kg`, `dnevni_cilj_kalorija`, `obrok_tip`).
- **Kalorijski cilj ima JEDAN izvor istine**: `get_dnevni_cilj(db)` u `services/daily_nutrition.py` (Mifflin-St Jeor + prihvaćene korekcije). Nemoj računati cilj na drugom mestu.
- **LLM**: Anthropic SDK, model `claude-haiku-4-5-20251001`. JSON odgovore parsiraj preko `llm_utils.parse_json` (modeli ponekad dodaju ```json ogradu).
- **Mobile**: svi API pozivi idu kroz `src/services/api.ts` i koriste `await getApiUrl()` + `authHeaders()`. Ne pozivaj `fetch` direktno iz ekrana. Adresa servera (`services/apiConfig.ts`): režim **auto** (podrazumevano) izvodi backend iz Expo adrese (`Constants.expoConfig.hostUri` → isti host, port 8000); režim **ručno** koristi adresu iz Podešavanja servera. `.env` `EXPO_PUBLIC_API_URL` je samo rezerva.
- **Stil**: koristi `common` / `typography` / `spacing` iz `styles/common.ts` i boje iz `theme.ts`. Ne hardkoduj boje i ne dupliraj stilove po ekranima. UI tekst je na srpskom.
- **Datumi**: `getTodayDate()` iz `utils/date.ts` (format `YYYY-MM-DD`).
- **Greške u UI**: `try/catch` + `Alert.alert("Greška", ...)`; null-safe parsiranje odgovora (`x ?? []`).

## 6. Kako se dodaje...
**Novi backend endpoint**
1. servis u `services/` → 2. route u `api/routes/` → 3. `include_router` + import u `main.py` → 4. ako treba nova kolona/tabela: izmena u `models/database.py` (+ upozorenje o brisanju `reelfuel.db`) → 5. funkcija u `mobile/src/services/api.ts` → 6. upiši u `CONTEXT.md`.

**Novi mobile ekran**
1. fajl u `mobile/src/app/` (ili `(tabs)/`) → 2. ako je van tabova, dodaj `Stack.Screen` u `src/app/_layout.tsx` (naslov) → 3. koristi `common` stilove → 4. ako koristi biblioteku koja ne radi na webu, napravi i `.web.tsx` stub → 5. testiraj na webu i na telefonu.

**Nova mobile biblioteka sa native kodom**: `npx expo install <paket>` → nov EAS development build → instalacija APK na telefon. Expo Go se NE koristi (telefon ima SDK 58, projekat SDK 57).

## 7. Poznate zamke (već su nas koštale vremena)
1. `uvicorn --reload` restart ubija pozadinske ingest zadatke; na startu se zaglavljeni `IngestJob` ("u_toku") označavaju kao "greska".
2. Biblioteke bez web podrške (expo-notifications, share-intent, image-picker) rušni web — treba `.web.tsx` stub ili `Platform.OS === "web"` guard (primer: `NotificationHandler.web.tsx`).
3. `EXPO_PUBLIC_*` se bake-uje pri startu bundlera → restart sa `npx expo start -c`.
4. "Network request failed" na telefonu: isti WiFi/hotspot, `--host 0.0.0.0`, tačna IP (`ipconfig`) u Podešavanjima servera, Windows firewall, antivirus (360 je već blokirao ngrok). CORS greška se vidi samo u browseru, a često maskira pravu grešku (npr. "no such column").
5. `POST /weightlog/` ažurira i `tezina_kg` u profilu.
6. Instagram reelovi često nemaju audio → prazan transkript mora da se obradi bez greške (koristi caption).
7. Whisper halucinira na tišini/muzici (izmišljeni tekst) — poznato, nije rešeno (ideja: filter po `no_speech_prob`).
8. Expo Router typed routes: nepoznata ruta u `router.push` daje TS grešku dok se ruta ne doda.
9. Izmene u `app.json`, pluginima, ili native paketima zahtevaju **novi build**, ne samo reload.
10. Veliki fajlovi u repou: `.easignore` u korenu je obavezan (inače EAS arhiva ~350 MB).
11. **Expo Router u dev režimu pri pokretanju učita SVE ekrane** (`validateRouteTreeExports`). Ako ekran na vrhu importuje native paket kog nema u instaliranom buildu, puca cela aplikacija. Nove native pakete učitaj lenjo: `requireOptionalNativeModule("ImeModula")` iz `expo` + `require(...)` (primer: `skener.tsx`, `services/calendar.ts`).
12. Na hotspotu/novoj mreži IP laptopa se menja: Expo pokreni sa `$env:REACT_NATIVE_PACKAGER_HOSTNAME = <Wi-Fi IP>` (inače može da uzme WSL adresu), a u aplikaciji ažuriraj Podešavanja servera. Mreža označena kao "Public" + firewall može da blokira telefon.
13. `uvicorn --reload` na Windowsu ponekad zapne posle izmene `database.py` (nove rute vraćaju 404) → ugasi i pokreni server ponovo.

## 8. Ne pretpostavljaj
- Server **nije** na internetu — radi lokalno (laptop + telefon u istoj mreži). Hosting je odložen.
- `X-API-Key` je deljeni ključ, **nije prava autentikacija** (ključ je u APK-u). Nema korisničkih naloga; profil je `.first()` red u bazi — aplikacija je za jednog korisnika.
- Health Connect / pametni sat / vaga **nisu implementirani** (korisnik nema uređaje).
- Nemoj tvrditi da su share-intent iz Instagrama i dugmad u notifikacijama potvrđeni na telefonu — nisu eksplicitno potvrđeni.
