import hashlib
import importlib.util
import pathlib
import tempfile
import unittest

spec=importlib.util.spec_from_file_location("pads",pathlib.Path(__file__).parents[1]/"scripts/audit-nist-2025-pads.py")
pads=importlib.util.module_from_spec(spec)
spec.loader.exec_module(pads)

class PadInventoryTests(unittest.TestCase):
    def test_publisher_checksum_accepts_standard_formats(self):
        raw=b"hello"
        digest=hashlib.sha256(raw).hexdigest()
        for side in (digest,digest.upper()+"\n",digest+"  data.csv",digest+" *data.csv"):
            self.assertEqual(pads.check_bytes(raw,side.encode()),digest)

    def test_checksum_mismatch_and_invalid_sidecar_fail(self):
        with self.assertRaisesRegex(ValueError,"does not match"):
            pads.check_bytes(b"wrong",hashlib.sha256(b"right").hexdigest().encode())
        with self.assertRaisesRegex(ValueError,"Invalid publisher"):
            pads.check_bytes(b"wrong",b"<html>error</html>")

    def test_inventory_never_treats_shape_as_verified_measurements(self):
        result=pads.inspect_csv(b"sample,depth,depth\nprivate-sample,12,13\nother,10\n")
        self.assertEqual(result["nonempty_rows_after_first"],2)
        self.assertEqual(result["row_width_counts"],{"3":1,"2":1})
        self.assertEqual(result["duplicate_nonblank_first_row_cells"],1)
        self.assertNotIn("private-sample",str(result))
        with self.assertRaises(ValueError):
            pads.inspect_csv(b"<html>error</html>")

    def test_alternate_endpoint_preserves_checksum_gate(self):
        raw=b"sample,depth\na,12\n"
        side=hashlib.sha256(raw).hexdigest().encode()
        def fetch(url,dest):
            payload=side if url.endswith(".sha256") else (b"wrong" if url.startswith("first/") else raw)
            dest.write_bytes(payload)
        with tempfile.TemporaryDirectory() as d:
            root=pathlib.Path(d)
            result=pads.acquire("data.csv",root,fetch,bases=("first/","second/"))
            self.assertTrue(result["publisher_checksum_matched"])
            self.assertEqual(result["attempts"][0]["status"],"rejected")
            self.assertEqual(result["attempts"][1]["status"],"verified")
            self.assertEqual((root/"data.csv").read_bytes(),raw)

    def test_failed_acquisition_does_not_replace_original(self):
        def fetch(url,dest):
            dest.write_bytes(hashlib.sha256(b"expected").hexdigest().encode() if url.endswith(".sha256") else b"wrong")
        with tempfile.TemporaryDirectory() as d:
            root=pathlib.Path(d)
            (root/"data.csv").write_bytes(b"previous original")
            result=pads.acquire("data.csv",root,fetch,bases=("first/","second/"))
            self.assertFalse(result["publisher_checksum_matched"])
            self.assertEqual(len(result["attempts"]),2)
            self.assertNotEqual(result["attempts"][0]["expected_sha256"],result["attempts"][0]["observed_sha256"])
            self.assertEqual((root/"data.csv").read_bytes(),b"previous original")
            self.assertFalse((root/"data.csv.staging").exists())

if __name__=="__main__":
    unittest.main()
