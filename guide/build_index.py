"""Build the portable findings guide from real screenshots of the explorer."""
import base64
import html
import io
from pathlib import Path
import sys

from PIL import Image, ImageStat

ROOT = Path(__file__).resolve().parents[1]
GUIDE = ROOT / "guide"
# Each entry has a title, explanation, screenshot caption, action and app URL.
CAPTIONS = {
    "01-arctic": (
        "The Arctic warmed about 3.3 times as fast as the world.",
        "From 1980 to 2025 the Arctic warmed by 0.69 °C per decade. The world warmed by 0.21 °C per decade over the same years.",
        "The outline marks the Arctic region. The panel compares its warming rate with the world’s.",
        "See the Arctic result", "../?start=1980&region=Arctic&finding=arctic"),
    "02-atlantic": (
        "The ocean south of Greenland lagged behind.",
        "Over 1900–2025, this North Atlantic region warmed by an estimated 0.01 °C per decade. The world warmed by 0.10. A blue area on this map can still have warmed.",
        "The outlined region’s estimated warming rate was 0.09 °C per decade below the world’s.",
        "See the North Atlantic result", "../?start=1900&region=North+Atlantic&finding=hole"),
    "03-people": (
        "In India, about half of residents lived in faster-warming places.",
        "Using 1980–2025 trends, 52.4% of India’s 2020 residents in places with complete records lived in grid squares warming faster than the world. Across all countries the share was 83.5%. The world temperature benchmark includes oceans.",
        "The coloured bar and the two table rows use the same temperature period and 2020 population estimates.",
        "Choose another country", "../?start=1980&country=IND#population"),
    "04-water": (
        "Two regions ended the 2025 monsoon on opposite sides of their usual storage.",
        "Northwest India held less water than its 2004–2009 average, equivalent to a 16.2 cm layer spread across the region. Madhya Pradesh was 32.5 cm above its own average. GRACE measures changes in total stored water above and below ground.",
        "October and November 2025, on one colour scale. Each region is compared with its own past.",
        "Open water and select 2025", "../water/"),
    "05-period": (
        "Does the North Atlantic finding hold over fewer years?",
        "Switch between 1900–2025 and 1980–2025 without changing the region. In the shorter record the estimated gap is +0.03 °C per decade, with a 95% interval from −0.11 to +0.17. Both slower and faster warming fit that range.",
        "The shorter record leaves the difference from the world’s rate uncertain.",
        "Compare the two periods", "../?start=1980&region=North+Atlantic&mode=relative"),
    "06-year": (
        "What does blue mean in a single year?",
        "Start at 2015 and move the slider. In By year, blue means cooler than that place’s 1951–1980 average. Switch to Trend and choose Compared with the world to see where warming was slower than the global rate.",
        "In By year, the slider moves the annual map and the temperature chart together.",
        "Try the Arctic in 2015", "../?start=1980&region=Arctic&view=annual&year=2015"),
    "07-neighbour": (
        "Does the water story change when you choose a different neighbour?",
        "Select 2025 and keep northwest India fixed. Switch Madhya Pradesh to Uttar Pradesh. Uttar Pradesh was 6.3 cm below its own average, so both regions were below average in this pairing. Try 2021 next.",
        "The 2025 chart compares northwest India with Uttar Pradesh over the same October–November seasons.",
        "Open water and switch regions", "../water/"),
}
SECTIONS = [
    ("findings", "What are the conclusions?", "Read each result with its comparison and time period.",
     ["01-arctic", "02-atlantic", "03-people", "04-water"]),
    ("explore", "What should you explore?", "Keep one choice fixed and change another. The links open the relevant explorer.",
     ["05-period", "06-year", "07-neighbour"]),
]


def picture(source):
    with Image.open(source) as im:
        rgb = im.convert("RGB")
        if max(ImageStat.Stat(rgb.resize((80, 80))).stddev) < 3:
            raise ValueError(f"Blank screenshot: {source}")
        data = io.BytesIO()
        rgb.save(data, format="WEBP", quality=88, method=6)
        return base64.b64encode(data.getvalue()).decode("ascii"), rgb.size


def build(directory):
    sections = []
    for anchor, heading, intro, ids in SECTIONS:
        cards = []
        for slug in ids:
            title, finding, caption, action, url = CAPTIONS[slug]
            src, (width, height) = picture(directory / "screenshots" / "visitor" / (slug + ".png"))
            keywords = html.escape(" ".join(("visitor", slug, title, finding, caption, action)).lower(), quote=True)
            cards.append(f'''<article id="{slug}" data-search="{keywords}">
<div class="copy"><h3>{html.escape(title)}</h3><p>{html.escape(finding)}</p><a class="action" href="{html.escape(url)}">{html.escape(action)} →</a></div>
<figure><button class="zoom" aria-label="Enlarge screenshot: {html.escape(title, quote=True)}"><img width="{width}" height="{height}" src="data:image/webp;base64,{src}" alt="{html.escape(caption, quote=True)}"></button><figcaption>{html.escape(caption)}</figcaption></figure></article>''')
        sections.append(f'<section id="{anchor}"><h2>{heading}</h2><p class="intro">{intro}</p>{"".join(cards)}</section>')
    stylesheet = (ROOT / "docs/map/style.css").read_text()
    tokens = stylesheet.split(":root {", 1)[1].split("}", 1)[0].strip()
    font = (ROOT / "docs/fonts/schibsted-grotesk-latin-wght-normal.woff2").read_bytes()
    page = (GUIDE / "template.html").read_text().replace("{{tokens}}", tokens).replace(
        "{{font}}", base64.b64encode(font).decode()).replace("{{sections}}", "\n".join(sections))
    output = ROOT / "docs/guide/index.html"
    output.parent.mkdir(exist_ok=True)
    temp = output.with_suffix(".tmp")
    temp.write_text(page)
    temp.replace(output)
    print(f"{len(CAPTIONS)} screenshots in {len(SECTIONS)} sections · {output.stat().st_size:,} bytes")


if __name__ == "__main__":
    build(Path(sys.argv[1]))
