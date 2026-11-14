#!/usr/bin/env python3
"""Download *public* CMU Figshare CSVs for ephemeral GitHub Actions schema audit."""
import hashlib
import json
import sys
import urllib.request
from pathlib import Path

API = "https://api.figshare.com/v2/articles/26304175"
REQUIRED = {"parameters.csv", "poredf.csv"}
MAX_FILE_BYTES = 150 * 1024 * 1024


def download(directory):
    directory = Path(directory)
    directory.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(urllib.request.Request(API, headers={"User-Agent": "ORIENTAI-public-research-audit/1.0"}), timeout=50) as response:
        article = json.load(response)
    files = {f["name"].casefold(): f for f in article.get("files", [])}
    missing = REQUIRED - files.keys()
    if missing:
        raise ValueError(f"Required exact CSVs not listed by Figshare article: {sorted(missing)}; available names: {list(files)}")
    written = {}
    for name in sorted(REQUIRED):
        item = files[name]
        if not isinstance(item.get("size"), int) or item["size"] > MAX_FILE_BYTES:
            raise ValueError(f"Unsafe/oversized source file {name}: {item.get('size')}")
        url = item.get("download_url")
        if not isinstance(url, str) or not url.startswith("https://"):
            raise ValueError("Figshare API missing HTTPS download URL")
        dst = directory / name
        h = hashlib.md5()
        total = 0
        with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "ORIENTAI-public-research-audit/1.0"}), timeout=180) as source, dst.open("wb") as out:
            while True:
                block = source.read(1024 * 1024)
                if not block:
                    break
                total += len(block)
                if total > MAX_FILE_BYTES:
                    raise ValueError(f"Downloaded file exceeded size cap: {name}")
                out.write(block)
                h.update(block)
        if total != item["size"] or (item.get("computed_md5") and h.hexdigest().lower() != item["computed_md5"].lower()):
            raise ValueError(f"Figshare source-byte validation failed: {name}")
        written[name] = {"bytes": total, "md5": h.hexdigest()}
    print(json.dumps({"source_api": API, "downloaded": written}, indent=2))
    return written


if __name__ == "__main__":
    download(sys.argv[1] if len(sys.argv) > 1 else "/tmp/cmu-ct")
