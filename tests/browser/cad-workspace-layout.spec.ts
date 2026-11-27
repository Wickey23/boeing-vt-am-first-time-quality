import {expect,test} from "@playwright/test";

test("CAD layout presents the model first and retains independent pane preference",async({page})=>{
 await page.setViewportSize({width:1600,height:950});
 await page.goto("/copilot/workbench");
 const toggle=page.getByRole("button",{name:"CAD workspace layout"});
 await expect(toggle).toBeVisible();
 await expect(toggle).toHaveAttribute("aria-pressed","true");
 const ribbon=page.getByRole("region",{name:"CAD analysis commands"});
 await expect(ribbon).toBeVisible();
 const model=page.getByRole("complementary",{name:"Persistent engineering model viewer"});
 const properties=page.locator("#ps-engineering-study");
 const modelBox=await model.boundingBox(),propertiesBox=await properties.boundingBox();
 expect(modelBox).not.toBeNull();
 expect(propertiesBox).not.toBeNull();
 expect(modelBox!.x).toBeLessThan(propertiesBox!.x);
 expect(modelBox!.width).toBeGreaterThan(propertiesBox!.width);
 await ribbon.getByRole("button",{name:"Engineering Context",exact:true}).click();
 await expect(page.getByRole("region",{name:"Active assessment stage"}).getByRole("heading",{name:"What must this part do?"})).toBeVisible();
 const handle=page.getByRole("separator",{name:"Resize study and 3D viewer panels"});
 await expect(handle).toHaveAttribute("aria-valuenow","58");
 await handle.focus();
 await handle.press("ArrowRight");
 await expect(handle).toHaveAttribute("aria-valuenow","60");
 await page.reload();
 await expect(toggle).toHaveAttribute("aria-pressed","true");
 await expect(handle).toHaveAttribute("aria-valuenow","60");
 await toggle.click();
 await expect(handle).toHaveAttribute("aria-valuenow","42");
 await expect(ribbon).toHaveCount(0);
});

test("CAD mode leaves mobile study controls accessible",async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.addInitScript(()=>localStorage.setItem("orientai-cad-layout-v1","true"));
 await page.goto("/copilot/workbench");
 await expect(page.getByRole("region",{name:"Active assessment stage"})).toBeVisible();
 await expect(page.getByRole("navigation",{name:"Assessment stages"})).toBeVisible();
 await expect(page.getByRole("button",{name:"CAD workspace layout"})).toBeHidden();
 await expect(page.getByRole("region",{name:"CAD analysis commands"})).toBeHidden();
});
