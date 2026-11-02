# CONTEXT.md — ReelFuel: šta je projekat i u kom je stanju

Poslednje ažuriranje: 2026-11-02 (bezbednost, popravke plana/liste, testovi). Pravila rada su u `AGENTS.md`. Ažuriraj ovaj fajl kad menjaš funkcionalnost.

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
- **Mobile**: Expo SDK 57, Expo Router (`src/app`), React Native, TypeScript, `expo-share-intent@8`, `expo-notifications`, `expo-clipboard`, `expo-image-picker`, AsyncStorage.
- **Build/pokretanje**: EAS development build (ne Expo Go). Web verzija (`npx expo start` → w) služi za brzo testiranje.
- **Auth**: zajednički `X-API-Key` (`APP_SECRET_KEY` ↔ `EXPO_PUBLIC_API_KEY`). Nije prava sigurnost.

## 3. Stanje po fazama
| Faza | Sadržaj | Status |
|---|---|---|
| Osnova | Recepti (link + ručno), vežbe (link + ručno), profil, plan ishrane (7 dana), plan treninga (gym + street), dnevnik hrane/treninga, težina + grafikon, lista za kupovinu, nedeljni izveštaj, chat sa alatima | Radi (potvrđeno) |
| 0 | Share-intent ingest (`ingest.tsx`, `IngestJob`), auto-klasifikacija recept/vežba | Potvrđeno na telefonu (2026-11-01) |
| 1 | Plan kao podrazumevani dnevnik: stanja obroka `ceka/procena/pojeo/zamenjeno/preskoceno`, `zamena.tsx`, `dan` ruta | Potvrđeno radi |
| 2 | Podsetnici u vreme obroka (`notifications.ts`, `podsetnici.tsx`), dugmad "Slikaj / unesi", "Po planu", "Preskočio"; foto obrok (`meal_photo.py`) | Potvrđeno na telefonu (2026-11-01) |
| 3 | Automatski nedeljni plan (`nedelja_plan.py`), korekcija kalorijskog cilja (`kalorijska_korekcija.py`), `NedeljaIKorekcija.tsx` | Potvrđeno radi |
| 4 | Health Connect (sat/vaga) | **Preskočeno** — korisnik nema uređaje; kod nije primenjen, `app.json` nepromenjen |
| 8 | Spremno za pregled, link iz clipboard-a, plan po datumima, lista iz recepta (vidi 6d) | Napisano, testiran backend; telefon nije proveren |
| 5 | Hosting 24/7, prava autentikacija, HTTPS, push preko FCM, cron | **Nije započeto.** Istraženo: Oracle Always Free (2 OCPU/12 GB posle smanjenja iz juna 2026), Hetzner CX23 (~€4–6/mes), Contabo. Odluka odložena ("prvo automatizacija"). |

## 4. Backend: rute (prefiksi iz `main.py`)
`recipe`, `profile`, `mealplan`, `chat`, `log` (food_log), `exercise`, `workoutplan`, `workoutlog`, `weightlog`, `shoppinglist` (generate, generate-from-recipe, get, toggle, delete), `report`, `ingest`, `dan`, `nedelja`, `korekcija`, `plan`, `proizvod` (bar-kod).
Tačne putanje: Swagger na `/docs` (izvor istine). Sve rute osim eventualno `/docs` idu kroz `verify_api_key`.

Ključni servisi (`backend/app/services/`): `video_downloader` (download_audio/video, fetch_metadata), `transcription`, `recipe_extractor` / `exercise_extractor` (primaju opcioni `caption`), `llm_utils.parse_json`, `ingest_pipeline`, `pose_analysis`, `meal_plan_generator`, `workout_plan_generator`, `shopping_list_generator`, `chat_service`, `daily_nutrition` (`get_dnevni_cilj`), `meal_photo`, `kalorijska_korekcija`, `nedelja_plan`.

## 5. Model podataka (`models/database.py`)
`Recipe`, `UserProfile` (tezina_kg, visina_cm, godine, pol, nivo_aktivnosti, cilj, raspodela_kalorija, broj_treninga_nedeljno, ciljna_tezina_kg), `MealPlan`, `ChatMessage`, `FoodLogEntry` (izvor: slobodan / plan / zamena / preskoceno), `Exercise`, `WorkoutPlan`, `WorkoutLogEntry`, `WeightLog`, `ShoppingListItem`, `IngestJob` (status: u_toku / greska / gotov…), `KalorijskaKorekcija`, `Proizvod` (barkod PK, naziv, kcal_100g, porcija_g, paket_g, izvor).
Kalorijski cilj = Mifflin-St Jeor + aktivnost + cilj + prihvaćene korekcije, računa se samo u `get_dnevni_cilj`.

