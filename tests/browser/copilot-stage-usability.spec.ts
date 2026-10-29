import {test,expect} from "@playwright/test";
test("five-stage workflow presents only relevant controls while part remains visible",async({page})=>{
 await page.goto("/copilot/advanced");
 await expect(page.getByRole("navigation",{name:"Engineering workflow"})).toBeVisible();
 await expect(page.getByRole("region",{name:"Current engineering stage"})).toContainText("Inspect and confirm the part");
 await page.getByLabel("Upload target STL").setInputFiles("public/verification/cube-10mm.stl");
 await page.getByRole("button",{name:"Confirm inspected dimensions and units"}).click();
 await page.getByRole("button",{name:"Continue to assembly documents"}).click();
 await expect(page.getByRole("region",{name:"Current engineering stage"})).toContainText("Understand the larger assembly");
 await expect(page.getByLabel("Upload target STL")).toBeHidden();
 await expect(page.getByRole("button",{name:"Edit part setup"})).toBeVisible();
 await page.getByRole("button",{name:"Add assembly reference files"}).click();
 await expect(page.getByLabel("Add reference documents")).toBeVisible();
 await page.getByRole("button",{name:/Continue to requirements/}).click();
 await expect(page.getByRole("region",{name:"Current engineering stage"})).toContainText("Define loads, interfaces and requirements");
 await expect(page.getByLabel("Upload target STL")).toBeHidden();
 await page.getByRole("button",{name:"Edit part setup"}).click();
 await expect(page.getByLabel("Upload target STL")).toBeVisible();
});
