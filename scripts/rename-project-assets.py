#!/usr/bin/env python3
"""Dry-run asset cleanup for featured work. Requires Python 3.10+.
Run: python scripts/rename-project-assets.py
Apply: python scripts/rename-project-assets.py --apply
Requires Pillow to convert JPEG ticket files to WebP; ffmpeg for video posters.
Always review scripts/project-asset-map.csv before --apply.
"""
import argparse
import csv
import json
import re
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/content/work.json"
CSV = ROOT / "scripts/project-asset-map.csv"
SLUGS = {"achievers-2026", "unity-cup-2026", "welcome-to-ldn-2025"}
TEXT_EXT = {".astro", ".json", ".ts", ".js", ".css", ".md", ".mdx", ".xml", ".html", ".yml", ".yaml"}
EXCLUDE = {"node_modules", ".git", "dist", ".astro"}

def slugify(name):
    name = re.sub(r"(?i)\s*\(\s*ver(?:sion)?\s*\d+\s*\)", "", name)
    name = re.sub(r"(?i)\s+ver(?:sion)?\s+\d+(?=\.)", "", name)
    name = re.sub(r"(?i)boiler[\s-]*plate", "boilerplate", name)
    name = name.replace("'", "").replace("’", "")
    name = re.sub(r"(?i)\bversion-(\d+)\b", r"\1", name)
    name = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return name

def destination(url, project):
    path = Path(url)
    ext = path.suffix.lower()
    stem = slugify(path.stem)
    if ext == ".mp4":
        return "/video/" + project + "-" + stem + ".mp4"
    if project == "achievers-2026" and path.name.lower() in ("achievers-ticket-back.jpg", "achievers-ticket-02.jpg"):
        ext = ".webp"
        stem = "achievers-ticket-back" if "back" in stem else "achievers-ticket-front"
    return str(path.parent / (stem + ext))

def walk_paths(value):
    if isinstance(value, dict):
        for key, item in value.items():
            if key in ("src", "poster", "primaryImage") and isinstance(item, str) and item.startswith("/"):
                yield item
            elif isinstance(item, (dict, list)):
                yield from walk_paths(item)
    elif isinstance(value, list):
        for item in value:
            yield from walk_paths(item)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="Move files and rewrite references (default dry run)")
    args = ap.parse_args()
    data = json.loads(DATA.read_text(encoding="utf8"))
    mapping = {}
    for project in data.get("featured", []):
        if project.get("slug") not in SLUGS:
            continue
        for old in walk_paths(project):
            new = destination(old, project["slug"])
            if old != new:
                mapping[old] = new
    # Check paths before modifying anything.
    if len(mapping.values()) != len(set(mapping.values())):
        raise SystemExit("Destination collision detected: review mapping")
    rows = []
    for old, new in sorted(mapping.items()):
        src, dst = ROOT / "public" / old.lstrip("/"), ROOT / "public" / new.lstrip("/")
        size = src.stat().st_size if src.is_file() else None
        rows.append({"old": old, "new": new, "bytes": size if size is not None else "",
                     "source_exists": "yes" if size is not None else "NO",
                     "action": "convert-webp" if src.suffix.lower() in (".jpg", ".jpeg") and dst.suffix == ".webp" else "move"})
    CSV.parent.mkdir(exist_ok=True)
    with CSV.open("w", newline="", encoding="utf8") as fp:
        writer = csv.DictWriter(fp, fieldnames=["old", "new", "bytes", "source_exists", "action"])
        writer.writeheader()
        writer.writerows(rows)
    print("Mapping:", CSV, "entries:", len(rows))
    for row in rows:
        print(row["action"], row["old"], "=>", row["new"], row["bytes"], "bytes")
    missing = [r for r in rows if r["source_exists"] == "NO"]
    if missing:
        print("Missing originals:", len(missing))
    videos = [r for r in rows if r["old"].lower().endswith(".mp4")]
    print("Video size report:")
    for r in videos:
        mb = round(int(r["bytes"]) / 1048576, 2) if r["bytes"] != "" else "unavailable"
        print(r["old"], mb, "MiB")
    if not args.apply:
        print("DRY RUN ONLY: no assets/references modified. For videos, consider H.264 CRF 23-28, -movflags +faststart and 720p/1080p where suitable.")
        return
    if missing:
        raise SystemExit("Cannot apply: at least one referenced source file is missing.")
    if any(r["action"] == "convert-webp" for r in rows):
        try:
            from PIL import Image
        except ImportError:
            raise SystemExit("Install Pillow before applying JPEG->WebP conversions: pip install Pillow")
    for row in rows:
        src = ROOT / "public" / row["old"].lstrip("/")
        dst = ROOT / "public" / row["new"].lstrip("/")
        if dst.exists():
            raise SystemExit("Refusing to overwrite existing destination: " + str(dst))
    for row in rows:
        src = ROOT / "public" / row["old"].lstrip("/")
        dst = ROOT / "public" / row["new"].lstrip("/")
        dst.parent.mkdir(parents=True, exist_ok=True)
        if row["action"] == "convert-webp":
            from PIL import Image
            with Image.open(src) as im:
                im.save(dst, "WEBP", quality=85, method=6)
            # Keep source as backup until review; report as orphan after migration.
        else:
            shutil.move(str(src), str(dst))
    # Safely update every occurrence in text sources, not just work.json.
    for path in ROOT.rglob("*"):
        if not path.is_file() or path.suffix.lower() not in TEXT_EXT:
            continue
        if any(part in EXCLUDE for part in path.relative_to(ROOT).parts):
            continue
        source = path.read_text(encoding="utf8")
        updated = source
        for old, new in mapping.items():
            updated = updated.replace(old, new)
        if updated != source:
            path.write_text(updated, encoding="utf8")
            print("Updated references:", path.relative_to(ROOT))
    # Generate missing video posters if ffmpeg is available; add their paths to work.json.
    if shutil.which("ffmpeg"):
        data = json.loads(DATA.read_text(encoding="utf8"))
        for project in data.get("featured", []):
            if project.get("slug") not in SLUGS:
                continue
            for item in project.get("media", []):
                if item.get("type") != "video" or item.get("poster"):
                    continue
                poster = "/img/work/" + ("ldn-2025" if project["slug"] == "welcome-to-ldn-2025" else project["slug"]) + "/" + slugify(Path(item["src"]).stem) + "-poster.webp"
                out = ROOT / "public" / poster.lstrip("/")
                out.parent.mkdir(parents=True, exist_ok=True)
                subprocess.run(["ffmpeg", "-y", "-ss", "00:00:01", "-i", str(ROOT / "public" / item["src"].lstrip("/")), "-frames:v", "1", str(out)], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                item["poster"] = poster
        DATA.write_text(json.dumps(data, indent=2) + "\n", encoding="utf8")
    else:
        print("ffmpeg not available: add missing video poster images before publishing.")
    print("Applied. Verify build and visually check all files; original converted JPEGs remain as potential orphans.")
if __name__ == "__main__":
    main()