## 6. Mobile: ekrani (novi dizajn od 2026-11-02)
Donji meni `(tabs)/`: **Danas** (`index`), **Hrana** (`hrana`: Jelovnik / Recepti / Kupovina), dugme **+** (`plus` je samo mesto za dugme; otvara `/dodaj`), **Trening** (`trening`: Raspored / Moje vežbe), **Ja** (`ja`).
Paneli i ekrani van tabova: `dodaj` (panel "Šta dodaješ?", transparentModal), `zamena` ("Nešto drugo", modal; param `odmah=slika` odmah otvara kameru), `dodaj-u-plan` (modal), `chat`, `moji-podaci` (forma profila), `settings` ("Veza sa laptopom"), `podsetnici`, `weekly-report`, `ingest`, `pregled`, `skener`, `recipe-manual|result`, `exercise-manual|result`, `+native-intent`.
Delovi tabova su u `components/hrana/` (Jelovnik, Recepti, Kupovina) i `components/trening/` (Raspored, MojeVezbe). Zajedničke UI komponente: `components/ui.tsx` (Icon, Segment, DayStrip, ListRow, HighlightCard, EmptyState), `CalorieRing.tsx`, `RecipePicker.tsx`.
Tab se otvara na tačnom delu: `router.navigate({ pathname: "/hrana", params: { deo: "kupovina" } })` (`deo`: jelovnik|recepti|kupovina; za trening raspored|vezbe).
`_layout.tsx` učitava font Nunito (`@expo-google-fonts/nunito`), renderuje `<NotificationHandler />` i obrađuje share intent. Boje u `theme.ts` (background `#111311`, surface `#1B1E1A`, primary `#7CFF3D`, warning `#FFB547`).

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

## 6d. Faza 8 — automatizacija unosa (2026-11-01)
Korisnik je potvrdio da sve iz prethodnih faza radi na telefonu (share, notifikacije, kalendar, start skripta).
- **Spremno za pregled** (`mobile/src/app/pregled.tsx`): sve obrade linkova koje nisu sačuvane/odbačene. ✓ čuva, ✕ odbacuje, "Sačuvaj sve", tap otvara `ingest?job_id=...`. Početna prikazuje baner "📥 Spremno za pregled" kad nešto čeka. Ekran obrade više ne traži da se ostane na njemu.
  - Backend: `GET /ingest/` (lista: u_toku/gotovo/potrebna_odluka/greska, bez sacuvano_id), `POST /ingest/{id}/odbaci` (status `odbaceno`), `GET /ingest/{id}` sada vraća i `url`.
- **Link iz clipboard-a** (`services/clipboardLink.ts`, `expo-clipboard`): kad se aplikacija otvori/vrati u prvi plan, ako je u clipboard-u Instagram/TikTok link koji još nije ponuđen → pitanje "Da obradim ovaj reel?". Isti link se nudi samo jednom (AsyncStorage). Modul se učitava lenjo → **treba novi EAS build**; stari build samo ne nudi link.
- **Plan po datumima**: novi plan ima `plan_data.nedelja_od` (ponedeljak). `plan_za_datum(db, datum)` u `daily_nutrition.py` bira najnoviji plan čija nedelja počinje najkasnije u nedelji tog datuma → prošle nedelje u dnevniku zadržavaju svoj plan; budući dani koriste najnoviji. Stari planovi bez ključa koriste nedelju iz `created_at`. Koriste ga `/dan`, `/plan/slotovi`, `/plan/ubaci`. Bez izmene šeme baze.
- **Lista za kupovinu iz recepta**: dugme "🛒 Dodaj sastojke u listu za kupovinu" u `recipe-result.tsx`. `generate-from-recipe` sada **dodaje** u postojeću listu (ranije je brisala sve) i preskače namirnice koje su već na listi (nekupljene).
- Provereno: `tsc --noEmit` prolazi; backend testiran na KOPIJI baze (TestClient): prošla nedelja vraća stari plan, lista za pregled/odbaci/save, dodavanje u listu bez duplikata. **Na telefonu još nije provereno** (clipboard traži novi build).

