import {test,expect} from "@playwright/test";
import {readFile} from "node:fs/promises";

test("current workbench binds source STL risk regions to the adjacent 3D viewer",async({page})=>{
 const original=await readFile("public/verification/cube-10mm.stl","utf8");
 const a=Math.PI/4,cos=Math.cos(a),sin=Math.sin(a);
 const tilted=original.replace(/vertex\\s+(-?\\d+(?:\\.\\d+)?)\\s+(-?\\d+(?:\\.\\d+)?)\\s+(-?\\d+(?:\\.\\d+)?)/g,
  (_:string,x:string,y:string,z:string)=>{
   const yv=Number(y),zv=Number(z);
   return "vertex "+x+" "+(yv*cos-zv*sin).toFixed(5)+" "+(yv*sin+zv*cos).toFixed(5);
  });
 await page.goto("/copilot/workbench");
 await page.getByLabel("Select STL part").setInputFiles({
  name:"tilted-cube.stl",mimeType:"model/stl",buffer:Buffer.from(tilted)
 });
 await page.getByRole("button",{name:"Confirm units & dimensions"}).click();
 await page.getByRole("navigation",{name:"Assessment stages"}).getByRole("button",{name:/Failure Assessment/}).click();
 const localized=page.getByLabel("Part-localized LPBF geometry screening");
 const preflight=localized.getByRole("region",{name:"Automatic LPBF failure-risk preflight"});
 await expect(preflight).toContainText("Elevated down-facing surfaces require support/process review",{timeout:60000});
 await preflight.getByRole("button",{name:/Highlight .*relevant STL triangles in 3D/}).click();
 await expect(page.getByRole("complementary",{name:"Persistent engineering model viewer"})).toContainText("geometric-risk triangles highlighted");
 await localized.getByRole("button",{name:"Clear highlighted region"}).click();
 await expect(page.getByRole("complementary",{name:"Persistent engineering model viewer"})).not.toContainText("geometric-risk triangles highlighted");
});
