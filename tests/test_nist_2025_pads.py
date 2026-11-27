import hashlib
import importlib.util
import pathlib
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

if __name__=="__main__":
    unittest.main()
