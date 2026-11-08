# Katalog vežbi (`vezbe_katalog.json`)

- Izvor: https://github.com/yuhonas/free-exercise-db (`dist/exercises.json`)
- Verzija: commit `f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5` (2026-09-27), 876 vežbi
- Licenca: The Unlicense (javni domen) — bez obaveze navođenja autora
- Slike se NE čuvaju u repou (~65 MB); aplikacija ih učitava sa
  `https://raw.githubusercontent.com/yuhonas/free-exercise-db/<commit>/exercises/<putanja>`
  (commit je zaključan u `app/services/vezbe_katalog.py`, `KATALOG_COMMIT`).

Osvežavanje: skini novi `dist/exercises.json`, zameni ovaj fajl i promeni `KATALOG_COMMIT`.
Postojeće veze (`Exercise.katalog_id`) ostaju dok se `id` vežbe u katalogu ne promeni.
