import {test,expect} from "@playwright/test";
test("mesh measurement requires verified units and can be dismissed",async({page})=>{
 await page.setViewportSize({width:1600,height:950});
 await page.goto("/copilot/workbench");
 const command=page.getByRole("region",{name:"CAD analysis commands"}).getByRole("button",{name:"Measure",exact:true});
 await expect(command).toBeDisabled();
 await page.getByLabel("Select STL part").setInputFiles("public/verification/cube-10mm.stl");
 await expect(command).toBeDisabled();
 await page.getByRole("button",{name:"Confirm units & dimensions"}).click();
 await expect(command).toBeEnabled();
 await command.click();
 const panel=page.getByRole("region",{name:"Mesh measurement"});
 await expect(panel).toBeVisible();
 await expect(panel).toContainText("Click a point on the STL surface");
 await expect(panel.getByRole("button",{name:"Clear points"})).toBeDisabled();
 await panel.getByRole("button",{name:"Close measurement"}).click();
 await expect(panel).toHaveCount(0);
 await expect(command).toHaveAttribute("aria-pressed","false");
});
