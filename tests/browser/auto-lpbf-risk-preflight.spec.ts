import {test,expect} from "@playwright/test";
import {readFile} from "node:fs/promises";

test("STL receives automatic, evidence-labeled LPBF risk screening after unit confirmation",async({page})=>{
 await page.goto("/copilot");
 await page.getByLabel("Attach STL in conversation").setInputFiles("public/verification/cube-10mm.stl");
 const preflight=page.getByRole("region",{name:"Automatic LPBF failure-risk preflight"});
 await expect(preflight).toContainText("Awaiting confirmed STL units");
 await expect(preflight.getByRole("button",{name:/Export source-hashed evidence JSON/})).toHaveCount(0);
 await page.getByRole("button",{name:"Confirm units & dimensions"}).click();
 await expect(preflight.getByRole("status").first()).toContainText("0");
 await expect(preflight).toContainText("No issues triggered these limited geometric screening rules",{timeout:60000});
 await expect(preflight).toContainText("Not predicted — show missing manufacturing and model evidence");
 const download=page.waitForEvent("download");
 await preflight.getByRole("button",{name:/Export source-hashed evidence JSON/}).click();
 const file=await download;
 const report=JSON.parse(await readFile((await file.path())!,"utf8"));
 expect(report.version).toBe("orientai-lpbf-geometric-preflight-v1");
 expect(report.sourceSha256).toMatch(/^[a-f0-9]{64}$/);
 expect(report.geometry.triangles).toBe(12);
 expect(report.geometry.elevatedDownFacingAreaMm2).toBeLessThan(.00001);
 expect(report.findings.some((v:{code:string})=>v.code==="PHYSICS_NOT_CALIBRATED")).toBe(true);
});

test("tilted closed geometry produces a selectable 3D face warning, not defect probability",async({page})=>{
 const original=await readFile("public/verification/cube-10mm.stl","utf8");
 const angle=Math.PI/4,cos=Math.cos(angle),sin=Math.sin(angle);
 const tilted=original.replace(/vertex\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g,
  (_,x:string,y:string,z:string)=>{
   const xx=Number(x),yy=Number(y),zz=Number(z);
   return "vertex "+xx+" "+(yy*cos-zz*sin).toFixed(5)+" "+(yy*sin+zz*cos).toFixed(5);
  });
 await page.goto("/copilot");
 await page.getByLabel("Attach STL in conversation").setInputFiles({
  name:"tilted-cube.stl",mimeType:"model/stl",buffer:Buffer.from(tilted)});
 await page.getByRole("button",{name:"Confirm units & dimensions"}).click();
 const preflight=page.getByRole("region",{name:"Automatic LPBF failure-risk preflight"});
 await expect(preflight).toContainText("Elevated down-facing surfaces require support/process review",{timeout:60000});
 await preflight.getByRole("button",{name:/Highlight .*relevant STL triangles in 3D/}).click();
 await expect(page.getByRole("complementary",{name:"Expanded 3D engineering model"})).toBeVisible();
 await expect(page.getByText("Selected geometric risk-region triangles")).toBeVisible();
 await preflight.getByRole("button",{name:"Clear 3D highlight"}).click();
 await expect(page.getByText("Selected geometric risk-region triangles")).toHaveCount(0);
});

test("one-click synthetic cantilever example triggers a real geometric support-review finding",async({page})=>{
 await page.goto("/copilot");
 await page.getByRole("button",{name:/Try synthetic cantilever bracket/}).click();
 await expect(page.getByRole("article",{name:"Uploaded STL model in chat"})).toContainText("lpbf-demo-cantilever-30mm.stl");
 await page.getByRole("button",{name:"Confirm units & dimensions"}).click();
 const preflight=page.getByRole("region",{name:"Automatic LPBF failure-risk preflight"});
 await expect(preflight).toContainText("Elevated down-facing surfaces require support/process review",{timeout:60000});
 await expect(preflight).toContainText("160.0 mm²");
 await expect(preflight).toContainText("not unsupported-span verification");
 await expect(page.getByText(/Automatic STL geometry review identified/)).toBeVisible();
 await expect(page.getByText(/source-derived screening observations, not simulated metal-print defects/)).toBeVisible();
 await preflight.getByRole("button",{name:/Highlight .*relevant STL triangles in 3D/}).click();
 await expect(page.getByRole("complementary",{name:"Expanded 3D engineering model"})).toBeVisible();
 await expect(page.getByText("Selected geometric risk-region triangles")).toBeVisible();
});

test("machine envelope changes recompute risk blockers instead of leaving stale geometry results",async({page})=>{
 await page.goto("/copilot");
 await page.getByLabel("Attach STL in conversation").setInputFiles("public/verification/cube-10mm.stl");
 await page.getByRole("button",{name:"Confirm units & dimensions"}).click();
 const preflight=page.getByRole("region",{name:"Automatic LPBF failure-risk preflight"});
 await expect(preflight).toContainText("No issues triggered these limited geometric screening rules",{timeout:60000});
 await preflight.locator("details.oaPreflightAssumptions > summary").click();
 await preflight.getByLabel("Risk preflight envelope X").fill("8");
 await expect(preflight).toContainText("Part exceeds configured build envelope",{timeout:60000});
 await expect(preflight).toContainText("X 10.0 mm > 8.000 mm");
 await preflight.getByLabel("Risk preflight envelope X").fill("100");
 await expect(preflight).toContainText("No issues triggered these limited geometric screening rules",{timeout:60000});
 await expect(preflight).not.toContainText("Part exceeds configured build envelope");
});