## 6e. Bezbednosne popravke (2026-11-02)
- `core/security.py`: server **odbija da se pokrene** ako `APP_SECRET_KEY` nije podešen ili ima manje od 16 znakova (ranije je tada preskakao proveru). Ključ se poredi sa `hmac.compare_digest`. `APP_SECRET_KEY` dodat u `backend/.env.example`.
- Chat alati (`chat_service.py`): `update_profile` prima samo dozvoljena polja sa istim opsezima kao `/profile/` (Pydantic `ProfilIzmena`, `extra="forbid"`); `swap_meal` i `add_recipe` proveravaju ulaz umesto da padnu na `KeyError`; najviše 5 krugova alata po poruci.
- `/chat`, `/mealplan/generate`, `/shoppinglist/generate`, `/workoutplan/generate`: greška 500 više ne vraća tekst izuzetka (loguje se na serveru).
- `video_downloader.py`: najviše 10 min trajanja, 200 MB po fajlu, samo jedan video (`noplaylist`, nikad ceo profil), bez prenosa uživo. Ingest proverava trajanje iz metapodataka pre preuzimanja i prikazuje jasnu poruku.
- `requirements.txt`: dopunjen (SQLAlchemy, anthropic, httpx, mediapipe, opencv, torch, numpy) i zaključane verzije iz radnog venv-a.
- Provereno na KOPIJI baze: bez ključa / pogrešan ključ → 401, dobar → 200; `update_profile` odbija `id`, vrednosti van opsega i nepoznat enum; `swap_meal` odbija loš tip/nepostojeći dan; filter trajanja. Pravi reel posle izmene downloadera **nije testiran**.

## 6f. Popravke plana i liste + prvi testovi (2026-11-02)
- **Ubacivanje recepta u dan druge nedelje** (`/plan/ubaci`): ako datum nije u nedelji plana, obrok se čuva u `plan_data.izmene[datum][obrok_tip]` i važi samo za taj datum (ranije je menjao isti dan tekuće nedelje). `dan_iz_plana(plan, datum)` u `daily_nutrition.py` primenjuje izmene; koriste ga `day_plan` (pa `/dan`) i `/plan/slotovi`. Kad se napravi novi plan (`/mealplan/generate`), `prenesi_izmene` upiše izmene za njegovu nedelju u dane, kasnije zadrži, prošle odbaci. Dan u nedelji plana se i dalje menja direktno u `dani`.
- **Lista za kupovinu**: nova kolona `ShoppingListItem.izvor` (`plan` / `recept` / NULL za stare stavke). `/shoppinglist/generate` briše samo stavke sa `izvor="plan"` i ne dodaje namirnice koje su već na listi (nekupljene). Stare stavke (NULL) se ne brišu automatski — obriši ih ručno ako su višak.
- **Nove kolone bez brisanja baze**: `NOVE_KOLONE` + `_dodaj_kolone` u `database.py` — `init_db` radi `ALTER TABLE ADD COLUMN` za kolone koje fale. Za novu kolonu u postojećoj tabeli: dodaj je u model I u `NOVE_KOLONE`. (Promena tipa/brisanje kolone i dalje nije podržano.)
- **Testovi**: `backend/tests/` (pytest, privremena SQLite baza, LLM zamenjen lažnim funkcijama): url_guard, plan po datumu/izmene, lista za kupovinu, dodavanje kolone. `pytest` je u `requirements-dev.txt`. Pokretanje: `cd backend; .\venv\Scripts\python -m pytest -q`. 21/21 prolazi.
- **Ekran "Dodaj u plan"** (`dodaj-u-plan.tsx`): prekidač "Ova nedelja / Sledeća nedelja" (sa opsegom datuma), dani po redu sa datumom ("Danas · Ponedeljak, 2. 11."), ispod svakog dana doručak/ručak/večera; oznaka "najbliže kalorijama" umesto sortiranja. `/plan/slotovi` sada vraća SVE obroke od danas do kraja sledeće nedelje (do 14 dana), po datumu, sa poljima `datum`, `nedelja` (0/1) i `danas`; `/plan/ubaci` prima `dan_offset` 0–13 i vraća `datum`. Helperi `formatDanDatum` / `formatDatumKratko` u `utils/date.ts`; stil prekidača `common.tabRow/tabBtn*` u `styles/common.ts`.
- Provereno: pytest 23/23, `tsc --noEmit` prolazi, živi `GET /plan/slotovi` vraća 2.–15. 11. po 3 obroka. **Ekran na telefonu nije proveren.**

