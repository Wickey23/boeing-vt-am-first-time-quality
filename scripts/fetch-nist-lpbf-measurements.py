#!/usr/bin/env python3
"""Download public NIST AM Bench source files with provenance, without parsing
them into labels. No third-party libraries required. Run from repository root.

Network errors are recorded per source; no output is called training-ready.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import pathlib
import urllib.request
from urllib.error import HTTPError, URLError
from datetime import datetime, timezone

SOURCES = [
    {
        "id": "amb2022-03-in718-melt-pool-cross-section",
        "doi": "10.18434/mds2-2718",
        "url": "https://data.nist.gov/od/ds/ark:/88434/mds2-2718/AMB2022-718-SH1-MeltPool_Cross-Section_Measurement_Results.xlsx",
        "file": "AMB2022-718-SH1-MeltPool_Cross-Section_Measurement_Results.xlsx",
        "purpose": "Measured melt-pool geometry; NOT defect/failure labels",
    },
    {
        "id": "amb2022-01-in718-deflection-metadata",
        "doi": "10.18434/mds2-2711",
        "url": "https://data.nist.gov/od/ds/mds2-2711/2711_README.txt",
        "file": "AMB2022-01-deflection-README.txt",
        "purpose": "Dataset README for distortion measurements; NOT training labels",
    },
]
MAX_SIZE = 80 * 1024 * 1024

def download(url: str, dest: pathlib.Path) -> tuple[int, str]:
    req = urllib.request.Request(url, headers={"User-Agent": "ORIENTAI-research-data-audit/1.0"})
    tmp = dest.with_suffix(dest.suffix + ".partial")
    hasher = hashlib.sha256()
    count = 0
    try:
        with urllib.request.urlopen(req, timeout=45) as response, tmp.open("wb") as stream:
            for chunk in iter(lambda: response.read(1024 * 1024), b""):
                count += len(chunk)
                if count > MAX_SIZE:
                    raise ValueError("Source exceeds 80 MiB safety limit")
                stream.write(chunk)
                hasher.update(chunk)
        if count == 0:
            raise ValueError("Empty source")
        tmp.replace(dest)
        return count, hasher.hexdigest()
    finally:
        tmp.unlink(missing_ok=True)

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=pathlib.Path, default=pathlib.Path("data/nist-lpbf"))
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    results = []
    for source in SOURCES:
        record = dict(source)
        record["retrieved_utc"] = datetime.now(timezone.utc).isoformat()
        try:
            size, digest = download(source["url"], args.output / source["file"])
            record.update(status="downloaded-unreviewed",bytes=size,sha256=digest)
            print(f"Downloaded {source['file']} ({size} bytes; SHA-256 {digest})")
        except (HTTPError, URLError, TimeoutError, OSError, ValueError) as err:
            record.update(status="download-failed",error=str(err))
            print(f"Could not fetch {source['id']}: {err}")
        results.append(record)
    manifest = args.output / "source-manifest.json"
    manifest.write_text(json.dumps({
        "schema":"orientai.nist-source-manifest.v1",
        "note":"Original files only. No data have been validated, parsed or labeled for failure prediction.",
        "sources":results
    }, indent=2) + "\n", encoding="utf-8")
    print(f"Source manifest: {manifest}")

if __name__ == "__main__":
    main()
