import logging

import whisper

log = logging.getLogger("transcription")

_model = None

# Segmenti iznad ovog praga su verovatno tišina/muzika — tu Whisper najčešće izmišlja tekst
NO_SPEECH_PRAG = 0.6
# Veoma nizak prosečni log-prob = model "pogađa"
MIN_AVG_LOGPROB = -1.0


def get_model():
    global _model
    if _model is None:
        _model = whisper.load_model("small")
    return _model


def _segment_ok(seg: dict) -> bool:
    if seg.get("no_speech_prob", 0) > NO_SPEECH_PRAG and seg.get("avg_logprob", 0) < -0.5:
        return False
    if seg.get("avg_logprob", 0) < MIN_AVG_LOGPROB:
        return False
    if seg.get("compression_ratio", 0) > 2.4:  # isti tekst se ponavlja u krug
        return False
    return True


def transcribe_audio(audio_path: str) -> str:
    """Vraća transkript bez segmenata koji su verovatno halucinacija (prazan string ako nema govora)."""
    model = get_model()
    result = model.transcribe(audio_path, language="sr", condition_on_previous_text=False)
    segments = result.get("segments") or []
    if not segments:
        return (result.get("text") or "").strip()

    dobri = [s for s in segments if _segment_ok(s)]
    odbaceno = len(segments) - len(dobri)
    if odbaceno:
        log.info("Whisper: odbaceno %d/%d segmenata (verovatno tisina/muzika)", odbaceno, len(segments))
    return " ".join((s.get("text") or "").strip() for s in dobri).strip()
