"""Preuzima katalog vežbi sa ExerciseDB (besplatni API oss.exercisedb.dev, bez ključa)
u backend/data/vezbe_katalog.json.

Pokretanje iz korena repoa: backend/venv/Scripts/python scripts/exercisedb_katalog.py
- ~1500 vežbi, svaka ima animirani GIF (180p) na static.exercisedb.dev.
- GIF-ovi se NE skidaju; čuva se samo URL (telefon ih učitava direktno).
- Fajl NIJE u gitu (podaci su ExerciseDB-ovi, licenca nije javni domen) -> posle kloniranja pokreni skriptu.
"""
import json
import re
import time
from datetime import date
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parent.parent
IZLAZ = ROOT / "backend" / "data" / "vezbe_katalog.json"
API = "https://oss.exercisedb.dev/api/v1/exercises"
GIF_HOST = "https://static.exercisedb.dev/"


def korak(t: str) -> str:
    return re.sub(r"^\s*step\s*:?\s*\d+\s*[:.)-]?\s*", "", t, flags=re.I).strip()


def main():
    vezbe, kursor = [], None
    with httpx.Client(timeout=60, headers={"User-Agent": "ReelFuel-katalog"}) as c:
        while True:
            params = {"limit": 25} | ({"after": kursor} if kursor else {})
            for pokusaj in range(5):
                r = c.get(API, params=params)
                if r.status_code != 429:
                    break
                time.sleep(5 * (pokusaj + 1))
            d = r.raise_for_status().json()
            for e in d["data"]:
                gif = e.get("gifUrl") or ""
                vezbe.append({
                    "id": e["exerciseId"],
                    "name": " ".join(e["name"].split()),
                    "instructions": [k for k in (korak(t) for t in e.get("instructions", [])) if k],
                    "bodyParts": e.get("bodyParts", []),
                    "primaryMuscles": e.get("targetMuscles", []),
                    "secondaryMuscles": e.get("secondaryMuscles", []),
                    "equipment": e.get("equipments", []),
                    # samo poznat host (telefon učitava ovaj URL)
                    "gif": gif if gif.startswith(GIF_HOST) else None,
                })
            meta = d.get("meta", {})
            if not meta.get("hasNextPage") or not meta.get("nextCursor"):
                break
            kursor = meta["nextCursor"]
            time.sleep(0.3)
    vidjeno, jedinstvene = set(), []
    for v in sorted(vezbe, key=lambda v: v["name"].lower()):
        if v["id"] not in vidjeno:
            vidjeno.add(v["id"])
            jedinstvene.append(v)
    out = {"izvor": "ExerciseDB (oss.exercisedb.dev)", "preuzeto": date.today().isoformat(), "vezbe": jedinstvene}
    IZLAZ.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{len(jedinstvene)} vezbi, {sum(1 for v in jedinstvene if v['gif'])} sa GIF-om -> {IZLAZ}")


if __name__ == "__main__":
    main()
