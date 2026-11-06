#!/usr/bin/env python3
"""Auditable featured-project migration. Python 3.10+, Pillow for ticket conversion.

Default: inspect the mapping without changing files.
  python scripts/rename-project-assets.py
Original-checkout migration:
  python scripts/rename-project-assets.py --apply
Ticket conversion AFTER the migration:
  python scripts/rename-project-assets.py --convert-ticket
Orphan report and proposed removal command:
  python scripts/rename-project-assets.py --orphans

The repository's current commit may already contain the 59 moves. Applied
moves are skipped when their new paths exist and old paths are absent.
"""
import argparse
import csv
import json
import re
import subprocess
import sys
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parents[1]
MAPPING = ROOT / "scripts/project-asset-map.csv"
CONTENT = ROOT / "src/content/work.json"
ROOTS = ["public/img/work/achievers-2026", "public/img/work/unity-cup-2026",
         "public/img/work/ldn-2025", "public/video"]
TEXT_EXT = {".astro", ".json", ".ts", ".js", ".css", ".md", ".mdx", ".xml", ".html", ".yml", ".yaml"}
EXCLUDES = {".git", "node_modules", ".astro", "dist"}
TICKET_OLD = ROOT / "public/img/work/achievers-2026/merch/Achievers-ticket-back.jpg"
TICKET_JPG = ROOT / "public/img/work/achievers-2026/merch/achievers-ticket-back.jpg"
TICKET_WEBP = TICKET_JPG.with_suffix(".webp")

def git(*args, check=True):
    return subprocess.run(["git", *args], cwd=ROOT, check=check,
                          capture_output=True, text=True)

def rows():
    with MAPPING.open(newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))

def files_to_update():
    for tree in ("src", "public"):
        base = ROOT / tree
        for p in base.rglob("*"):
            if p.is_file() and p.suffix.lower() in TEXT_EXT and not any(
                    seg in EXCLUDES for seg in p.relative_to(ROOT).parts):
                yield p

def replace_references(mapping):
    for p in files_to_update():
        original = p.read_text(encoding="utf-8")
        updated = original
        for old, new in mapping:
            for source, target in ((old, new),
                                   (quote(old, safe="/"), quote(new, safe="/"))):
                updated = updated.replace(source, target)
        if updated != original:
            p.write_text(updated, encoding="utf-8")
            print("REFERENCES", p.relative_to(ROOT))

def apply_renames(mapping):
    targets = [new for _, new in mapping]
    if len(set(targets)) != len(targets):
        raise RuntimeError("Destination collisions: refusing all moves")
    moves = []
    for old, new in mapping:
        src = ROOT / "public" / old.lstrip("/")
        dest = ROOT / "public" / new.lstrip("/")
        if dest.exists() and src.exists():
            if old.endswith("Achievers-ticket-back.jpg"):
                print("PRESERVE original ticket JPEG:", old)
                continue
            raise RuntimeError(f"Refusing existing destination: {dest}")
        if not src.exists() and dest.exists():
            print("ALREADY MOVED", old, "=>", new)
            continue
        if not src.exists():
            raise FileNotFoundError(src)
        moves.append((src, dest, old.endswith("Achievers-ticket-back.jpg")))
    if git("status", "--porcelain").stdout.strip():
        raise RuntimeError("Working tree has uncommitted changes; refusing to migrate")
    for src, dest, keep in moves:
        dest.parent.mkdir(parents=True, exist_ok=True)
        if dest.exists():
            raise FileExistsError(dest)
        if keep:
            import shutil
            shutil.copy2(src, dest)
            git("add", "--", str(dest.relative_to(ROOT)))
            print("COPY", src.relative_to(ROOT), "=>", dest.relative_to(ROOT))
        else:
            # The temp hop is necessary for case-insensitive Windows/macOS filesystems.
            if str(src).casefold() == str(dest).casefold():
                temp = src.with_name(src.stem + "-temp-rename-" + src.suffix)
                if temp.exists():
                    raise FileExistsError(temp)
                git("mv", "--", str(src.relative_to(ROOT)), str(temp.relative_to(ROOT)))
                git("mv", "--", str(temp.relative_to(ROOT)), str(dest.relative_to(ROOT)))
            else:
                git("mv", "--", str(src.relative_to(ROOT)), str(dest.relative_to(ROOT)))
            print("MOVED", src.relative_to(ROOT), "=>", dest.relative_to(ROOT))
    replace_references(mapping)
    print("Run npm run build and git add/commit after verifying results.")

def convert_ticket():
    try:
        from PIL import Image
    except ImportError as exc:
        raise SystemExit("Install Pillow: python -m pip install Pillow") from exc
    source = TICKET_JPG if TICKET_JPG.exists() else TICKET_OLD
    if not source.exists():
        raise FileNotFoundError(source)
    if TICKET_WEBP.exists():
        raise FileExistsError(f"Refusing to overwrite {TICKET_WEBP}")
    with Image.open(source) as picture:
        dimensions = picture.size
        picture.save(TICKET_WEBP, format="WEBP", quality=85, method=6)
    with Image.open(TICKET_WEBP) as picture:
        if picture.size != dimensions:
            raise RuntimeError("Conversion changed the ticket's dimensions")
    old_url = "/" + str(source.relative_to(ROOT / "public")).replace("\\", "/")
    new_url = "/" + str(TICKET_WEBP.relative_to(ROOT / "public")).replace("\\", "/")
    replace_references([(old_url, new_url)])
    print("Ticket dimensions:", dimensions, "before:", source.stat().st_size,
          "bytes; after:", TICKET_WEBP.stat().st_size, "bytes")
    print("Original JPEG preserved:", source)
    print("Run git add and npm run build; inspect before approving JPEG removal.")

def report_orphans():
    references = "\n".join(p.read_text(encoding="utf-8") for p in files_to_update())
    orphans = []
    for folder in ROOTS:
        base = ROOT / folder
        if not base.exists():
            continue
        for path in base.rglob("*"):
            if not path.is_file() or path.suffix.lower() not in {".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg", ".mp4", ".webm"}:
                continue
            url = "/" + str(path.relative_to(ROOT / "public")).replace("\\", "/")
            if url not in references and quote(url, safe="/") not in references:
                orphans.append(path.relative_to(ROOT).as_posix())
    print("Unreferenced asset candidates:", len(orphans))
    for p in orphans:
        print("ORPHAN:", p)
    if orphans:
        print("REVIEW BEFORE DELETING. Proposed command (do not run until approved):")
        print("git rm -- " + " ".join('"' + p.replace('"', '\\"') + '"' for p in orphans))
    else:
        print("No orphan candidates in scanned folders. Check dynamically generated paths separately.")

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="Apply moves using git mv")
    ap.add_argument("--convert-ticket", action="store_true", help="Create ticket WebP, retain JPEG")
    ap.add_argument("--orphans", action="store_true", help="List unreferenced assets, do not delete")
    options = ap.parse_args()
    mapping = [(row["old"], row["new"]) for row in rows()]
    print("Mapped assets:", len(mapping))
    for old, new in mapping:
        print(old, "=>", new)
    if options.apply:
        apply_renames(mapping)
    if options.convert_ticket:
        convert_ticket()
    if options.orphans:
        report_orphans()
    if not (options.apply or options.convert_ticket or options.orphans):
        print("Dry run: no files changed. Already-moved assets require no further git mv.")
if __name__ == "__main__":
    main()
