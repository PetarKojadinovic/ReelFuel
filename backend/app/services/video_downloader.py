import yt_dlp
import os
import uuid
import subprocess


DOWNLOAD_DIR = "downloads"

def download_audio(url: str) -> str:
    """
    Preuzima audio iz videa (TikTok/IG link) i vraca putanju do fajla.
    """
    os.makedirs(DOWNLOAD_DIR, exist_ok=True)

    file_id = str(uuid.uuid4())
    output_path = os.path.join(DOWNLOAD_DIR, f"{file_id}.%(ext)s")

    ydl_opts = {
        "format": "bestaudio/best",
        "outtmpl": output_path,
        "postprocessors": [{
            "key": "FFmpegExtractAudio",
            "preferredcodec": "mp3",
            "preferredquality": "192",
        }],
        "quiet": True,
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        ydl.download([url])

    final_path = os.path.join(DOWNLOAD_DIR, f"{file_id}.mp3")
    return final_path



def download_video(url: str) -> str:
    """
    Preuzima video (slika + zvuk) i vraca putanju do fajla.
    Eksplicitno spaja najbolji video i audio stream da osiguramo da zvuk postoji.
    """
    os.makedirs(DOWNLOAD_DIR, exist_ok=True)

    file_id = str(uuid.uuid4())
    output_path = os.path.join(DOWNLOAD_DIR, f"{file_id}.%(ext)s")

    ydl_opts = {
        "format": "bestvideo+bestaudio/best",
        "merge_output_format": "mp4",
        "outtmpl": output_path,
        "quiet": True,
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=True)
        final_path = ydl.prepare_filename(info)
        if not final_path.endswith(".mp4"):
            final_path = os.path.splitext(final_path)[0] + ".mp4"

    return final_path


def get_caption(url: str) -> str:
    """
    Vraca opis objave (caption) bez preuzimanja videa.
    """
    ydl_opts = {"quiet": True, "skip_download": True}
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