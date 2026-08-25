# ReelFuel

Mobilna aplikacija koja pretvara TikTok/Instagram Reels linkove u strukturirane recepte i vežbe, i generiše personalizovan nedeljni plan ishrane pomoću AI-ja.

## Tech stack

- **Mobile**: React Native (Expo), Expo Router, TypeScript
- **Backend**: Python, FastAPI, SQLite (SQLAlchemy)
- **AI/ML**: Claude Haiku 4.5 (Anthropic API), Whisper (transkripcija govora), MediaPipe (analiza pokreta)
- **Preuzimanje videa**: yt-dlp, FFmpeg

---

## Funkcionalnosti

### 1. Recepti sa TikTok/Instagram linka
- Korisnik nalepi link → backend preuzima audio → Whisper transkribuje govor → Claude strukturira transkript u JSON recept (naziv, sastojci, koraci, kalorije)
- Recept se automatski čuva u bazu
- Ekran **"Moji Recepti"**: lista svih sačuvanih recepata, brisanje, i ručno dodavanje recepta (bez linka)

### 2. Profil korisnika
- Unos težine, visine, godina, pola, nivoa aktivnosti, cilja (mršavljenje/dobijanje mišića/održavanje)
- Podesiva preferenca raspodele kalorija po obrocima (npr. "najviše jedem uveče")
- Automatski izračunat BMR, TDEE, i dnevni cilj kalorija (Mifflin-St Jeor formula)

### 3. AI nedeljni plan ishrane
- Generiše 7 dana sa po 3 obroka (doručak, ručak, večera)
- Kombinuje korisnikove sačuvane recepte sa novim AI predlozima
- Raspodela kalorija po obrocima prati korisnikovu preferencu iz profila
- Minimalno ponavljanje obroka tokom nedelje

### 4. Chat asistent
- Razgovor sa AI o profilu, planu, i receptima
- Model koristi "tool calling" da po potrebi:
  - Izmeni profil (težinu, cilj, itd.)
  - Zameni obrok u trenutnom nedeljnom planu
  - Doda novi recept na osnovu opisa u chatu
- Istorija razgovora se trajno čuva

### 5. Dnevnik ishrane
- Praćenje šta je korisnik stvarno pojeo tog dana
- Dva načina unosa: čekiranje obroka direktno iz nedeljnog plana, ili slobodan ručni unos
- Prikaz ukupno unetih kalorija naspram dnevnog cilja

### 6. Vežbe sa TikTok/Instagram linka (u razvoju)
- Preuzima se ceo video (ne samo audio)
- Whisper transkribuje govor (ako video ima audio)
- MediaPipe analizira pokret tela (prati vertikalni pokret kukova) i procenjuje broj ponavljanja
- Claude kombinuje transkript + analizu pokreta u strukturiran opis vežbe (naziv, grupa mišića, serije/ponavljanja)
- **Poznato ograničenje**: neki Instagram Reels-ovi (verovatno oni sa licenciranom muzikom) ne izlažu audio track za preuzimanje — u tom slučaju se koristi samo analiza pokreta, bez transkripta

---

## Struktura projekta

```
ReelFuel/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── api/routes/
│   │   │   ├── recipe.py       # recepti - obrada linka, lista, brisanje, rucno dodavanje
│   │   │   ├── profile.py      # profil korisnika + kalorijski cilj
│   │   │   ├── meal_plan.py    # generisanje nedeljnog plana
│   │   │   ├── chat.py         # chat asistent sa tool calling
│   │   │   ├── food_log.py     # dnevnik unetih obroka
│   │   │   └── exercise.py     # vezbe - obrada linka, lista, brisanje
│   │   ├── services/
│   │   │   ├── video_downloader.py      # yt-dlp (audio i video preuzimanje)
│   │   │   ├── transcription.py         # Whisper
│   │   │   ├── recipe_extractor.py      # Claude - recept iz transkripta
│   │   │   ├── exercise_extractor.py    # Claude - vezba iz transkripta + pokreta
│   │   │   ├── pose_analysis.py         # MediaPipe - analiza pokreta
│   │   │   ├── meal_plan_generator.py   # Claude - nedeljni plan
│   │   │   └── chat_service.py          # Claude - chat sa tool calling
│   │   └── models/
│   │       └── database.py     # SQLAlchemy modeli (Recipe, UserProfile, MealPlan, ChatMessage, FoodLogEntry, Exercise)
│   ├── models/
│   │   └── pose_landmarker.task   # MediaPipe model fajl
│   ├── requirements.txt
│   └── .env                    # ANTHROPIC_API_KEY
│
└── mobile/
    └── src/
        ├── app/                 # Expo Router ekrani
        │   ├── index.tsx        # Home
        │   ├── recipe-input.tsx
        │   ├── recipe-result.tsx
        │   ├── recipe-manual.tsx
        │   ├── recipes.tsx      # lista recepata
        │   ├── profile-input.tsx
        │   ├── meal-plan.tsx
        │   ├── chat.tsx
        │   ├── dnevnik.tsx
        │   └── _layout.tsx
        ├── services/
        │   └── api.ts           # svi pozivi ka backend-u
        ├── utils/
        │   └── date.ts
        └── theme.ts              # dark mode paleta boja
```

---

## Pokretanje

### Backend

```
cd backend
venv\Scripts\activate
uvicorn app.main:app --reload --host 0.0.0.0
```

Swagger dokumentacija (za testiranje ruta): `http://127.0.0.1:8000/docs`

### Mobile

```
cd mobile
npx expo start
```

Pritisni `w` za web verziju (preporučeno za sada, dok se ne reši konekcija na fizičkom telefonu), ili skeniraj QR kod sa Expo Go aplikacijom.

**Napomena**: konekcija sa fizičkog telefona ka lokalnom backend serveru trenutno ne radi pouzdano (verovatno zbog Windows Firewall-a ili 360 Total Security antivirusa) — testiranje se za sada radi kroz web verziju.

---

## Poznati problemi / za rešiti

1. **Fizički telefon ne može da se poveže na lokalni backend** — sumnja se na Windows Firewall ili 360 Total Security blokiranje konekcije. Web verzija radi bez problema (posle dodavanja CORS middleware-a).
2. **Neki Instagram Reels-ovi nemaju dostupan audio track** za preuzimanje (verovatno zbog licencirane muzike) — kod sada gracefully hendluje ovaj slučaj tako što nastavlja samo sa analizom pokreta.
3. **MediaPipe brojanje ponavljanja** je heuristika bazirana na vertikalnom pokretu kukova — dobro radi za čučnjeve/sklekove/mrtvo dizanje, manje precizno za vežbe bez tog pokreta (npr. biceps pregib u stojećem stavu).

---

## Troškovi (za ličnu upotrebu)

- **Whisper i MediaPipe**: rade lokalno, besplatno
- **Claude Haiku 4.5 API**: ~$0.003-0.004 po obradi recepta/vežbe; $5 kredita pokriva otprilike 1300+ obrada
- **Hosting**: trenutno lokalno, bez troškova

---

## Sledeći koraci (predlog)

- Rešiti konekciju fizičkog telefona (Windows Firewall / antivirus podešavanja)
- Povezati vežbe sa nedeljnim planom treninga (analogno nedeljnom planu ishrane)
- Praćenje odrađenih vežbi (analogno dnevniku ishrane)
- Poboljšati preciznost brojanja ponavljanja (dodati praćenje drugih zglobova, ne samo kukova)
- Testirati i doraditi generisanje plana na osnovu stvarne upotrebe