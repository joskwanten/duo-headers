"""Genereert de extensie-iconen (src/icons/icon-{16,32,48,128}.png): "DH" (DUO Headers).

Eenmalig/na een ontwerpwijziging draaien: python3 scripts/make-icons.py
De PNG's worden meegecommit; dit script is alleen nodig om ze opnieuw te maken.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

FONTS = [
    "/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
]

S = 512
BLUE = (37, 99, 235, 255)
WHITE = (255, 255, 255, 255)


def font(size):
    for f in FONTS:
        if Path(f).exists():
            return ImageFont.truetype(f, size)
    raise SystemExit("Geen vet font gevonden; pas FONTS aan.")


img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(img)
d.rounded_rectangle([16, 16, S - 16, S - 16], radius=110, fill=BLUE)

# "DH" gecentreerd op basis van de werkelijke inktgrenzen van de letters.
f = font(270)
left, top, right, bottom = d.textbbox((0, 0), "DH", font=f)
x = (S - (right - left)) / 2 - left
y = (S - (bottom - top)) / 2 - top
d.text((x, y), "DH", font=f, fill=WHITE)

out = Path(__file__).resolve().parent.parent / "src" / "icons"
out.mkdir(parents=True, exist_ok=True)
for size in (16, 32, 48, 128):
    img.resize((size, size), Image.LANCZOS).save(out / f"icon-{size}.png")
print("Iconen geschreven naar", out)
