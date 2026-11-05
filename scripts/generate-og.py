"""Rebuild the homepage Open Graph PNG from the site's bundled assets."""
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
from fontTools.ttLib import TTFont
import cairosvg

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public/img/og-home-v2.png"
WIDTH, HEIGHT = 1200, 630
BG = "#0b0b0c"
INK = "#edede7"

# Load exactly the same Geist Mono font shipped to the site.
font = TTFont(ROOT / "public/fonts/geist-mono-latin.woff2")
font.flavor = None
ttf = BytesIO()
font.save(ttf)
font.close()
font_bytes = ttf.getvalue()

def geist(size):
    return ImageFont.truetype(BytesIO(font_bytes), size)

im = Image.new("RGB", (WIDTH, HEIGHT), BG)
draw = ImageDraw.Draw(im)

# Keep the original minimal monochrome structure; no redundant top brand line.
draw.line((65, 90, 1135, 90), fill=INK, width=2)
draw.text((65, 151), "VIPUL M.R", font=geist(114), fill=INK, stroke_width=0)
draw.text((65, 340), "VISUAL DESIGN AND MOTION", font=geist(44), fill=INK)
draw.line((65, 454, 1135, 454), fill=INK, width=2)

# Use the actual site's light-on-dark favicon, not a substitute P monogram.
svg = (ROOT / "public/img/favicon-light.svg").read_bytes()
png = cairosvg.svg2png(bytestring=svg, output_width=64, output_height=64)
logo = Image.open(BytesIO(png)).convert("RGBA")
im.paste(logo, (1051, 496), logo)

OUT.parent.mkdir(parents=True, exist_ok=True)
im.save(OUT, "PNG", optimize=True)
print(f"Generated {OUT.relative_to(ROOT)}")

# Switch preview metadata only after the PNG has actually been rendered.
for relative_path in ("src/pages/index.astro", "src/layouts/Base.astro"):
    target = ROOT / relative_path
    old = target.read_text()
    new = old.replace('"/img/og-home.png"', '"/img/og-home-v2.png"')
    if new != old:
        target.write_text(new)
