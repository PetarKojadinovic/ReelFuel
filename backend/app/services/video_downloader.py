import yt_dlp
import os
import uuid

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