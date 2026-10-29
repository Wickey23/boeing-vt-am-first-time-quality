import {test,expect} from "@playwright/test";
import {readFile} from "node:fs/promises";
test("complete project ZIP exports and restores STL, original reference bytes and context",async({page})=>{
 await page.goto("/copilot/advanced");
 await page.getByLabel("Upload target STL").setInputFiles("public/verification/cube-10mm.stl");
 await page.getByRole("button",{name:"Confirm inspected dimensions and units"}).click();
 await page.getByRole("button",{name:"Open Documents stage"}).click();
 await page.locator(".copilotDocs > summary").click();
 await page.getByLabel("Add reference documents").setInputFiles({
  name:"assembly-notes.txt",mimeType:"text/plain",
  buffer:Buffer.from("Fixture bracket at station 20. Load unknown; not an aerospace approval.")
 });
 await expect(page.getByText("D1 · assembly-notes.txt")).toBeVisible();
 await page.getByRole("button",{name:"Open Requirements stage"}).click();
 await page.locator(".copilotFacts > summary").click();
 await page.getByLabel("Component role").fill("Fixture bracket example");
 await page.getByRole("button",{name:"Open Part stage"}).click();
 const download=page.waitForEvent("download");
 await page.getByRole("button",{name:"Export complete project ZIP"}).click();
 const file=await download;
 expect(file.suggestedFilename()).toMatch(/\.orientai\.zip$/);
 const contents=await readFile((await file.path())!);
 await page.getByLabel("Upload target STL").setInputFiles("public/verification/aerospace-overhang-bracket.stl");
 await expect(page.getByText("aerospace-overhang-bracket.stl").first()).toBeVisible();
 await page.getByLabel("Import ORIENTAI project ZIP").setInputFiles({
  name:"saved.orientai.zip",mimeType:"application/zip",buffer:contents
 });
 await expect(page.getByText("cube-10mm.stl").first()).toBeVisible();
 await page.getByRole("button",{name:"Open Documents stage"}).click();
 await page.locator(".copilotDocs > summary").click();
 await expect(page.getByText("D1 · assembly-notes.txt")).toBeVisible();
 await page.getByRole("button",{name:"Open Requirements stage"}).click();
 await page.locator(".copilotFacts > summary").click();
 await expect(page.getByLabel("Component role")).toHaveValue("Fixture bracket example");
});
test("results stage shows process-specific evidence readiness instead of a quality approval",async({page})=>{
 await page.goto("/copilot/advanced");
 await page.getByRole("button",{name:"Open Results stage"}).click();
 const panel=page.getByTestId("engineering-readiness");
 await expect(panel).toBeVisible();
 await expect(panel).toContainText("Research only · not qualified");
 await expect(panel).toContainText("Process-specific manufacturing evidence");
 await expect(panel).toContainText("Recommended next action");
 await expect(panel.getByRole("button",{name:/Open Part and dimensional identity/})).toBeVisible();
});
