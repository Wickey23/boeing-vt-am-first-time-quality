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

test("cube top-surface picks return source coordinates and a positive distance",async({page})=>{
 await page.setViewportSize({width:1600,height:950});
 await page.goto("/copilot/workbench");
 await page.getByLabel("Select STL part").setInputFiles("public/verification/cube-10mm.stl");
 await page.getByRole("button",{name:"Confirm units & dimensions"}).click();
 const command=page.getByRole("region",{name:"CAD analysis commands"}).getByRole("button",{name:"Measure",exact:true});
 await expect(command).toBeEnabled();
 const canvas=page.locator(".cadGraphicsViewport canvas");
 await expect(canvas).toBeVisible();
 await page.getByRole("button",{name:"Cube top view"}).click();
 await command.click();
 const panel=page.getByRole("region",{name:"Mesh measurement"});
 const bounds=await canvas.boundingBox();
 expect(bounds).not.toBeNull();
 // Interior points, away from the diagonal and boundaries of the known 10 mm cube.
 const x=bounds!.x+bounds!.width*.5,y=bounds!.y+bounds!.height*.5;
 const offset=Math.min(bounds!.height,bounds!.width)*.035;
 await expect(async()=>{
  await page.mouse.click(x+offset,y);
  await expect(panel.getByText(/Point 1 · Triangle/)).toBeVisible({timeout:1000});
 }).toPass({timeout:15000});
 await expect(panel.getByText(/Z 5\.000 mm/)).toBeVisible();
 await expect(panel.getByText("Triangle area 50.000 mm²")).toBeVisible();
 await page.mouse.click(x+offset,y+offset);
 const output=panel.getByLabel("Point distance");
 await expect(output).toBeVisible();
 const value=Number((await output.innerText()).match(/Distance: ([\d.]+) mm/)?.[1]);
 expect(value).toBeGreaterThan(0);
 expect(value).toBeLessThan(10);
 await panel.getByRole("button",{name:"Clear points"}).click();
 await expect(output).toHaveCount(0);
});

test("WebGL fallback keeps measurement unavailable",async({page})=>{
 await page.addInitScript(()=>{
  const original=HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext=function(this:HTMLCanvasElement,type:string,...args:unknown[]){
   if(type==="webgl"||type==="webgl2"||type==="experimental-webgl")return null;
   return Reflect.apply(original,this,[type,...args]);
  } as typeof HTMLCanvasElement.prototype.getContext;
 });
 await page.setViewportSize({width:1600,height:950});
 await page.goto("/copilot/workbench");
 await page.getByLabel("Select STL part").setInputFiles("public/verification/cube-10mm.stl");
 await page.getByRole("button",{name:"Confirm units & dimensions"}).click();
 await expect(page.getByText(/WebGL unavailable · showing the uploaded STL/)).toBeVisible();
 await expect(page.getByRole("region",{name:"CAD analysis commands"}).getByRole("button",{name:"Measure",exact:true})).toBeDisabled();
 await expect(page.getByRole("region",{name:"Mesh measurement"})).toHaveCount(0);
});