## 6g. Novi dizajn (2026-11-02)
- Mockup: https://claude.ai/artifact/Mvp3eR6n7Lb5XhdFMRgZXp (5 ekrana, korisnik odobrio).
- Struktura: 4 taba po nameri (Danas, Hrana, Trening, Ja) + dugme "+" za sav unos (link, slika obroka, bar-kod, asistent, ručni unos, težina; nudi link iz clipboard-a). Spojeni i obrisani ekrani: stari Home, `dnevnik`, `profil`, `meal-plan`, `recipes`, `shopping-list`, `workout-plan`, `exercises`, `recipe-input`, `exercise-input`; `chat` je prebačen iz tabova u običan ekran.
- Danas: krug kalorija (`CalorieRing`, bez SVG biblioteke), obroci sa "Pojeo sam" / "Nešto drugo" / "Preskočio sam", tap na označen obrok = poništi, "Još si pojeo", današnji trening, baner za nove recepte iz linkova, `NedeljaIKorekcija`. Ako laptop ne odgovori za 10 s → poruka "Ne mogu da dođem do laptopa" + dugme na Vezu sa laptopom (umesto beskonačnog kruga). Povuci nadole = osveži.
- Hrana/Jelovnik: traka dana sa datumima, ova/sledeća nedelja (podaci preko `GET /dan/{datum}`, uključuje `izmene`), čekiranje, zamena obroka receptom (`RecipePicker` → `/plan/ubaci`), dugme za kupovinu, nov jelovnik. Kupovina: "Treba kupiti" / "Kupljeno" + "Skloni sve".
- Trening/Raspored: Teretana / Napolju (čuva se u podešavanjima kalendara, Danas koristi isti izbor), traka dana sa tačkom za dane treninga, čekiranje samo za danas, "Završio sam trening", Google kalendar kao prekidač.
- Nove zavisnosti (samo JS, bez novog EAS builda): `@expo/vector-icons` (Ionicons), `@expo-google-fonts/nunito`.
- Provereno: `tsc --noEmit` prolazi; Metro sastavlja Android bundle za sve nove ekrane (font i ikone uključeni). **Na telefonu nije provereno.**

## 7. Poznati problemi / dug
Funkcionalni:
- Whisper prag (`NO_SPEECH_PRAG=0.6`) nije podešen na pravim reelovima — možda odbacuje previše/premalo.
- Stavke liste za kupovinu nastale pre 2026-11-02 nemaju `izvor`, pa ih `/shoppinglist/generate` ne briše.

Kod/higijena:
- `mobile/AGENTS.md`/`CLAUDE.md` su iz Expo šablona (kažu: čitaj Expo v57 dokumentaciju — to važi).
- `README.md` je zastareo.
- Stariji sporedni ekrani (ingest, pregled, skener, recipe-result, settings, podsetnici, weekly-report...) dobili su nove boje i font samo tamo gde su imali `fontWeight`; nisu prepravljeni na nove komponente.
- Nema logoa/ikone aplikacije (podrazumevane Expo ikone).
- Testovi samo za deo backenda (`backend/tests/`); nema mobile testova. Nema pravih migracija (samo dodavanje kolona preko `NOVE_KOLONE`).

Bezbednost / operativno:
- Ključevi (Anthropic, `APP_SECRET_KEY`, ngrok) rotirani 2026-11-02 (potvrdio korisnik; aplikacija radi sa novim ključem).
- Push faza 1–3 je na `origin/main` (github.com/PetarKojadinovic/ReelFuel).
- CORS je `*` (potrebno za web testiranje; suziti pre hostinga).
- Pred hosting: HTTP bez TLS-a, deljeni ključ u APK-u, `/docs` dostupan bez ključa, nema rate limita (trošak LLM-a).

## 8. Roadmap / ideje (po prioritetu)
1. Rotirati ključeve; README, logo.
2. Novi EAS build (expo-clipboard) i provera faze 8 na telefonu.
5. Faza 5: hosting (VPS), HTTPS, prava autentikacija (nalozi/JWT), push preko FCM, cron za nedeljni plan.
7. Ideje: kalendar B (raspored treninga po slobodnim terminima), deljenje liste za kupovinu, export/backup, vreme/vremenski uslovi za trening, Health Connect ako korisnik dobije uređaj.

## 9. Istorija ključnih odluka
- Prvo MVP sa web testiranjem → pa APK preko EAS-a (Expo Go nije opcija zbog SDK razlike).
- Kalorijski cilj centralizovan u `get_dnevni_cilj`.
- Adresa servera podesiva u aplikaciji jer se lokalna IP menja (hotspot/mreža).
- Hosting odložen; prvo automatizacija (korisnici ne žele da kucaju).
