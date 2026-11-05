import {test,expect} from "@playwright/test";

test("new professional study keeps a readable three-stage interface and actual geometry inspection",async({page})=>{
 await page.setViewportSize({width:1600,height:900});
 await page.goto("/copilot/workbench");
 await expect(page.getByRole("heading",{name:"Pre-build assessment"})).toBeVisible();
 await page.getByLabel("Select STL part").setInputFiles("public/verification/cube-10mm.stl");
 const stepper=page.getByRole("navigation",{name:"Assessment stages"});
 for(const label of ["Part Geometry","Engineering Context","Failure Assessment"])await expect(stepper.getByText(label,{exact:true})).toBeVisible();
 const items=await stepper.getByRole("button").evaluateAll(elements=>elements.map(element=>element.getBoundingClientRect().toJSON()));
 expect(items).toHaveLength(3);
 expect(items[0].right).toBeLessThan(items[1].left);
 expect(items[1].right).toBeLessThan(items[2].left);
 await expect(page.getByRole("region",{name:"Mesh inspection"})).toContainText("Triangles");
 await expect(page.getByRole("region",{name:"Dimensions and units"})).toContainText("mm");
 await page.getByRole("button",{name:"Confirm units & dimensions"}).click();
 await page.getByRole("button",{name:"Run geometry screening"}).click();
 await expect(page.getByText("Selected orientation", {exact:false})).toBeVisible({timeout:60000});
 await page.getByRole("button",{name:/Engineering Context/}).click();
 await expect(page.getByRole("heading",{name:"What must this part do?"})).toBeVisible();
});

test("assembly text remains part-specific and report stage distinguishes unassessed mechanisms",async({page})=>{
 await page.goto("/copilot/workbench");
 await page.getByLabel("Select STL part").setInputFiles("public/verification/cube-10mm.stl");
 await page.getByRole("button",{name:/Engineering Context/}).click();
 await page.getByLabel("Upload assembly documents").setInputFiles({
  name:"sample-assembly.txt",mimeType:"text/plain",
  buffer:Buffer.from("Mounting bracket for a demonstration assembly.\nProposed 1200 N bolt load is unverified.\n")
 });
 await expect(page.getByText("sample-assembly.txt")).toBeVisible();
 await page.getByPlaceholder("e.g. Mounting bracket for actuator").fill("Demo mounting bracket");
 await page.getByRole("button",{name:/Failure Assessment/}).click();
 await expect(page.getByRole("heading",{name:"Engineering evidence and risks"})).toBeVisible();
 await expect(page.getByText("Lack-of-fusion porosity")).toBeVisible();
 await expect(page.getByText("Not assessed",{exact:true}).first()).toBeVisible();
 await expect(page.getByRole("button",{name:"Export evidence PDF"})).toBeDisabled();
});

test("WebGL failure displays geometry-only STL projection rather than blocking the study",async({page})=>{
 await page.addInitScript(()=>{
  const original=HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext=function(this:HTMLCanvasElement,type:string,...args:unknown[]){
   if(type==="webgl"||type==="webgl2"||type==="experimental-webgl")return null;
   return Reflect.apply(original,this,[type,...args]);
  } as typeof HTMLCanvasElement.prototype.getContext;
 });
 await page.goto("/copilot/workbench");
 await page.getByLabel("Select STL part").setInputFiles("public/verification/cube-10mm.stl");
 await expect(page.getByRole("img",{name:"Canvas projection of uploaded STL geometry"})).toBeVisible({timeout:30000});
 await expect(page.getByText(/WebGL unavailable/)).toBeVisible();
 await expect(page.getByRole("heading",{name:"Inspect and confirm the model"})).toBeVisible();
});
