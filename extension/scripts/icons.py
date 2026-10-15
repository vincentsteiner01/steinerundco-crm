"""Rendert die Erweiterungs-Icons (16/32/48/128 px) im Look des CRM-Favicons: dunkle Tinte, Lime „S&“ kursiv.

Aufruf (in extension/):  python3 -I scripts/icons.py
Schrift: Georgia Italic (macOS) wie favicon.svg; Ausgabe: static/icons/icon-<n>.png
"""
import pathlib
import sys

from PIL import Image, ImageDraw, ImageFont

HIER = pathlib.Path(__file__).resolve().parent.parent
ZIEL = HIER / "static" / "icons"
TINTE = (7, 8, 13, 255)
LIME = (202, 255, 104, 255)
SCHRIFTEN = [
    "/System/Library/Fonts/Supplemental/Georgia Italic.ttf",
    "/Library/Fonts/Georgia Italic.ttf",
    "/usr/share/fonts/truetype/msttcorefonts/Georgia_Italic.ttf",
]


def schrift(groesse: int) -> ImageFont.FreeTypeFont:
    for pfad in SCHRIFTEN:
        if pathlib.Path(pfad).exists():
            return ImageFont.truetype(pfad, groesse)
    sys.exit("Georgia Italic nicht gefunden – Pfad in scripts/icons.py ergänzen.")


def icon(n: int) -> Image.Image:
    skala = 8
    g = n * skala
    bild = Image.new("RGBA", (g, g), (0, 0, 0, 0))
    d = ImageDraw.Draw(bild)
    d.rounded_rectangle((0, 0, g - 1, g - 1), radius=round(g * 12 / 64), fill=TINTE)
    text = "S&"
    f = schrift(round(g * (38 if n >= 32 else 40) / 64))
    links, oben, rechts, unten = d.textbbox((0, 0), text, font=f)
    x = (g - (rechts - links)) / 2 - links
    y = (g - (unten - oben)) / 2 - oben
    d.text((x, y), text, font=f, fill=LIME)
    return bild.resize((n, n), getattr(Image, "Resampling", Image).LANCZOS)


def main() -> None:
    ZIEL.mkdir(parents=True, exist_ok=True)
    for n in (16, 32, 48, 128):
        icon(n).save(ZIEL / f"icon-{n}.png", optimize=True)
        print(f"static/icons/icon-{n}.png")


if __name__ == "__main__":
    main()
