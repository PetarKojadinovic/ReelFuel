"""Pravi ikone aplikacije (predlog 4: prsten kalorija sa slovom R).
Pokretanje iz korena repoa: backend/venv/Scripts/python scripts/make_icons.py
"""
import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "mobile" / "assets" / "images"
FONT = ROOT / "mobile" / "node_modules" / "@expo-google-fonts" / "nunito" / "900Black" / "Nunito_900Black.ttf"

BG = (0x11, 0x13, 0x11, 255)
TRACK = (0x25, 0x29, 0x23, 255)
GREEN = (0x7C, 0xFF, 0x3D, 255)
TEXT = (0xF3, 0xF5, 0xF0, 255)
WHITE = (255, 255, 255, 255)
SS = 4  # supersampling


def draw_logo(size, scale, bg=None, track=TRACK, arc=GREEN, text=TEXT):
    """Logo u viewBox-u 100x100 (kao SVG), centriran, `scale` px po jedinici."""
    S = size * SS
    k = scale * SS
    img = Image.new("RGBA", (S, S), bg or (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    cx = cy = S / 2

    def p(u):  # jedinica viewBox-a -> px, relativno na centar (50,50)
        return (u - 50) * k

    r, w = 32 * k, 10 * k
    box = [cx - r - w / 2, cy - r - w / 2, cx + r + w / 2, cy + r + w / 2]
    if track:
        d.ellipse(box, outline=track, width=round(w))
    sweep = 150 / (2 * math.pi * 32) * 360
    start, end = -90, -90 + sweep
    d.arc(box, start, end, fill=arc, width=round(w))
    for a in (start, end):  # zaobljeni krajevi
        x = cx + r * math.cos(math.radians(a))
        y = cy + r * math.sin(math.radians(a))
        d.ellipse([x - w / 2, y - w / 2, x + w / 2, y + w / 2], fill=arc)
    font = ImageFont.truetype(str(FONT), round(38 * k))
    d.text((cx, cy + p(52)), "R", font=font, fill=text, anchor="mm")
    return img.resize((size, size), Image.LANCZOS)


def save(img, name):
    img.save(OUT / name)
    print("ok", name, img.size)


save(draw_logo(1024, 1024 / 100, bg=BG), "icon.png")
save(draw_logo(1024, 7.6), "android-icon-foreground.png")
save(Image.new("RGBA", (1024, 1024), BG), "android-icon-background.png")
save(draw_logo(1024, 7.6, track=None, arc=WHITE, text=WHITE), "android-icon-monochrome.png")
save(draw_logo(1024, 1024 / 100), "splash-icon.png")
save(draw_logo(48, 48 / 100, bg=BG), "favicon.png")
