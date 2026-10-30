import {readFile} from "node:fs/promises";
import {test,expect} from "@playwright/test";

test("real uploaded STL physical layers are inspectable only after units and sampling approval",async({page})=>{
 const outbound:string[]=[];
 page.on("request",r=>{if(r.method()==="POST"&&/engineering-copilot|llm-api|ai-gateway/.test(r.url()))outbound.push(r.url());});
 await page.goto("/copilot");
 await page.getByLabel("Attach STL in conversation").setInputFiles("public/verification/cube-10mm.stl");
 const section=page.getByRole("group",{name:"Real STL physical-layer geometry"});
 await section.locator("summary").first().click();
 await expect(section.getByRole("button",{name:"Calculate physical STL layers"})).toBeDisabled();
 await page.getByRole("button",{name:"Confirm units & dimensions"}).click();
 await section.getByLabel("Approve local physical STL slice assumptions").check();
 await section.getByRole("button",{name:"Calculate physical STL layers"}).click();
 const result=section.getByRole("region",{name:"Real physical STL slice results"});
 await expect(result).toBeVisible({timeout:45000});
 await expect(result).toContainText("50");
 await expect(result).toContainText("Geometry screening only");
 await expect(result.getByLabel("Inspect physical STL layer")).toHaveValue("0");
 await result.getByLabel("Inspect physical STL layer").fill("49");
 await expect(result).toContainText("Inspect physical layer 50 / 50");
 // Input change must invalidate the old slice and approval, not display stale geometry.
 await section.getByLabel("Physical STL raster pitch").fill("2");
 await expect(result).toHaveCount(0);
 await expect(section.getByRole("button",{name:"Calculate physical STL layers"})).toBeDisabled();
 expect(outbound).toEqual([]);
});
test("optional synthetic command plan is geometrically registered to source-hashed cube slices",async({page})=>{
 await page.goto("/copilot");
 await page.getByLabel("Attach STL in conversation").setInputFiles("public/verification/cube-10mm.stl");
 await page.getByRole("button",{name:"Confirm units & dimensions"}).click();
 const section=page.getByRole("group",{name:"Real STL physical-layer geometry"});
 await section.locator("summary").first().click();
 await section.getByLabel("Import physical path for slice registration").setInputFiles("public/verification/cube-10mm-physical-scan.csv");
 await section.getByLabel("Approve local physical STL slice assumptions").check();
 await section.getByRole("button",{name:"Calculate physical STL layers"}).click();
 const result=section.getByRole("region",{name:"Real physical STL slice results"});
 await expect(result).toBeVisible({timeout:45000});
 const registration=result.getByRole("region",{name:"Scan-to-STL registration"});
 await expect(registration).toContainText("Physical scan geometrically registered");
 await expect(registration).toContainText("0 /");
 await expect(registration).toContainText("Partial-layer solver:");
 await expect(registration).toContainText("no thermal solver executes during scan registration");
});

test("M06 engineer-approved synthetic 10-layer cube runs bounded real-STL FVM without claiming defect prediction",async({page})=>{
 await page.goto("/copilot");
 await page.getByLabel("Attach STL in conversation").setInputFiles("public/verification/cube-10mm.stl");
 await page.getByRole("button",{name:"Confirm units & dimensions"}).click();
 const section=page.getByRole("group",{name:"Real STL physical-layer geometry"});
 await section.locator("summary").first().click();
 await section.getByLabel("Physical STL layer thickness").fill("1");
 await section.getByLabel("Physical STL raster pitch").fill("5");
 await section.getByLabel("Import physical path for slice registration").setInputFiles("public/verification/cube-10mm-10-layer-partial-research.csv");
 await section.getByLabel("Approve local physical STL slice assumptions").check();
 await section.getByRole("button",{name:"Calculate physical STL layers"}).click();
 const reg=section.getByRole("region",{name:"Scan-to-STL registration"});
 await expect(reg).toContainText("Physical scan geometrically registered",{timeout:45000});
 const solver=reg.getByRole("region",{name:"Approved real STL partial-layer research solver"});
 await expect(solver.getByRole("button",{name:"Run STL-linked partial-layer research"})).toBeDisabled();
 await solver.getByLabel("Approve unvalidated physical STL research solver").check();
 await solver.getByRole("button",{name:"Run STL-linked partial-layer research"}).click();
 const result=solver.getByRole("region",{name:"Unvalidated STL-linked partial-layer research results"});
 await expect(result).toBeVisible({timeout:90000});
 await expect(result).toContainText("Finite-volume cells");
 await expect(result).toContainText("40");
 await expect(result).toContainText("Numerical research, not experimental prediction");
 await expect(result).toContainText("Energy imbalance");
 await expect(result.getByLabel("Research scan command timeline")).toHaveValue("29");
});
test("M02 dimensions encoded in STL file name expose scaled-unit mismatch before confirmation",async({page})=>{
 await page.goto("/copilot");
 const original=await readFile("public/verification/cube-10mm.stl");
 await page.getByLabel("Attach STL in conversation").setInputFiles({
  name:"coupon_10x10x10mm.stl",mimeType:"model/stl",buffer:original
 });
 await page.getByLabel("STL coordinate units").selectOption("1000");
 await expect(page.locator(".oaUnitScaleWarning")).toContainText("Review apparent unit-scale mismatch");
 await expect(page.locator(".oaUnitScaleWarning")).toContainText("Millimeters");
 await page.getByLabel("STL coordinate units").selectOption("1");
 await expect(page.getByText(/Review apparent unit-scale mismatch/)).toHaveCount(0);
});
