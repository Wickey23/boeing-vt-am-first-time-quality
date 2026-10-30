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
 await expect(registration).toContainText("not run");
});
