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
    by_digest, names = {}, set()
    with zipfile.ZipFile(source) as z:
        for member in sorted(z.infolist(), key=lambda item: item.filename):
            if member.is_dir() or PurePosixPath(member.filename).suffix.lower() not in IMAGE_SUFFIXES:
                skipped += 1
                continue
            if member.filename.startswith("/") or ".." in PurePosixPath(member.filename).parts:
                raise ValueError("Unsafe archive member")
            if member.filename in names:
                raise ValueError("Duplicate archive member path")
            names.add(member.filename)
            if member.file_size > 30 * 1024 * 1024:
                raise ValueError("Oversized individual image")
            label = folder_label(member.filename)
            digest = hashlib.sha256(z.read(member)).hexdigest()
            by_digest.setdefault(digest, []).append({"archive_member": member.filename,
                                                       "image_label": label,
                                                       "source_group_id": "",
                                                       "source_modality": "",
                                                       "sha256": digest})
    # All copies of a repeated image must be quarantined, not just its later
    # occurrences. Otherwise an arbitrary ZIP member order determines labels.
    duplicates = [group for group in by_digest.values() if len(group) > 1]
    for group in by_digest.values():
        if len(group) != 1:
            continue
        record = group[0]
        records.append(record)
        counts[record["image_label"]] += 1
    conflict = sum(len({r["image_label"] for r in group}) > 1 for group in duplicates)
    if not all(counts.values()):
        raise ValueError("Both Good and Defects classes must be present")
    target.parent.mkdir(parents=True, exist_ok=True)
    with target.open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=HEADERS)
        writer.writeheader()
        writer.writerows(records)
    summary = {"dataset": DATASET, "source_zip_sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
               "images": len(records), "good": counts[0], "defects": counts[1],
               "skipped_non_images": skipped, "duplicate_groups": len(duplicates),\n               "quarantined_duplicate_images": sum(len(group) for group in duplicates),\n               "cross_label_duplicate_groups": conflict,\n               "quarantined_examples": [{"sha256": group[0]["sha256"],\n                                         "members": [r["archive_member"] for r in group[:6]],\n                                         "label_conflict": len({r["image_label"] for r in group}) > 1}\n                                        for group in duplicates[:40]],\n               "training_ready": False,
               "reason": "Exact duplicate images quarantined; source grouping and modality require reviewed provenance. Folder labels are visual image classes, not inspected part failures"}
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
