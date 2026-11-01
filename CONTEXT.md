# CONTEXT.md — ReelFuel: šta je projekat i u kom je stanju

Poslednje ažuriranje: 2026-11-01. Pravila rada su u `AGENTS.md`. Ažuriraj ovaj fajl kad menjaš funkcionalnost.

## 1. Šta je ReelFuel
Lična mobilna aplikacija za ishranu i trening. Korisnik podeli (Share) ili nalepi link TikTok/Instagram Reela → backend skine audio/video, transkribuje (Whisper), AI (Claude Haiku) izvuče **recept** ili **vežbu** → ulazi u biblioteku, pa u plan ishrane / plan treninga, dnevnik, praćenje težine, listu za kupovinu, nedeljni izveštaj i chat asistenta.

**Princip: automation-first.** Korisnici mrze da kucaju. Zato: share-intent unos, automatska klasifikacija (recept/vežba), plan kao podrazumevani dnevnik (obrok je "pojeden" osim ako se ne kaže drugačije), podsetnici u vreme obroka, kalorije iz slike obroka, automatski nedeljni plan, predlozi korekcije kalorijskog cilja.

Korisnik: Petar (jedini korisnik), Windows, razvoj lokalno.

## 2. Arhitektura
```
Telefon (Expo dev build APK) ──HTTP, X-API-Key──► FastAPI (laptop, 0.0.0.0:8000) ──► SQLite (backend/reelfuel.db)
                                                       ├─ yt-dlp + FFmpeg   (skidanje)
                                                       ├─ openai-whisper    (CPU transkripcija)
                                                       ├─ MediaPipe Pose    (analiza forme/vežbe iz videa)
                                                       └─ Anthropic API     (claude-haiku-4-5-20251001, tool calling u chatu)
```
- **Backend**: Python 3.13, FastAPI, uvicorn, SQLAlchemy + SQLite (bez migracija), BackgroundTasks + `threading.Semaphore` za ingest.
- **Mobile**: Expo SDK 57, Expo Router (`src/app`), React Native, TypeScript, `expo-share-intent@8`, `expo-notifications`, `expo-image-picker`, AsyncStorage.
- **Build/pokretanje**: EAS development build (ne Expo Go). Web verzija (`npx expo start` → w) služi za brzo testiranje.
- **Auth**: zajednički `X-API-Key` (`APP_SECRET_KEY` ↔ `EXPO_PUBLIC_API_KEY`). Nije prava sigurnost.

## 3. Stanje po fazama
| Faza | Sadržaj | Status |
|---|---|---|
| Osnova | Recepti (link + ručno), vežbe (link + ručno), profil, plan ishrane (7 dana), plan treninga (gym + street), dnevnik hrane/treninga, težina + grafikon, lista za kupovinu, nedeljni izveštaj, chat sa alatima | Radi (potvrđeno) |
| 0 | Share-intent ingest (`ingest.tsx`, `IngestJob`), auto-klasifikacija recept/vežba | Implementirano; potvrđeno samo na webu. **Share iz Instagrama na telefonu nije eksplicitno potvrđen.** |
| 1 | Plan kao podrazumevani dnevnik: stanja obroka `ceka/procena/pojeo/zamenjeno/preskoceno`, `zamena.tsx`, `dan` ruta | Potvrđeno radi |
| 2 | Podsetnici u vreme obroka (`notifications.ts`, `podsetnici.tsx`), dugmad "Slikaj / unesi", "Po planu", "Preskočio"; foto obrok (`meal_photo.py`) | Radi; **prava dugmad u notifikaciji na telefonu nisu eksplicitno potvrđena** |
| 3 | Automatski nedeljni plan (`nedelja_plan.py`), korekcija kalorijskog cilja (`kalorijska_korekcija.py`), `NedeljaIKorekcija.tsx` | Potvrđeno radi |
| 4 | Health Connect (sat/vaga) | **Preskočeno** — korisnik nema uređaje; kod nije primenjen, `app.json` nepromenjen |
| 5 | Hosting 24/7, prava autentikacija, HTTPS, push preko FCM, cron | **Nije započeto.** Istraženo: Oracle Always Free (2 OCPU/12 GB posle smanjenja iz juna 2026), Hetzner CX23 (~€4–6/mes), Contabo. Odluka odložena ("prvo automatizacija"). |

## 4. Backend: rute (prefiksi iz `main.py`)
`recipe`, `profile`, `mealplan`, `chat`, `log` (food_log), `exercise`, `workoutplan`, `workoutlog`, `weightlog`, `shoppinglist` (generate, generate-from-recipe, get, toggle, delete), `report`, `ingest`, `dan`, `nedelja`, `korekcija`, `plan`, `proizvod` (bar-kod).
Tačne putanje: Swagger na `/docs` (izvor istine). Sve rute osim eventualno `/docs` idu kroz `verify_api_key`.

