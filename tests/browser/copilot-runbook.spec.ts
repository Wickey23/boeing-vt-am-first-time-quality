import {test,expect} from "@playwright/test";
import {readFile} from "node:fs/promises";
async function uploadAndConfirm(page:import("@playwright/test").Page){
 await page.goto("/copilot");
 await page.getByLabel("Upload target STL").setInputFiles("public/verification/cube-10mm.stl");
 await page.getByRole("button",{name:"Confirm inspected dimensions and units"}).click();
}
test("one approved action calculates stress displacement and steady temperature on a real STL",async({page})=>{
 await uploadAndConfirm(page);
 await page.getByRole("button",{name:"Open Simulate stage"}).click();
 await expect(page.getByRole("heading",{name:/Service analysis · one coordinated run/})).toBeVisible();
 const run=page.getByRole("button",{name:"Run All Applicable Analyses"});
 await expect(run).toBeDisabled();
 await page.getByLabel(/I have reviewed the geometry, fixtures, forces/).check();
 await expect(run).toBeEnabled();
 await run.click();
 await expect(page.getByText("All three result fields computed.")).toBeVisible({timeout:100000});
 await page.getByRole("button",{name:"Inspect stress, displacement and temperature in 3D"}).click();
 await expect(page.locator("[data-testid=service-results]")).toBeVisible();
 for(const label of ["Service stress","Displacement","Steady temperature"]){
  const button=page.locator(".copilotFieldTabs").getByRole("button",{name:label});
  await expect(button).toBeEnabled();
  await button.click();
  await expect(button).toHaveAttribute("aria-pressed","true");
 }
 await page.getByRole("button",{name:"Open Simulate stage"}).click();
 await expect(page.locator(".runbookHistory").getByText("COMPLETED",{exact:true})).toBeVisible();
 const d=page.waitForEvent("download");
 await page.getByRole("button",{name:"Export current study job record"}).click();
 const downloaded=await d;
 const record=JSON.parse(await readFile((await downloaded.path())!,"utf8"));
 expect(record.status).toBe("completed");
 expect(record.snapshot.analysisMode).toBe("service-independent");
 expect(record.steps.map((s:{kind:string;status:string})=>[s.kind,s.status])).toEqual([
  ["service-structural","completed"],["steady-conduction","completed"]
 ]);
 expect(record.snapshot.partSha256).toMatch(/^[a-f0-9]{64}$/);
 await page.reload();
 await page.getByRole("button",{name:"Open Simulate stage"}).click();
 await expect(page.locator(".runbookHistory").getByText("COMPLETED",{exact:true})).toBeVisible();
});
test("DED process does not block generic service stress displacement or steady conduction",async({page})=>{
 await uploadAndConfirm(page);
 await page.getByLabel("Copilot manufacturing process").selectOption("DED_LB_WIRE");
 await page.getByRole("button",{name:"Open Simulate stage"}).click();
 await expect(page.getByText(/DED selection: these are generic service-load/)).toBeVisible();
 await page.getByLabel(/I have reviewed the geometry, fixtures, forces/).check();
 await page.getByRole("button",{name:"Run All Applicable Analyses"}).click();
 await expect(page.getByText("All three result fields computed.")).toBeVisible({timeout:100000});
 await page.getByRole("button",{name:"Inspect stress, displacement and temperature in 3D"}).click();
 await expect(page.locator("[data-testid=service-results]")).toBeVisible();
});
test("editing boundary conditions clears approval and blocks stale reruns",async({page})=>{
 await uploadAndConfirm(page);
 await page.getByRole("button",{name:"Open Simulate stage"}).click();
 const approval=page.getByLabel(/I have reviewed the geometry, fixtures, forces/);
 const run=page.getByRole("button",{name:"Run All Applicable Analyses"});
 await approval.check();
 await expect(run).toBeEnabled();
 await page.getByLabel("Conductivity (W/m·K)").fill("-3");
 await expect(approval).not.toBeChecked();
 await expect(run).toBeDisabled();
 await page.getByLabel("Conductivity (W/m·K)").fill("6.7");
 await approval.check();
 await expect(run).toBeEnabled();
 await page.getByLabel("X force (N)").fill("0");
 await page.getByLabel("Z force (N)").fill("0");
 await expect(run).toBeDisabled();
});
