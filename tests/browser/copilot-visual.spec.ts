import {test,expect} from "@playwright/test";

function luminance(hex:string){
 const channels=hex.replace("#","").match(/.{2}/g)!.map(value=>parseInt(value,16)/255);
 const linear=channels.map(value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4);
 return .2126*linear[0]+.7152*linear[1]+.0722*linear[2];
}
function contrast(css:string,background:string){
 const nums=css.match(/[\d.]+/g)?.slice(0,3).map(Number)??[];
 expect(nums).toHaveLength(3);
 const foreground="#"+nums.map(x=>Math.round(x).toString(16).padStart(2,"0")).join("");
 const [a,b]=[luminance(foreground),luminance(background)].sort((x,y)=>y-x);
 return (a+.05)/(b+.05);
}

test("engineering copilot dark surfaces have readable text and vertically stacked panel headings",async({page})=>{
 await page.setViewportSize({width:1450,height:950});
 await page.goto("/copilot");
 await expect(page.getByRole("heading",{name:"Understand the whole build. Analyze the right part."})).toBeVisible();
 const intro=page.locator(".copilotIntro > p:not(.guidedEyebrow)");
 expect(contrast(await intro.evaluate(el=>getComputedStyle(el).color),"#f5f7fb")).toBeGreaterThanOrEqual(4.5);
 const headings=page.locator(".copilotHeading");
 await expect(headings).toHaveCount(2);
 for(let i=0;i<2;i++){
  const h=headings.nth(i);
  await expect(h.locator("h2")).toBeVisible();
  await expect(h.locator("p")).toBeVisible();
  const layout=await h.evaluate(header=>{
   const title=header.querySelector("h2")!,description=header.querySelector("p")!;
   const a=title.getBoundingClientRect(),b=description.getBoundingClientRect();
   return {display:getComputedStyle(header).display,top:b.top,bottom:a.bottom,
     height:header.getBoundingClientRect().height,
     headingColor:getComputedStyle(title).color,descriptionColor:getComputedStyle(description).color};
  });
  expect(layout.display).toBe("flex");
  expect(layout.top).toBeGreaterThan(layout.bottom);
  expect(layout.height).toBeLessThan(120);
  expect(contrast(layout.headingColor,"#10283a")).toBeGreaterThanOrEqual(4.5);
  expect(contrast(layout.descriptionColor,"#10283a")).toBeGreaterThanOrEqual(4.5);
 }
 const message=page.locator(".copilotBubble.assistant p").first();
 await expect(message).toBeVisible();
 expect(contrast(await message.evaluate(el=>getComputedStyle(el).color),"#18384d")).toBeGreaterThanOrEqual(4.5);
});
test("STL unit mismatch is made obvious without claiming machine infeasibility",async({page})=>{
 await page.goto("/copilot");
 await page.getByLabel("Upload target STL").setInputFiles("public/verification/cube-10mm.stl");
 await page.getByLabel("STL input units").selectOption("1000");
 await expect(page.getByText("Review the selected units and machine envelope")).toBeVisible();
 await expect(page.getByText(/This could be a units mismatch or a part requiring different equipment/)).toBeVisible();
 await page.getByLabel("STL input units").selectOption("1");
 await expect(page.getByText("Review the selected units and machine envelope")).toHaveCount(0);
 await expect(page.getByText(/STL files do not encode physical units/)).toBeVisible();
});
