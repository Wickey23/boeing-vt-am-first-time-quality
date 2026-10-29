import {test,expect} from "@playwright/test";

test("focused workspace shows one task at a time with a persistent CAD viewer",async({page})=>{
 await page.setViewportSize({width:1440,height:950});
 await page.goto("/copilot/advanced");
 const tabs=page.locator(".copilotStageTab");
 await expect(tabs).toHaveCount(5);
 await expect(page.getByRole("heading",{name:"Inspect and confirm the part"})).toBeVisible();
 await expect(page.getByRole("heading",{name:"Understand the larger assembly"})).toBeHidden();
 await expect(page.getByRole("heading",{name:"Run stress, displacement and temperature together"})).toBeHidden();
 await expect(page.getByLabel("Upload target STL")).toBeVisible();
 const viewer=page.locator(".copilotFrame");
 await expect(viewer).toBeVisible();
 await page.getByRole("button",{name:"Open Documents stage"}).click();
 await expect(page.getByRole("heading",{name:"Understand the larger assembly"})).toBeVisible();
 await expect(page.getByRole("heading",{name:"Inspect and confirm the part"})).toBeHidden();
 await expect(viewer).toBeVisible();
 await page.getByRole("button",{name:"Open Requirements stage"}).click();
 await expect(page.getByRole("heading",{name:"Define loads, interfaces and requirements"})).toBeVisible();
 await expect(page.locator(".copilotConversation")).toBeVisible();
 await expect(page.getByRole("heading",{name:"Run only supported analyses"})).toBeHidden();
 await page.getByRole("button",{name:"Open Simulate stage"}).click();
 await expect(page.getByRole("heading",{name:"Service analysis · one coordinated run"})).toBeVisible();
 await page.getByRole("button",{name:"Open Results stage"}).click();
 await expect(page.getByRole("heading",{name:"Inspect actual results"})).toBeVisible();
 await expect(page.getByText("No numerical result yet")).toBeVisible();
});
test("small screen remains navigable without horizontal scrolling",async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto("/copilot/advanced");
 await expect(page.getByRole("button",{name:"Open Part stage"})).toBeVisible();
 await page.getByRole("button",{name:"Open Documents stage"}).click();
 await expect(page.getByRole("heading",{name:"Understand the larger assembly"})).toBeVisible();
 const overflow=await page.evaluate(()=>({
  root:document.documentElement.scrollWidth,
  viewport:document.documentElement.clientWidth
 }));
 expect(overflow.root).toBeLessThanOrEqual(overflow.viewport+1);
});
