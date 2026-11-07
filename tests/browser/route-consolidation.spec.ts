import {test,expect} from "@playwright/test";

test("primary navigation keeps process settings and reports in one workbench",async({page})=>{
 await page.goto("/copilot/workbench");
 await expect(page.getByRole("navigation",{name:"Assessment stages"})).toBeVisible();
 await page.getByRole("button",{name:"Open Metal AM process settings"}).click();
 await expect(page.getByRole("heading",{name:"What must this part do?"})).toBeVisible();
 await expect(page).toHaveURL(/\/copilot\/workbench$/);
 await page.getByRole("link",{name:"Engineering reports"}).click();
 await expect(page).toHaveURL(/\/copilot\/workbench\?stage=assessment$/);
 await expect(page.getByRole("heading",{name:"Engineering evidence and risks"})).toBeVisible();
});

test("technical guide matches the three-stage workbench",async({page})=>{
 await page.goto("/how-it-works");
 await expect(page.getByRole("heading",{name:"One part. Three stages. One engineering assessment."})).toBeVisible();
 for(const stage of ["Part Geometry","Engineering Context","Failure Assessment"]){
  await expect(page.getByRole("heading",{name:stage,exact:true})).toBeVisible();
 }
 await page.getByRole("link",{name:"Open current engineering study"}).click();
 await expect(page).toHaveURL(/\/copilot\/workbench$/);
});

test("legacy report from guided research stays in the legacy report route",async({page})=>{
 await page.goto("/orientation");
 await expect(page.getByRole("link",{name:"Guided research workflow"})).toBeVisible();
 await page.goto("/report/legacy");
 await expect(page).toHaveURL(/\/report\/legacy$/);
 await expect(page.getByRole("heading",{name:"Consolidated engineering report"}).first()).toBeVisible();
});

test("compatibility routes direct to current workbench without losing named stage",async({page})=>{
 await page.goto("/copilot");
 await expect(page).toHaveURL(/\/copilot\/workbench$/);
 await page.goto("/report");
 await expect(page).toHaveURL(/\/copilot\/workbench\?stage=assessment$/);
 await expect(page.getByRole("heading",{name:"Engineering evidence and risks"})).toBeVisible();
});

test("landing and help use one consistent engineering theme and sidebar",async({page})=>{
 await page.setViewportSize({width:1600,height:900});
 await page.goto("/");
 await expect(page.getByRole("heading",{name:"What are we working on today?"})).toBeVisible();
 const landing=await page.evaluate(()=>({
  bg:getComputedStyle(document.querySelector(".oaRoot")!).backgroundColor,
  sidebar:getComputedStyle(document.querySelector(".oaSidebar")!).backgroundColor,
  font:getComputedStyle(document.querySelector(".oaRoot")!).fontFamily,
  width:document.documentElement.scrollWidth
 }));
 await page.goto("/how-it-works");
 await expect(page.getByRole("heading",{name:"One part. Three stages. One engineering assessment."})).toBeVisible();
 const guide=await page.evaluate(()=>({
  bg:getComputedStyle(document.querySelector(".oaRoot")!).backgroundColor,
  sidebar:getComputedStyle(document.querySelector(".oaSidebar")!).backgroundColor,
  font:getComputedStyle(document.querySelector(".oaRoot")!).fontFamily,
  width:document.documentElement.scrollWidth
 }));
 expect(landing.bg).toBe(guide.bg);
 expect(landing.sidebar).toBe(guide.sidebar);
 expect(landing.font).toBe(guide.font);
 expect(landing.width).toBeLessThanOrEqual(1602);
 expect(guide.width).toBeLessThanOrEqual(1602);
 await expect(page.getByRole("navigation",{name:"Primary navigation"}).getByRole("link",{name:"Current study"})).toBeVisible();
});
