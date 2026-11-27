import importlib.util
import pathlib
import tempfile
import unittest
import zipfile

spec = importlib.util.spec_from_file_location(
    "supplemental", pathlib.Path(__file__).parents[1]/"scripts/audit-nist-supplemental-source.py")
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)

class SupplementalInventoryTests(unittest.TestCase):
    def fixture(self, path, include_summary=True):
        sheet_tags = '<sheet name="Data" sheetId="1" r:id="rId1"/>'
        if include_summary:
            sheet_tags += '<sheet name="Summary" sheetId="2" r:id="rId2"/>'
        book = '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>'+sheet_tags+'</sheets></workbook>'
        rels = '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="/xl/worksheets/sheet2.xml"/></Relationships>'
        data = '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="inlineStr"><is><t>Width</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>specimen-001</t></is></c><c r="B2"><v>42</v></c></row></sheetData></worksheet>'
        summary = '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Mean</t></is></c></row><row r="2"><c r="A2"><f>AVERAGE(Data!B2:B2)</f><v>42</v></c></row></sheetData></worksheet>'
        with zipfile.ZipFile(path,"w") as z:
            z.writestr("xl/workbook.xml",book)
            z.writestr("xl/_rels/workbook.xml.rels",rels)
            z.writestr("xl/sharedStrings.xml",'<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><si><t>Material</t></si></sst>')
            z.writestr("xl/worksheets/sheet1.xml",data)
            z.writestr("xl/worksheets/sheet2.xml",summary)

    def test_inventory_resolves_relationships_and_excludes_measurement_rows(self):
        with tempfile.TemporaryDirectory() as d:
            path = pathlib.Path(d)/"source.xlsx"
            self.fixture(path)
            result = audit.inspect_workbook(path)
            self.assertEqual(result["Data"]["populated_rows_including_headers"],2)
            self.assertEqual([x["text"] for x in result["Data"]["first_row_text_candidates"]],["Material","Width"])
            self.assertEqual(result["Summary"]["formula_cells"],1)
            self.assertNotIn("specimen-001",str(result))

    def test_missing_required_sheet_fails_closed(self):
        with tempfile.TemporaryDirectory() as d:
            path = pathlib.Path(d)/"source.xlsx"
            self.fixture(path,False)
            with self.assertRaisesRegex(ValueError,"Expected Data and Summary"):
                audit.inspect_workbook(path)

if __name__ == "__main__":
    unittest.main()
