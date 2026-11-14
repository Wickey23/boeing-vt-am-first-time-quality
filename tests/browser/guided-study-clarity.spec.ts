import {test,expect} from "@playwright/test";
test("guided entry explains the workflow and every workbench stage",async({page})=>{
 await page.goto("/");
 await expect(page.getByRole("region",{name:"Start a guided part review"})).toBeVisible();
 await expect(page.getByRole("button",{name:"Upload STL to start guided review"})).toBeVisible();
 await page.getByLabel("Select STL part").setInputFiles("public/verification/cube-10mm.stl");
 await page.getByRole("button",{name:"Start conversation"}).click();
 await expect(page).toHaveURL(/\/copilot\/workbench$/);
 const guide=page.getByRole("region",{name:"Guided study instructions"});
 await expect(page.getByRole("heading",{name:"Part Geometry"})).toBeVisible();
 await expect(page.getByRole("region",{name:"Recommended workflow action"})).toBeVisible();
 await page.getByRole("navigation",{name:"Assessment stages"}).getByRole("button",{name:/Engineering Context/}).click();
 await expect(guide.getByRole("heading",{name:"Explain how the part will be used"})).toBeVisible();
 await page.getByRole("navigation",{name:"Assessment stages"}).getByRole("button",{name:/Failure Assessment/}).click();
 await expect(guide.getByRole("heading",{name:"Understand the findings"})).toBeVisible();
});
