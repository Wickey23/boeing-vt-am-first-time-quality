import {test,expect} from "@playwright/test";
import {readFile} from "node:fs/promises";
test("process-independent engineering review PDF includes no unsupported qualification",async({page})=>{
 await page.goto("/copilot/advanced");
 await page.getByRole("button",{name:"Open Results stage"}).click();
 await expect(page.getByRole("button",{name:"Export engineering review PDF"})).toBeDisabled();
 await page.getByRole("button",{name:"Open Part stage"}).click();
 await page.getByLabel("Upload target STL").setInputFiles("public/verification/cube-10mm.stl");
 await page.getByRole("button",{name:"Confirm inspected dimensions and units"}).click();
 await page.getByRole("button",{name:"Open Results stage"}).click();
 const down=page.waitForEvent("download");
 await page.getByRole("button",{name:"Export engineering review PDF"}).click();
 const file=await down;
 expect(file.suggestedFilename()).toMatch(/-engineering-review\.pdf$/);
 const bytes=await readFile((await file.path())!);
 expect(bytes.toString("ascii",0,5)).toBe("%PDF-");
 await expect(page.getByTestId("engineering-readiness")).toContainText("Research only");
});
