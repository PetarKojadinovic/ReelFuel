"""Merenje Whisper filtera na pravim reelovima (ne dira bazu).

Za svaki link: skine audio (postojeći downloader), prepozna jezik, transkribuje kao
produkcija (language="sr") i, ako jezik nije srpski, i sa prepoznatim jezikom.
Ispiše svaki segment sa no_speech_prob / avg_logprob / compression_ratio i da li ga
trenutni filter (_segment_ok) zadržava. Rezultat sačuva i kao JSON.

Pokretanje (iz foldera backend, venv aktivan):
    python ../scripts/whisper_prag.py izlaz.json "oznaka|https://www.instagram.com/reel/..." ...
"""
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

import whisper  # noqa: E402

from app.services import transcription as tr  # noqa: E402
from app.services.video_downloader import download_audio, get_caption  # noqa: E402

POLJA = ("no_speech_prob", "avg_logprob", "compression_ratio")


def segmenti(model, audio, jezik):
    r = model.transcribe(audio, language=jezik, condition_on_previous_text=False)
    return [
        {"start": round(s["start"], 1), "end": round(s["end"], 1), "text": s["text"].strip(),
         **{k: round(s.get(k, 0), 3) for k in POLJA}, "zadrzan": tr._segment_ok(s)}
        for s in r.get("segments") or []
    ]


def main():
    izlaz, ulazi = sys.argv[1], sys.argv[2:]
    model = tr.get_model()
    rezultati = []
    for ulaz in ulazi:
        oznaka, url = ulaz.split("|", 1)
        print(f"\n=== {oznaka}: {url}", flush=True)
        r = {"oznaka": oznaka, "url": url}
        try:
            r["caption_duzina"] = len(get_caption(url) or "")
            audio = download_audio(url)
        except Exception as e:  # noqa: BLE001
            r["greska"] = f"{type(e).__name__}: {e}"
            print("  GRESKA:", r["greska"], flush=True)
            rezultati.append(r)
            continue
        try:
            mel = whisper.log_mel_spectrogram(whisper.pad_or_trim(whisper.load_audio(audio)), model.dims.n_mels)
            _, probs = model.detect_language(mel.to(model.device))
            top = sorted(probs.items(), key=lambda x: -x[1])[:3]
            r["jezik"] = [(j, round(p, 3)) for j, p in top]
            print("  jezik:", r["jezik"], flush=True)
            r["sr"] = segmenti(model, audio, "sr")
            if top[0][0] not in ("sr", "hr", "bs"):
                r["auto"] = segmenti(model, audio, top[0][0])
            for kljuc in ("sr", "auto"):
                for s in r.get(kljuc, []):
                    znak = "+" if s["zadrzan"] else "-"
                    print(f"  [{kljuc}] {znak} {s['start']:>5}-{s['end']:<5} nsp={s['no_speech_prob']:.2f} "
                          f"lp={s['avg_logprob']:.2f} cr={s['compression_ratio']:.2f} | {s['text'][:70]}", flush=True)
        finally:
            os.remove(audio)
        rezultati.append(r)
    Path(izlaz).write_text(json.dumps(rezultati, ensure_ascii=False, indent=1), encoding="utf-8")
    print("\nSacuvano:", izlaz)


if __name__ == "__main__":
    main()
