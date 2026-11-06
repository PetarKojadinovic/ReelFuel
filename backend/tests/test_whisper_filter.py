"""Filter Whisper segmenata i skidanje reela bez zvuka.

Brojevi su izmereni na pravim Instagram reelovima 2026-11-06 (scripts/whisper_prag.py).
"""
import os

import pytest

from app.services import video_downloader
from app.services.transcription import _segment_ok


def seg(nsp, lp, cr):
    return {"no_speech_prob": nsp, "avg_logprob": lp, "compression_ratio": cr}


@pytest.mark.parametrize("s", [
    seg(0.14, -0.26, 1.62),  # jasan govor
    seg(0.03, -0.24, 1.51),  # jasan govor
    seg(0.58, -0.39, 1.59),  # govor preko muzike: visok no_speech, ali model je siguran
    seg(0.10, -0.52, 1.46),  # govor preko muzike, najniži log-prob od pravog govora
    seg(0.01, -0.43, 1.38),  # govor preko muzike
])
def test_pravi_govor_ostaje(s):
    assert _segment_ok(s)


def test_izmisljen_tekst_na_muzici_se_odbacuje():
    assert not _segment_ok(seg(0.41, -3.07, 0.27))  # samo muzika: Whisper izmisli "..."


def test_reel_bez_audio_trake_ne_ostavlja_fajl(tmp_path, monkeypatch):
    monkeypatch.setattr(video_downloader, "DOWNLOAD_DIR", str(tmp_path))

    class LazniYDL:
        def __init__(self, opts):
            self.sablon = opts["outtmpl"]

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def download(self, urls):
            open(self.sablon.replace("%(ext)s", "mp4"), "wb").write(b"video bez zvuka")
            raise video_downloader.yt_dlp.utils.DownloadError("unable to obtain file audio codec with ffprobe")

    monkeypatch.setattr(video_downloader.yt_dlp, "YoutubeDL", LazniYDL)
    with pytest.raises(video_downloader.yt_dlp.utils.DownloadError):
        video_downloader.download_audio("https://www.instagram.com/reel/x/")
    assert os.listdir(tmp_path) == []
