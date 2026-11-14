import {test,expect} from "@playwright/test";

test("failure assessment leads with actions and keeps exports available",async({page})=>{
 await page.goto("/copilot/workbench");
 await page.getByRole("navigation",{name:"Assessment stages"}).getByRole("button",{name:/Failure Assessment/}).click();
 await expect(page.getByRole("heading",{name:"Understand the findings"})).toBeVisible();
 await expect(page.getByText("What should I do with these results?")).toBeVisible();
 await page.getByRole("button",{name:"Show next actions"}).click();
 await expect(page.getByText("Prioritized engineering actions")).toBeVisible();
 const exportDetails=page.locator("details.psDecisionExport");
 await expect(exportDetails.getByText("Download engineering report and evidence")).toBeVisible();
 await exportDetails.locator("summary").click();
 await expect(exportDetails.getByRole("button",{name:"Export assessment PDF"})).toBeVisible();
});
