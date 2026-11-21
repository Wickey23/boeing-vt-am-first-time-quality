"""Offline checks for NIST acquisition file-signature safeguards."""
import importlib.util
import io
import pathlib
import tempfile
import unittest
from unittest.mock import patch

SCRIPT = pathlib.Path(__file__).resolve().parents[1] / "scripts" / "fetch-nist-lpbf-measurements.py"
spec = importlib.util.spec_from_file_location("nist_acquisition", SCRIPT)
assert spec and spec.loader
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class FakeResponse(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()


class DownloadSafetyTests(unittest.TestCase):
    def test_rejects_html_disguised_as_workbook_without_replacing_existing_file(self):
        with tempfile.TemporaryDirectory() as root:
            dest = pathlib.Path(root) / "measurements.xlsx"
            dest.write_bytes(b"existing verified copy")
            with patch.object(module.urllib.request, "urlopen", return_value=FakeResponse(b"<html>error</html>")):
                with self.assertRaisesRegex(ValueError, "Invalid XLSX signature"):
                    module.download("https://data.nist.gov/example", dest)
            self.assertEqual(dest.read_bytes(), b"existing verified copy")
            self.assertFalse((pathlib.Path(root) / "measurements.xlsx.partial").exists())

    def test_accepts_zip_signature_without_claiming_workbook_validation(self):
        with tempfile.TemporaryDirectory() as root:
            dest = pathlib.Path(root) / "measurements.xlsx"
            payload = b"PK\x03\x04" + b"unreviewed source payload"
            with patch.object(module.urllib.request, "urlopen", return_value=FakeResponse(payload)):
                size, digest = module.download("https://data.nist.gov/example", dest)
            self.assertEqual(size, len(payload))
            self.assertEqual(dest.read_bytes(), payload)
            self.assertEqual(len(digest), 64)

    def test_rejects_html_readme(self):
        with tempfile.TemporaryDirectory() as root:
            dest = pathlib.Path(root) / "source.txt"
            with patch.object(module.urllib.request, "urlopen", return_value=FakeResponse(b"<!DOCTYPE html><html>blocked</html>")):
                with self.assertRaisesRegex(ValueError, "received markup"):
                    module.download("https://data.nist.gov/example", dest)
            self.assertFalse(dest.exists())


if __name__ == "__main__":
    unittest.main()
