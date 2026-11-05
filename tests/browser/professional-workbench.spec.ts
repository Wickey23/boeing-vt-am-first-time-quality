import {test,expect} from "@playwright/test";

test("new professional study keeps a readable three-stage interface and actual geometry inspection",async({page})=>{
 await page.setViewportSize({width:1600,height:900});
 await page.goto("/copilot/workbench");
 await expect(page.getByRole("heading",{name:"Part Geometry",exact:true})).toBeVisible();
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
 await expect(page.getByText(/Geometry screening results · selected orientation/)).toBeVisible({timeout:60000});
 await page.getByRole("navigation",{name:"Assessment stages"}).getByRole("button",{name:/Engineering Context/}).click();
 await expect(page.getByRole("heading",{name:"What must this part do?"})).toBeVisible();
});

test("assembly text remains part-specific and report stage distinguishes unassessed mechanisms",async({page})=>{
 await page.goto("/copilot/workbench");
 await page.getByLabel("Select STL part").setInputFiles("public/verification/cube-10mm.stl");
 await page.getByRole("navigation",{name:"Assessment stages"}).getByRole("button",{name:/Engineering Context/}).click();
 await page.getByLabel("Upload assembly documents").setInputFiles({
  name:"sample-assembly.txt",mimeType:"text/plain",
  buffer:Buffer.from("Mounting bracket for a demonstration assembly.\nProposed 1200 N bolt load is unverified.\n")
 });
 await expect(page.getByText("sample-assembly.txt",{exact:true})).toBeVisible();
 await page.getByPlaceholder("e.g. Mounting bracket for actuator").fill("Demo mounting bracket");
 await page.getByRole("navigation",{name:"Assessment stages"}).getByRole("button",{name:/Failure Assessment/}).click();
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
 await expect(page.getByRole("complementary",{name:"Persistent engineering model viewer"}).getByRole("img",{name:"Canvas projection of uploaded STL geometry"})).toBeVisible({timeout:30000});
 await expect(page.getByText(/WebGL unavailable · showing/)).toBeVisible();
 await expect(page.getByRole("heading",{name:"Part Geometry",exact:true})).toBeVisible();
});

test("fit-screen mode uses the desktop viewport for engineering work instead of oversized chrome",async({page})=>{
 await page.setViewportSize({width:1744,height:888});
 await page.goto("/copilot/workbench");
 const root=page.locator(".psRoot");
 await expect(root).toHaveClass(/psFit/);
 await expect(page.getByRole("navigation",{name:"Assessment stages"}).getByRole("button")).toHaveCount(3);
 const geometry=await page.evaluate(()=>{
  function rect(selector:string){
   const r=document.querySelector(selector)?.getBoundingClientRect();
   if(!r)throw new Error("Missing layout element: "+selector);
   return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};
  }
  return {stageHeader:rect(".psWorkspaceHeader"),stageViewport:rect(".psStageScroll"),
   composer:rect(".psAssistant"),viewer:rect(".psViewerFrame"),
   viewerControls:rect(".psReferenceViewSettings"),sidebar:rect(".oaSidebar"),
   bodyScroll:document.body.scrollHeight,windowHeight:window.innerHeight,
   docWidth:document.documentElement.scrollWidth,windowWidth:window.innerWidth};
 });
 expect(geometry.stageHeader.height).toBeLessThan(95);
 expect(geometry.viewer.height).toBeGreaterThan(365);
 expect(geometry.composer.height).toBeLessThan(115);
 expect(geometry.sidebar.width).toBeGreaterThan(199);
 expect(geometry.sidebar.width).toBeLessThan(236);
 expect(geometry.docWidth).toBeLessThanOrEqual(geometry.windowWidth+2);
 expect(geometry.bodyScroll).toBeLessThanOrEqual(geometry.windowHeight+3);
 await expect(page.getByRole("heading",{name:"Upload the part you want to evaluate"})).toBeInViewport();
 await page.getByRole("navigation",{name:"Assessment stages"}).getByRole("button",{name:/Engineering Context/}).click();
 await expect(page.getByRole("heading",{name:"What must this part do?"})).toBeInViewport();
 await page.getByLabel("Select STL part").setInputFiles("public/verification/cube-10mm.stl");
 await page.getByRole("navigation",{name:"Assessment stages"}).getByRole("button",{name:"Part Geometry"}).click();
 await expect(page.locator(".psReferenceTopGrid")).toBeVisible();
 await expect(page.locator(".psReferenceBottomGrid")).toBeVisible();
});