Ključni servisi (`backend/app/services/`): `video_downloader` (download_audio/video, fetch_metadata), `transcription`, `recipe_extractor` / `exercise_extractor` (primaju opcioni `caption`), `llm_utils.parse_json`, `ingest_pipeline`, `pose_analysis`, `meal_plan_generator`, `workout_plan_generator`, `shopping_list_generator`, `chat_service`, `daily_nutrition` (`get_dnevni_cilj`), `meal_photo`, `kalorijska_korekcija`, `nedelja_plan`.

## 5. Model podataka (`models/database.py`)
`Recipe`, `UserProfile` (tezina_kg, visina_cm, godine, pol, nivo_aktivnosti, cilj, raspodela_kalorija, broj_treninga_nedeljno, ciljna_tezina_kg), `MealPlan`, `ChatMessage`, `FoodLogEntry` (izvor: slobodan / plan / zamena / preskoceno), `Exercise`, `WorkoutPlan`, `WorkoutLogEntry`, `WeightLog`, `ShoppingListItem`, `IngestJob` (status: u_toku / greska / gotov…), `KalorijskaKorekcija`, `Proizvod` (barkod PK, naziv, kcal_100g, porcija_g, paket_g, izvor).
Kalorijski cilj = Mifflin-St Jeor + aktivnost + cilj + prihvaćene korekcije, računa se samo u `get_dnevni_cilj`.

## 6. Mobile: ekrani
Tabovi `(tabs)/`: `index` (početna), `dnevnik`, `chat`, `profil`.
Ostalo: `ingest`, `zamena`, `podsetnici`, `dodaj-u-plan`, `settings`, `recipes`, `recipe-input|manual|result`, `exercises`, `exercise-input|manual|result`, `meal-plan`, `workout-plan`, `shopping-list`, `weekly-report`, `+native-intent`.
`_layout.tsx` renderuje `<NotificationHandler />` i obrađuje share intent (`useShareIntent`). Boje: primary `#7CFF3D`, secondary `#1BBE6D`, background `#141414`.

## 6a. Faza 6 — popravke i bezbednost (2026-11-01)
- `GET/POST /profile/` vraća `dnevni_cilj_kalorija` (iz `get_dnevni_cilj`, uključuje korekcije), `bmr`, `tdee`; validacija polja (Literal/opsezi).
- `broj_treninga_nedeljno` u formi profila (2–6); ako ga klijent ne pošalje, backend zadržava postojeću vrednost.
- Nedeljni plan (`meal-plan.tsx`): kvačica upisuje u datum TOG dana tekuće nedelje preko `POST /dan/{datum}/{tip}` (isto stanje kao dnevnik); budući dani nemaju kvačicu; prikazuje pojeo/zamenjeno/preskočeno. Helper `dateForWeekday` u `utils/date.ts`.
- `app/core/url_guard.py`: zajednička allowlist (Instagram/TikTok) za `/ingest`, `/recipe/`, `/exercise/`; greške 500 više ne vraćaju interni tekst izuzetka.
- Whisper: odbacuje segmente sa visokim `no_speech_prob`/niskim `avg_logprob`/ponavljanjem; `condition_on_previous_text=False`.
- Obrisani ostaci Expo šablona (explore, themed-*, app-tabs, hooks/use-*, constants/theme, global.css...).
- Provereno: `tsc --noEmit` prolazi, backend se importuje, živi test `GET/POST /profile/` (cilj se prikazuje, broj treninga se ne resetuje), `/recipe/` sa zabranjenim URL-om → 400. **Na telefonu još nije provereno.**

## 6b. Faza 7 — skener bar-koda i kalendar (2026-11-01)
**Skener** (`mobile/src/app/skener.tsx`, `expo-camera`):
- Dnevnik → "🏷️ Skeniraj pakovanje", i iz `zamena.tsx` (pa i iz notifikacije za obrok). EAN-13/8, UPC, GS1 QR.
- `GET /proizvod/{barkod}` → keš u tabeli `Proizvod` → inače Open Food Facts (`services/proizvod_service.py`, fiksna adresa, bez ključa).
- Ako proizvoda nema: `POST /proizvod/{barkod}/etiketa` — slika tabele nutritivnih vrednosti → Claude pročita kcal/100g, porciju i paket → sačuva se za taj bar-kod.
- Izbor porcije (porcija / 50 g / 100 g / ceo paket / grami) → `danAkcija(zamena)` ako je obrok iz plana, inače slobodan unos.
- Provereno na serveru: Nutella 539 kcal/100g, Coca-Cola 42 kcal/100g (porcija 330), nepoznat kod → `pronadjen:false`, keš ~9 ms. Čitanje etikete (Claude) **nije testirano** sa pravom slikom.

