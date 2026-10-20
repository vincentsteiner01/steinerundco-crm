"""Rendert die Erweiterungs-Icons (16/32/48/128 px) aus dem App-Icon des CRM (../public/icon-512.png):
seit dem hellen Design (20.10.2026) ein weißes „&“ auf Blau – dasselbe Symbol wie Favicon und Marke im CRM.

Aufruf (in extension/):  python3 -I scripts/icons.py
Ausgabe: static/icons/icon-<n>.png
"""
import pathlib

from PIL import Image

HIER = pathlib.Path(__file__).resolve().parent.parent
QUELLE = HIER.parent / "public" / "icon-512.png"
ZIEL = HIER / "static" / "icons"


def main() -> None:
    bild = Image.open(QUELLE).convert("RGBA")
    ZIEL.mkdir(parents=True, exist_ok=True)
    for g in (16, 32, 48, 128):
        bild.resize((g, g), Image.Resampling.LANCZOS).save(ZIEL / f"icon-{g}.png", optimize=True)
        print(f"icon-{g}.png")


if __name__ == "__main__":
    main()