test("reference geometry layout uses two card rows, recommendation and persistent right CAD panel",async({page})=>{
 await page.setViewportSize({width:1672,height:941});
 await page.goto("/copilot/workbench");
 await page.getByLabel("Select STL part").setInputFiles("public/verification/cube-10mm.stl");
 await expect(page.getByRole("region",{name:"Dimensions and units"})).toBeVisible();
 const cards=await page.evaluate(()=>{
  const rect=(s:string)=>{const r=document.querySelector(s)?.getBoundingClientRect();if(!r)throw Error(s);return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,height:r.height,width:r.width};};
  return {model:rect(".psReferenceModel"),mesh:rect(".psReferenceMesh"),
   dimensions:rect(".psReferenceDimensions"),units:rect(".psReferenceConfirmation"),
   recommendation:rect(".psReferenceRecommendation"),viewer:rect(".psViewerFrame"),
   sidebar:rect(".oaSidebar"),stepper:rect(".psStepper")};
 });
 expect(cards.model.y).toBeCloseTo(cards.mesh.y,0);
 expect(cards.model.right).toBeLessThan(cards.mesh.x);
 expect(cards.dimensions.y).toBeCloseTo(cards.units.y,0);
 expect(cards.model.bottom).toBeLessThan(cards.dimensions.y);
 expect(cards.units.bottom).toBeLessThan(cards.recommendation.y);
 expect(cards.viewer.height).toBeGreaterThan(365);
 expect(cards.sidebar.width).toBeGreaterThan(199);
 await expect(page.getByRole("button",{name:"Quick view"})).toBeVisible();
 await page.getByRole("button",{name:"Quick view"}).click();
 await expect(page.locator(".psRoot")).toHaveClass(/psViewerExpanded/);
 await page.getByRole("button",{name:"Close expanded viewer"}).click();
 await expect(page.locator(".psRoot")).not.toHaveClass(/psViewerExpanded/);
});


test("CAD viewport owns the right pane, with secondary controls collapsed by default",async({page})=>{
 await page.setViewportSize({width:1707,height:855});
 await page.goto("/copilot/workbench");
 await page.getByLabel("Select STL part").setInputFiles("public/verification/cube-10mm.stl");
 const viewer=page.getByRole("complementary",{name:"Persistent engineering model viewer"});
 const inspector=viewer.locator("details.psEngineeringInspector");
 await expect(inspector).not.toHaveAttribute("open");
 await expect(viewer.getByRole("toolbar",{name:"3D model navigation"})).toBeVisible();
 await expect(viewer.getByRole("combobox",{name:"Geometry display mode"})).toBeVisible();
 const v=await page.evaluate(()=>{
  const a=document.querySelector(".psViewerFrame")?.getBoundingClientRect();
  const b=document.querySelector(".psReferenceViewerCard")?.getBoundingClientRect();
  if(!a||!b)throw Error("Missing viewer");
  return {viewerHeight:a.height,cardHeight:b.height,ratio:a.height/b.height,
   pageWidth:document.documentElement.scrollWidth,clientWidth:window.innerWidth};
 });
 expect(v.viewerHeight).toBeGreaterThan(370);
 expect(v.ratio).toBeGreaterThan(.68);
 expect(v.pageWidth).toBeLessThanOrEqual(v.clientWidth+2);
 await inspector.locator("summary").first().click();
 await expect(inspector).toHaveAttribute("open","");
 await viewer.getByRole("checkbox",{name:"Preview geometric overhang overlay"}).check();
 await expect(viewer.getByRole("combobox",{name:"Geometry display mode"})).toHaveValue("overhangs");
 await viewer.getByRole("combobox",{name:"Geometry display mode"}).selectOption("solid");
 await expect(viewer.getByRole("checkbox",{name:"Preview geometric overhang overlay"})).not.toBeChecked();
});
