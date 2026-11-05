#!/usr/bin/env python3
"""Safely rename archive assets and rewrite their URLs.

Usage:
    python scripts/rename-archive-assets.py              # dry run, no edits
    python scripts/rename-archive-assets.py --test-one   # move one file, verify, then revert
    python scripts/rename-archive-assets.py --apply      # migrate on local checkout
    python scripts/rename-archive-assets.py --check      # check every URL (404 prevention)

All moves preserve original bytes; no image transcoding or placeholder writes.
"""
import argparse
import csv
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MAPPING = ROOT / "scripts/archive-asset-map.csv"
ARCHIVE = ROOT / "src/content/archive.json"
TEXT_EXTENSIONS = {".astro", ".json", ".ts", ".tsx", ".js", ".css", ".html", ".md", ".mjs"}


def digest(path):
    h = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def mappings():
    with MAPPING.open(newline="", encoding="utf-8") as stream:
        return list(csv.DictReader(stream))


def check(rows):
    invalid = []
    for entry in rows:
        dest = ROOT / entry["new_path"]
        if not dest.is_file() or dest.stat().st_size != int(entry["bytes"]) or dest.stat().st_size <= 2:
            invalid.append(entry["new_path"])
    data = json.loads(ARCHIVE.read_text(encoding="utf-8"))
    for project in data:
        for url in [project.get("cover"), *(item.get("src") for item in project["items"]),
                    *(item.get("poster") for item in project["items"])]:
            if url and not (ROOT / "public" / url.lstrip("/")).is_file():
                invalid.append(url)
    if invalid:
        raise RuntimeError("Unresolved asset URLs / invalid sizes:\n" + "\n".join(sorted(set(invalid))))
    print(f"Verified {len(rows)} asset paths, sizes and all archive image/video URLs: no local 404s.")


def move_verified(old, new, expected_size):
    if expected_size <= 2:
        raise RuntimeError(f"Refusing suspicious two-byte asset: {old}")
    if not old.is_file() or old.stat().st_size != expected_size:
        raise RuntimeError(f"Source missing/size mismatch: {old}")
    if new.exists():
        raise RuntimeError(f"Destination already exists: {new}")
    hash_before = digest(old)
    new.parent.mkdir(parents=True, exist_ok=True)
    old.rename(new)
    if new.stat().st_size <= 2 or new.stat().st_size != expected_size or digest(new) != hash_before:
        new.rename(old)  # mandatory immediate rollback for truncated files
        raise RuntimeError(f"Asset integrity failure, original restored: {old}")


def rewrite_references(rows):
    replacements = [(entry["old_path"].removeprefix("public/"),
                     entry["new_path"].removeprefix("public/"))
                    for entry in rows if entry["old_path"] != entry["new_path"]]
    count = 0
    for base in [ROOT / "src", ROOT / "public", ROOT / "scripts"]:
        for path in base.rglob("*"):
            if not path.is_file() or path.suffix not in TEXT_EXTENSIONS or path == MAPPING:
                continue
            old = path.read_text(encoding="utf-8")
            new = old
            for from_url, to_url in replacements:
                new = new.replace(from_url, to_url)
            if new != old:
                path.write_text(new, encoding="utf-8")
                count += 1
    return count


def main():
    parser = argparse.ArgumentParser()
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--apply", action="store_true")
    group.add_argument("--test-one", action="store_true")
    group.add_argument("--check", action="store_true")
    args = parser.parse_args()
    rows = mappings()
    destinations = [r["new_path"].casefold() for r in rows]
    if len(destinations) != len(set(destinations)):
        raise RuntimeError("Case-insensitive destination collision in mapping CSV")
    changes = [r for r in rows if r["old_path"] != r["new_path"]]

    if args.check:
        check(rows)
        return

    if args.test_one:
        entry = next((r for r in changes if (ROOT / r["old_path"]).is_file()), None)
        if entry is None:
            print("All listed assets already migrated; no available original for a test.")
            check(rows)
            return
        old, new = ROOT / entry["old_path"], ROOT / entry["new_path"]
        move_verified(old, new, int(entry["bytes"]))
        new.rename(old)
        print(f"One-file test passed and original restored: {entry['old_path']}")
        return

    if not args.apply:
        print(f"DRY RUN: {len(changes)} renames from {len(rows)} assets. No changes made.")
        for item in changes:
            print(f"{item['old_path']} -> {item['new_path']}")
        return

    moved = []
    try:
        for entry in changes:
            old, new = ROOT / entry["old_path"], ROOT / entry["new_path"]
            if new.is_file() and new.stat().st_size == int(entry["bytes"]) and not old.exists():
                continue  # already migrated
            move_verified(old, new, int(entry["bytes"]))
            moved.append((old, new))
        text_files = rewrite_references(rows)
        check(rows)
    except Exception:
        for old, new in reversed(moved):
            if new.is_file() and not old.exists():
                old.parent.mkdir(parents=True, exist_ok=True)
                new.rename(old)
        raise
    print(f"Renamed {len(moved)} assets, updated {text_files} reference files.")


if __name__ == "__main__":
    main()
