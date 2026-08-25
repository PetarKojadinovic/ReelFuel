import whisper

_model = None

def get_model():
    global _model
    if _model is None:
        _model = whisper.load_model("small")
    return _model

def transcribe_audio(audio_path: str) -> str:
    """
    Prima putanju do audio fajla i vraca transkribovan tekst.
    """
    model = get_model()
    result = model.transcribe(audio_path, language="sr")
    return result["text"]