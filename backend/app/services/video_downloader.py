import yt_dlp
import os
import uuid
import subprocess


DOWNLOAD_DIR = "downloads"

# Ogranicenja (zastita od punog diska i sati Whisper-a na CPU-u)
MAX_TRAJANJE_S = 10 * 60          # reelovi su kratki; duze od 10 min se odbija
MAX_VELICINA_B = 200 * 1024 * 1024  # 200 MB po fajlu


class PreuzimanjeOdbijeno(ValueError):
    """Video je predug, prevelik ili nije pojedinacan video."""


def _filter(info, *, incomplete=False):
    """yt-dlp match_filter: vrati tekst = preskoci, None = dozvoli."""
    trajanje = info.get("duration")
    if trajanje and trajanje > MAX_TRAJANJE_S:
        return f"Video traje {int(trajanje)} s (dozvoljeno najvise {MAX_TRAJANJE_S} s)"
    if info.get("is_live"):
        return "Prenos uzivo nije podrzan"
    return None


BASE_OPTS = {
    "quiet": True,
    "noplaylist": True,       # samo jedan video, nikad ceo profil/playlistu
    "playlist_items": "1",
    "max_filesize": MAX_VELICINA_B,
    "match_filter": _filter,
}


def proveri_trajanje(duration) -> None:
    if duration and duration > MAX_TRAJANJE_S:
        raise PreuzimanjeOdbijeno(f"Video je predugačak (najviše {MAX_TRAJANJE_S // 60} min)")


def _mora_postojati(path: str) -> str:
    if not os.path.exists(path):
        raise PreuzimanjeOdbijeno("Video nije preuzet (predugačak, prevelik ili nedostupan)")
    return path

def download_audio(url: str) -> str:
    """
    Preuzima audio iz videa (TikTok/IG link) i vraca putanju do fajla.
    """
    os.makedirs(DOWNLOAD_DIR, exist_ok=True)

    file_id = str(uuid.uuid4())
    output_path = os.path.join(DOWNLOAD_DIR, f"{file_id}.%(ext)s")

    ydl_opts = {
        **BASE_OPTS,
        "format": "bestaudio/best",
        "outtmpl": output_path,
        "postprocessors": [{
            "key": "FFmpegExtractAudio",
            "preferredcodec": "mp3",
            "preferredquality": "192",
        }],
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        ydl.download([url])

    final_path = os.path.join(DOWNLOAD_DIR, f"{file_id}.mp3")
    return _mora_postojati(final_path)



def download_video(url: str) -> str:
    """
    Preuzima video (slika + zvuk) i vraca putanju do fajla.
    Eksplicitno spaja najbolji video i audio stream da osiguramo da zvuk postoji.
    """
    os.makedirs(DOWNLOAD_DIR, exist_ok=True)

    file_id = str(uuid.uuid4())
    output_path = os.path.join(DOWNLOAD_DIR, f"{file_id}.%(ext)s")

    ydl_opts = {
        **BASE_OPTS,
        "format": "bestvideo+bestaudio/best",
        "merge_output_format": "mp4",
        "outtmpl": output_path,
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=True)
        if not info:
            raise PreuzimanjeOdbijeno("Video nije preuzet (predugačak, prevelik ili nedostupan)")
        final_path = ydl.prepare_filename(info)
        if not final_path.endswith(".mp4"):
            final_path = os.path.splitext(final_path)[0] + ".mp4"

    return _mora_postojati(final_path)


def get_caption(url: str) -> str:
    """
    Vraca opis objave (caption) bez preuzimanja videa.
    """
    ydl_opts = {"quiet": True, "skip_download": True, "noplaylist": True, "playlist_items": "1"}
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=False)
    return info.get("description", "") or ""


def extract_frames(video_path: str, max_frames: int = 6) -> list[str]:
    """
    Izvlaci ravnomerno rasporedjene frejmove iz videa za vizuelnu analizu
    (hvata tekst sastojaka/koraka ispisan na snimku).
    """
    frame_dir = os.path.join(DOWNLOAD_DIR, f"frames_{uuid.uuid4()}")
    os.makedirs(frame_dir, exist_ok=True)

    probe = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", video_path],
        capture_output=True, text=True
    )
    duration = float(probe.stdout.strip() or 0) or max_frames
    interval = duration / max_frames

    frame_paths = []
    for i in range(max_frames):
        timestamp = i * interval
        frame_path = os.path.join(frame_dir, f"frame_{i}.jpg")
        subprocess.run(
            ["ffmpeg", "-ss", str(timestamp), "-i", video_path,
             "-frames:v", "1", "-q:v", "2", frame_path, "-y"],
            capture_output=True
        )
        if os.path.exists(frame_path):
            frame_paths.append(frame_path)

    return frame_paths


def fetch_metadata(url: str) -> dict:
    """Cita opis i naslov videa bez preuzimanja."""
    opts = {"quiet": True, "skip_download": True, "noplaylist": True, "playlist_items": "1"}
    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(url, download=False)
    return {
        "title": info.get("title"),
        "description": info.get("description"),
        "uploader": info.get("uploader"),
        "duration": info.get("duration"),
    }