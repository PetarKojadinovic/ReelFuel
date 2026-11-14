# Katalog vežbi (`vezbe_katalog.json`)

- Izvor: **ExerciseDB**, besplatni API `https://oss.exercisedb.dev/api/v1/exercises` (bez ključa).
- Preuzeto: 2026-11-10, 1500 vežbi, svaka ima animirani GIF (180p). Datum je i u polju `preuzeto`.
- GIF-ovi se NE skidaju; telefon ih učitava sa `https://static.exercisedb.dev/media/<id>.gif`
  (backend šalje samo URL-ove sa tog hosta).
- **Fajl NIJE u gitu** (`backend/.gitignore`): podaci i GIF-ovi su ExerciseDB-ovi, nisu javni domen.
  Za ličnu upotrebu u redu; pre objavljivanja aplikacije proveriti uslove ExerciseDB-a
  (plaćeni RapidAPI plan daje i GIF-ove veće rezolucije).
- Testovi koriste mali katalog `backend/tests/data/vezbe_katalog.json`.

Preuzimanje / osvežavanje (iz korena repoa, PowerShell):
`backend\venv\Scripts\python scripts\exercisedb_katalog.py`
Bez fajla server radi, ali vežbe nemaju opis ("Nema je u katalogu").

Veze na id koji više ne postoji (`Exercise.katalog_id`, `vezba_naziv_veza`) se same povežu
ponovo pri sledećem otvaranju vežbe.

Istorija: free-exercise-db (do 2026-11-08), wger (2026-11-10, odbačen: malo slika), ExerciseDB.
