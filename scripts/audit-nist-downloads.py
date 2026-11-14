#!/usr/bin/env python3
"""Verify original NIST downloads before parsing or model training.

This checks byte integrity and source status only; it does NOT validate
measurement units, sample independence, labeling or scientific suitability.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import pathlib
import sys

EXPECTED_SCHEMA = "orientai.nist-source-manifest.v1"
CHUNK_SIZE = 1024 * 1024


def audit(manifest_path: pathlib.Path) -> list[str]:
    errors: list[str] = []
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        return [f"Cannot read manifest: {exc}"]
    if not isinstance(manifest, dict) or manifest.get("schema") != EXPECTED_SCHEMA:
        return ["Unexpected manifest schema"]
    sources = manifest.get("sources")
    if not isinstance(sources, list) or not sources:
        return ["No source entries in manifest"]
    root = manifest_path.resolve().parent
    seen: set[str] = set()
    for index, source in enumerate(sources, start=1):
        label = f"Source {index}"
        if not isinstance(source, dict):
            errors.append(f"{label}: invalid entry")
            continue
        identifier = source.get("id")
        if not isinstance(identifier, str) or not identifier.strip() or identifier in seen:
            errors.append(f"{label}: missing or duplicate source ID")
        else:
            seen.add(identifier)
            label = identifier
        if source.get("status") != "downloaded-unreviewed":
            errors.append(f"{label}: download was not successful")
            continue
        filename = source.get("file")
        digest = source.get("sha256")
        size = source.get("bytes")
        if not isinstance(filename, str) or not filename or pathlib.PurePath(filename).name != filename or filename in (".", ".."):
            errors.append(f"{label}: unsafe filename")
            continue
        if not isinstance(size, int) or isinstance(size, bool) or size <= 0:
            errors.append(f"{label}: invalid recorded byte size")
            continue
        if not isinstance(digest, str) or len(digest) != 64 or any(c not in "0123456789abcdef" for c in digest):
            errors.append(f"{label}: invalid SHA-256 digest")
            continue
        path = root / filename
        if not path.is_file() or path.is_symlink():
            errors.append(f"{label}: missing or unsafe source file")
            continue
        hasher = hashlib.sha256()
        actual_size = 0
        try:
            with path.open("rb") as stream:
                for chunk in iter(lambda: stream.read(CHUNK_SIZE), b""):
                    actual_size += len(chunk)
                    hasher.update(chunk)
        except OSError as exc:
            errors.append(f"{label}: cannot read source file: {exc}")
            continue
        if actual_size != size:
            errors.append(f"{label}: byte size mismatch")
        if hasher.hexdigest() != digest:
            errors.append(f"{label}: SHA-256 mismatch")
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=pathlib.Path, default=pathlib.Path("data/nist-lpbf/source-manifest.json"))
    args = parser.parse_args()
    failures = audit(args.manifest)
    if failures:
        for failure in failures:
            print(f"FAIL: {failure}", file=sys.stderr)
        return 1
    print("Integrity check passed. Original source bytes are intact; scientific review and parsing are still required.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