**Kalendar** (`mobile/src/services/calendar.ts`, `expo-calendar` novi objektni API iz SDK 57):
- Plan treninga → kartica "📅 Kalendar": vreme treninga (HH:MM), upisuje treninge za narednih 7 dana (podsetnik 30 min pre, vežbe u opisu). Samo treninzi — obroci namerno ne.
- Upisuje u **glavni Google kalendar** (source.type `com.google`; može "Promeni" na drugi). Prva verzija je pravila lokalni kalendar "ReelFuel" — Google Calendar aplikacija ga NE prikazuje (potvrđeno od korisnika), zato je promenjeno.
- Android ne dozvoljava aplikaciji da napravi Google pod-kalendar → svaki naš događaj ima oznaku `#ReelFuel` u opisu i brišu/menjaju se SAMO takvi događaji. Novi plan se sam upiše ako je kalendar uključen. Podešavanja u AsyncStorage.
- Skener potvrđen na telefonu. Upis u Google kalendar posle ispravke **još nije potvrđen**.

**Oba traže NOVI EAS development build.** Native moduli se učitavaju lenjo (`requireOptionalNativeModule`), pa stari build ne puca nego prikaže poruku da treba nova verzija.

## 6c. Opcija A — lakše pokretanje (2026-11-01)
- `start.bat` / `start.ps1` u korenu: jedan klik diže backend + Expo (vezan za pravi Wi-Fi/hotspot IP) i ispiše adresu za telefon.
- `apiConfig.ts`: automatska adresa backenda iz Expo adrese — ne kuca se IP posle promene mreže. Podešavanja servera: Automatski / Ručno + "Testiraj vezu".
- Provereno: `tsc` prolazi, `start.ps1` se parsira bez grešaka i bira Wi-Fi (ne WSL) adresu. Skripta i auto-adresa **nisu pokrenute end-to-end na telefonu**.

## 7. Poznati problemi / dug
Funkcionalni:
- Ruta `shoppinglist/generate-from-recipe` postoji, ali je nijedan ekran ne koristi.
- Whisper prag (`NO_SPEECH_PRAG=0.6`) nije podešen na pravim reelovima — možda odbacuje previše/premalo.
- Nedeljni plan je vezan za nazive dana (ponedeljak…nedelja), ne za datume — stari plan se "ponavlja" svake nedelje.

Kod/higijena:
- `mobile/AGENTS.md`/`CLAUDE.md` su iz Expo šablona (kažu: čitaj Expo v57 dokumentaciju — to važi).
- `README.md` je zastareo.
- Nema logoa/ikone aplikacije (podrazumevane Expo ikone).
- Nema testova, nema migracija baze.

Bezbednost / operativno:
- Ključevi su tokom razvoja bili vidljivi u razgovoru (Anthropic ključ, `APP_SECRET_KEY`, ngrok authtoken) → **treba ih rotirati** (nije potvrđeno da je urađeno).
- Push faza 1–3 je na `origin/main` (github.com/PetarKojadinovic/ReelFuel).
- CORS je `*` (potrebno za web testiranje; suziti pre hostinga).

## 8. Roadmap / ideje (po prioritetu)
1. Rotirati ključeve; README, logo.
2. Potvrditi na telefonu: share iz Instagrama/TikToka, dugmad u notifikaciji, izmene iz faze 6.
3. "Spremno za pregled" lista (sve što je ingest obradio čeka potvrdu jednim tapom); detekcija linka iz clipboard-a.
5. Faza 5: hosting (VPS), HTTPS, prava autentikacija (nalozi/JWT), push preko FCM, cron za nedeljni plan.
7. Ideje: kalendar B (raspored treninga po slobodnim terminima), deljenje liste za kupovinu, export/backup, vreme/vremenski uslovi za trening, Health Connect ako korisnik dobije uređaj.

## 9. Istorija ključnih odluka
- Prvo MVP sa web testiranjem → pa APK preko EAS-a (Expo Go nije opcija zbog SDK razlike).
- Kalorijski cilj centralizovan u `get_dnevni_cilj`.
- Adresa servera podesiva u aplikaciji jer se lokalna IP menja (hotspot/mreža).
- Hosting odložen; prvo automatizacija (korisnici ne žele da kucaju).
