import {test,expect} from "@playwright/test";
import {readFile} from "node:fs/promises";

test("a reviewed source maps an engineer-approved force to a real service job and becomes stale on edit",async({page})=>{
 await page.goto("/copilot/advanced");
 await page.getByLabel("Upload target STL").setInputFiles("public/verification/cube-10mm.stl");
 await page.getByRole("button",{name:"Confirm inspected dimensions and units"}).click();
 await page.getByRole("button",{name:"Open Documents stage"}).click();
 await page.locator(".copilotDocs > summary").click();
 await page.getByLabel("Add reference documents").setInputFiles({
  name:"fixture-loads.txt",mimeType:"text/plain",
  buffer:Buffer.from("Frame is fixed at original part x-min. Service force X = 0.5 kN, to be verified by engineer.")
 });
 await page.locator(".copilotEvidenceFold > summary").click();
 const row=page.locator(".evidenceSuggested .evidenceItem").first();
 await row.getByRole("button",{name:"Review relevance"}).click();
 await row.getByLabel(/Review rationale/).fill("Source is relevant to public fixture, load sign still requires verification.");
 await row.getByRole("button",{name:"Record reviewed reference"}).click();
 await page.getByRole("button",{name:"Open Requirements stage"}).click();
 const mapped=page.locator(".parameterCandidate").first();
 await expect(mapped).toContainText("0.5 kN");
 await mapped.getByRole("button",{name:"Review numeric mapping"}).click();
 await mapped.getByLabel("Parameter target").selectOption("forceXN");
 await mapped.getByLabel("Signed force direction").selectOption("negative");
 await mapped.getByLabel("Numerical mapping rationale").fill("Verified negative X direction and 500 N test case against independent public fixture plan.");
 await mapped.getByText(/I independently checked this magnitude/).click();
 await mapped.getByRole("button",{name:"Apply reviewed value to service case"}).click();
 await expect(page.locator(".parameterBinding")).toContainText("forceXN = -500 N");
 await page.getByRole("button",{name:"Open Simulate stage"}).click();
 await expect(page.getByLabel("X force (N)")).toHaveValue("-500");
 await page.getByLabel(/I have reviewed the geometry, fixtures, forces/).check();
 await page.getByRole("button",{name:"Run All Applicable Analyses"}).click();
 await expect(page.getByText("All three result fields computed.")).toBeVisible({timeout:100000});
 const download=page.waitForEvent("download");
 await page.getByRole("button",{name:"Export current study job record"}).click();
 const file=await download;
 const json=JSON.parse(await readFile((await file.path())!,"utf8"));
 expect(json.snapshot.parameterBindings).toHaveLength(1);
 expect(json.snapshot.parameterBindings[0].value).toBe(-500);
 expect(json.snapshot.parameterBindings[0].sourceId).toBe("D1");
 expect(json.snapshot.serviceCase.input.forceXN).toBe(-500);
 await page.getByRole("button",{name:"Open Documents stage"}).click();
 await page.getByText("D1 · fixture-loads.txt").click();
 await page.getByLabel("Notes for fixture-loads.txt").fill("Source has been edited after numerical approval.");
 await page.getByRole("button",{name:"Open Requirements stage"}).click();
 await expect(page.locator(".parameterBinding")).toContainText("Stale: source, review, case or value changed");
 await page.getByRole("button",{name:"Open Simulate stage"}).click();
 await expect(page.getByRole("button",{name:"Run All Applicable Analyses"})).toBeDisabled();
 await expect(page.getByText("All three result fields computed.")).toHaveCount(0);
});
