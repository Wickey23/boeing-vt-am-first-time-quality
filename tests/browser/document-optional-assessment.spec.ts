import {test,expect} from "@playwright/test";

test("review action advances with described part, without forcing document upload",async({page})=>{
 await page.goto("/copilot/workbench");
 await page.getByLabel("Select STL part").setInputFiles("public/verification/cube-10mm.stl");
 await page.getByRole("button",{name:"Confirm units & dimensions"}).click();
 const next=page.getByRole("region",{name:"Recommended workflow action"});
 await next.getByRole("button",{name:"Run screening"}).click();
 await expect(page.getByText(/Geometry screening results · selected orientation/)).toBeVisible({timeout:60000});
 await expect(next.getByRole("button",{name:"Add context"})).toBeVisible();
 await next.getByRole("button",{name:"Add context"}).click();
 await page.getByRole("textbox",{name:"Component function"}).fill("Test bracket");
 await page.getByRole("textbox",{name:"Assembly relationships"}).fill("Bolted to machine frame");
 await expect(next.getByRole("button",{name:"Review risks"})).toBeVisible();
 await next.getByRole("button",{name:"Review risks"}).click();
 await expect(page.getByRole("heading",{name:"Engineering evidence and risks"})).toBeVisible();
 await expect(page.getByText("Physical defect prediction remains unvalidated")).toBeVisible();
});
