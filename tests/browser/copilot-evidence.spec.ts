import {test,expect} from "@playwright/test";
import {readFile} from "node:fs/promises";

test("reviewed source passage enters real study snapshot and survives project reload",async({page})=>{
 await page.goto("/copilot");
 await page.getByLabel("Upload target STL").setInputFiles("public/verification/cube-10mm.stl");
 await page.getByRole("button",{name:"Confirm inspected dimensions and units"}).click();
 await page.getByRole("button",{name:"Open Documents stage"}).click();
 await page.locator(".copilotDocs > summary").click();
 await page.getByLabel("Add reference documents").setInputFiles({
  name:"public-assembly-notes.txt",mimeType:"text/plain",
  buffer:Buffer.from("The mounting bracket is bolted to bulkhead A at station 20.\nNominal 500 N axial force is UNVERIFIED; engineering approval is required.")
 });
 await page.locator(".copilotEvidenceFold > summary").click();
 await expect(page.getByText("0 current references · open to inspect")).toBeVisible();
 const suggested=page.locator(".evidenceSuggested .evidenceItem").first();
 await expect(suggested).toContainText("bulkhead A");
 await suggested.getByRole("button",{name:"Review relevance"}).click();
 await suggested.getByLabel(/Review rationale/).fill("Relevant to this public example; attachment faces are not mapped to the mesh.");
 await suggested.getByRole("button",{name:"Record reviewed reference"}).click();
 await expect(page.locator(".evidenceReviewed .evidenceItem")).toHaveCount(1);
 await page.getByRole("button",{name:"Open Simulate stage"}).click();
 await expect(page.locator(".runbookHistory")).toBeVisible();
 const run=page.getByRole("button",{name:"Run All Applicable Analyses"});
 await page.getByLabel(/I have reviewed the geometry, fixtures, forces/).check();
 await expect(run).toBeEnabled();
 await run.click();
 await expect(page.getByText("All three result fields computed.")).toBeVisible({timeout:100000});
 const downloadPromise=page.waitForEvent("download");
 await page.getByRole("button",{name:"Export current study job record"}).click();
 const download=await downloadPromise;
 const record=JSON.parse(await readFile((await download.path())!,"utf8"));
 expect(record.snapshot.sourceIds).toEqual(["D1"]);
 expect(record.snapshot.reviewedEvidence).toHaveLength(1);
 expect(record.snapshot.reviewedEvidence[0].sourceId).toBe("D1");
 expect(record.snapshot.reviewedEvidence[0].excerpt).toContain("bulkhead A");
 expect(record.snapshot.serviceCase).toBeDefined();
 expect(record.snapshot.analysisMode).toBe("service-independent");
 await page.reload();
 await page.getByRole("button",{name:"Open Documents stage"}).click();
 await page.locator(".copilotEvidenceFold > summary").click();
 await expect(page.locator(".evidenceReviewed .evidenceItem")).toHaveCount(1);
});

test("editing a source invalidates previous review and excludes it from new study records",async({page})=>{
 await page.goto("/copilot");
 await page.getByLabel("Upload target STL").setInputFiles("public/verification/cube-10mm.stl");
 await page.getByRole("button",{name:"Open Documents stage"}).click();
 await page.locator(".copilotDocs > summary").click();
 await page.getByLabel("Add reference documents").setInputFiles({name:"fixture.txt",mimeType:"text/plain",
  buffer:Buffer.from("The bolt-mounted support is fixed at a bulkhead.")});
 await page.locator(".copilotEvidenceFold > summary").click();
 const row=page.locator(".evidenceSuggested .evidenceItem").first();
 await row.getByRole("button",{name:"Review relevance"}).click();
 await row.getByLabel(/Review rationale/).fill("Relevant to sample part, fixture selection unconfirmed.");
 await row.getByRole("button",{name:"Record reviewed reference"}).click();
 await expect(page.locator(".evidenceReviewed")).toContainText("Current source");
 await page.getByText("D1 · fixture.txt").click();
 await page.getByLabel("Notes for fixture.txt").fill("A new engineer note changes the source revision.");
 await expect(page.locator(".evidenceReviewed")).toContainText("Stale or removed source");
 await page.getByRole("button",{name:"Open Simulate stage"}).click();
 await expect(page.locator(".runbookHistory")).toBeVisible();
});
