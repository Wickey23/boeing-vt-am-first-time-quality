#!/usr/bin/env python3
"""Inventory the public Aalto LPBF classification archive without fabricating labels.

Only folder-level Good/Defects labels are accepted. Source-group identity MUST be
reviewed by a researcher before training. Archives are read in place and never
unpacked to an untrusted path.
"""
import argparse
import csv
import hashlib
import json
import re
import zipfile
from pathlib import Path, PurePosixPath

DATASET = "https://doi.org/10.5281/zenodo.14996806"
IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".bmp", ".tif", ".tiff"}
LABELS = {"good": 0, "defect": 1, "defects": 1}
HEADERS = ("archive_member", "image_label", "source_group_id", "source_modality", "sha256")


def folder_label(member):
    parts = [p.lower() for p in PurePosixPath(member).parts[:-1]]
    matches = {LABELS[p] for p in parts if p in LABELS}
    if len(matches) != 1:
        raise ValueError(f"Cannot assign unambiguous label from folder: {member}")
    return matches.pop()


def collect(source: Path, target: Path, metadata: Path):
    records, counts, skipped = [], {0: 0, 1: 0}, 0
    seen = set()
    with zipfile.ZipFile(source) as z:
        for member in sorted(z.infolist(), key=lambda item: item.filename):
            if member.is_dir() or PurePosixPath(member.filename).suffix.lower() not in IMAGE_SUFFIXES:
                skipped += 1
                continue
            if member.filename.startswith("/") or ".." in PurePosixPath(member.filename).parts:
                raise ValueError("Unsafe archive member")
            if member.file_size > 30 * 1024 * 1024:
                raise ValueError("Oversized individual image")
            label = folder_label(member.filename)
            digest = hashlib.sha256(z.read(member)).hexdigest()
            if digest in seen:
                raise ValueError("Duplicate image content; review crop/frame leakage")
            seen.add(digest)
            # No source group is invented from a filename or image position.
            records.append({"archive_member": member.filename, "image_label": label,
                            "source_group_id": "", "source_modality": "",
                            "sha256": digest})
            counts[label] += 1
    if not all(counts.values()):
        raise ValueError("Both Good and Defects classes must be present")
    target.parent.mkdir(parents=True, exist_ok=True)
    with target.open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=HEADERS)
        writer.writeheader()
        writer.writerows(records)
    summary = {"dataset": DATASET, "source_zip_sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
               "images": len(records), "good": counts[0], "defects": counts[1],
               "skipped_non_images": skipped, "training_ready": False,
               "reason": "source_group_id and source_modality require reviewed provenance; folder labels are visual image classes, not measured part failures"}
    metadata.parent.mkdir(parents=True, exist_ok=True)
    metadata.write_text(json.dumps(summary, indent=2) + "\n")
    return summary


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--zip", type=Path, required=True)
    p.add_argument("--manifest", type=Path, required=True)
    p.add_argument("--audit", type=Path, required=True)
    a = p.parse_args()
    print(json.dumps(collect(a.zip, a.manifest, a.audit), indent=2))


if __name__ == "__main__":
    main()
