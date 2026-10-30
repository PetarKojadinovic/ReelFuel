import os
import logging
import threading
from anthropic import Anthropic
from dotenv import load_dotenv

from app.models.database import SessionLocal, IngestJob
from app.services.video_downloader import fetch_metadata, download_audio, download_video
from app.services.transcription import transcribe_audio
from app.services.recipe_extractor import extract_recipe
from app.services.exercise_extractor import extract_exercise
from app.services.pose_analysis import analyze_video
from app.services.llm_utils import parse_json

load_dotenv()
log = logging.getLogger("ingest")
client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

# Samo jedan posao istovremeno koristi Whisper/MediaPipe
_heavy = threading.Semaphore(1)

CLASSIFY_PROMPT = """Dobijas opis (i mozda transkript) videa sa TikToka/Instagrama.
Odredi:
- "tip": "recept", "vezba" ili "nepoznato"
- "dovoljno_podataka": true SAMO ako opis sam sadrzi konkretne sastojke I nacin pripreme (za recept); inace false.
Vrati ISKLJUCIVO JSON: {"tip": "...", "dovoljno_podataka": true/false}"""


def _update(job_id: str, **fields):
    db = SessionLocal()
    try:
        job = db.get(IngestJob, job_id)
        for k, v in fields.items():
            setattr(job, k, v)
        db.commit()
    finally:
        db.close()


def _classify(caption: str, transcript: str = ""):
    if not caption and not transcript:
        return "nepoznato", False
    text = f"Opis: {caption or '(prazan)'}"
    if transcript:
        text += f"\n\nTranskript: {transcript[:3000]}"
    msg = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=100,
        system=CLASSIFY_PROMPT,
        messages=[{"role": "user", "content": text}],
    )
    data = parse_json(msg.content[0].text)
    tip = data.get("tip") if data.get("tip") in ("recept", "vezba") else "nepoznato"
    return tip, bool(data.get("dovoljno_podataka"))


def run_ingest(job_id: str, url: str, tip_hint: str | None = None):
    _update(job_id, faza="U redu čeka")
    with _heavy:
        _run(job_id, url, tip_hint)


def _run(job_id: str, url: str, tip_hint: str | None):
    audio_path = video_path = None
    transcript = ""
    try:
        _update(job_id, faza="Čitam opis videa")
        meta = fetch_metadata(url)
        caption = (meta.get("description") or meta.get("title") or "").strip()[:4000]

        if tip_hint:
            tip, dovoljno = tip_hint, False
        else:
            tip, dovoljno = _classify(caption)

        if tip == "nepoznato":
            _update(job_id, faza="Slušam govor u videu")
            try:
                audio_path = download_audio(url)
                transcript = transcribe_audio(audio_path)
            except Exception:
                log.warning("Transkript nije dostupan", exc_info=True)
            tip, dovoljno = _classify(caption, transcript)
            if tip == "nepoznato":
                _update(job_id, status="potrebna_odluka", faza="")
                return

        _update(job_id, tip=tip)

        if tip == "recept":
            if not (dovoljno and caption) and not transcript:
                _update(job_id, faza="Slušam govor u videu")
                try:
                    audio_path = audio_path or download_audio(url)
                    transcript = transcribe_audio(audio_path)
                except Exception:
                    log.warning("Transkript nije dostupan", exc_info=True)
            if not caption and not transcript:
                raise ValueError("Video nema ni opis ni govor koji se može pročitati")
            _update(job_id, faza="Pravim recept")
            rezultat = extract_recipe(transcript, caption)
        else:
            _update(job_id, faza="Preuzimam video")
            video_path = download_video(url)
            if not transcript:
                _update(job_id, faza="Slušam govor u videu")
                try:
                    transcript = transcribe_audio(video_path)
                except Exception:
                    log.warning("Video nema audio", exc_info=True)
            _update(job_id, faza="Analiziram pokret")
            pose = analyze_video(video_path, sample_every_n_frames=6)
            _update(job_id, faza="Prepoznajem vežbu")
            rezultat = extract_exercise(transcript, pose, caption)
            rezultat["detektovano_ponavljanja"] = pose.get("detektovano_ponavljanja")

        _update(job_id, status="gotovo", faza="", rezultat=rezultat)

    except Exception:
        log.exception("Obrada nije uspela za %s", url)
        _update(job_id, status="greska", faza="", greska="Obrada nije uspela. Proveri link ili probaj ponovo.")
    finally:
        for p in (audio_path, video_path):
            if p and os.path.exists(p):
                os.remove(p)