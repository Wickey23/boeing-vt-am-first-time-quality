"""These generated images test import mechanics, not physical defect accuracy."""
import csv
import io
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from prepare_aalto_images import collect
from train_aalto_images import evaluate


class AaltoArchiveTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        root = Path(self.tmp.name)
        self.archive, self.manifest = root / "data.zip", root / "manifest.csv"
        self.audit, self.report = root / "audit.json", root / "report.json"

    def make_archive(self, ambiguous=False):
        with zipfile.ZipFile(self.archive, "w") as z:
            for group in range(8):
                for j in range(10):
                    label = "Good" if j < 5 else "Defects"
                    name = f"PB/{label}/source{group}-sample{j}.png"
                    if ambiguous and group == 0 and j == 0:
                        name = f"PB/Unclear/source{group}-sample{j}.png"
                    image = Image.new("RGB", (48, 48),
                                      (int((j * 21 + group * 15) % 256),
                                       int((j * 37 + group * 19) % 256), 90))
                    out = io.BytesIO()
                    image.save(out, format="PNG")
                    z.writestr(name, out.getvalue())

    def reviewed_manifest(self):
        with self.manifest.open(newline="") as handle:
            rows = list(csv.DictReader(handle))
        for row in rows:
            row["source_group_id"] = row["archive_member"].split("/")[-1].split("-")[0]
            row["source_modality"] = "PB"
        with self.manifest.open("w", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=rows[0].keys())
            writer.writeheader()
            writer.writerows(rows)
        return rows

    def test_training_is_research_only_and_group_separated(self):
        self.make_archive()
        summary = collect(self.archive, self.manifest, self.audit)
        self.assertFalse(summary["training_ready"])
        self.assertEqual(summary["images"], 80)
        rows = self.reviewed_manifest()
        result = evaluate(self.archive, self.manifest, self.report)
        self.assertFalse(result["inference_enabled"])
        self.assertFalse(result["release_eligible"])
        self.assertEqual(result["train_rows"] + result["holdout_rows"], len(rows))
        self.assertFalse(set(result["train_groups"]) & set(result["holdout_groups"]))

    def test_unreviewed_groups_rejected(self):
        self.make_archive()
        collect(self.archive, self.manifest, self.audit)
        with self.assertRaises(ValueError):
            evaluate(self.archive, self.manifest, self.report)

    def test_bad_label_folder_rejected(self):
        self.make_archive(ambiguous=True)
        with self.assertRaises(ValueError):
            collect(self.archive, self.manifest, self.audit)

    def test_identical_images_are_quarantined_entirely(self):
        self.make_archive()
        with zipfile.ZipFile(self.archive, "a") as z:
            original = "PB/Good/source0-sample0.png"
            z.writestr("PB/Defects/duplicate-from-good.png", z.read(original))
        result = collect(self.archive, self.manifest, self.audit)
        self.assertEqual(result["duplicate_groups"], 1)
        self.assertEqual(result["quarantined_duplicate_images"], 2)
        self.assertEqual(result["cross_label_duplicate_groups"], 1)
        self.assertEqual(result["images"], 79)
        with self.manifest.open(newline="") as handle:
            rows = list(csv.DictReader(handle))
        self.assertNotIn("PB/Good/source0-sample0.png",
                         {row["archive_member"] for row in rows})
        self.assertNotIn("PB/Defects/duplicate-from-good.png",
                         {row["archive_member"] for row in rows})

    def test_tampered_manifest_hash_rejected(self):
        self.make_archive()
        collect(self.archive, self.manifest, self.audit)
        rows = self.reviewed_manifest()
        rows[0]["sha256"] = "0" * 64
        with self.manifest.open("w", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=rows[0].keys())
            writer.writeheader()
            writer.writerows(rows)
        with self.assertRaises(ValueError):
            evaluate(self.archive, self.manifest, self.report)


if __name__ == "__main__":
    unittest.main()
