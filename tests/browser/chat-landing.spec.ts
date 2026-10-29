import {test,expect} from "@playwright/test";

test("chat-first home supports local STL attachment and first-message handoff",async({page})=>{
 const remotePosts:string[]=[];
 page.on("request",request=>{
  if(request.url().includes("/api/engineering-copilot")&&request.method()==="POST")remotePosts.push(request.url());
 });
 await page.goto("/");
 await expect(page.getByRole("heading",{name:"What are we working on today?"})).toBeVisible();
 await expect(page.getByRole("complementary",{name:"Workspace sidebar"}).getByRole("button",{name:"New study"})).toBeVisible();
 await page.getByLabel("Select STL part").setInputFiles("public/verification/cube-10mm.stl");
 await expect(page.getByText("cube-10mm.stl",{exact:true})).toBeVisible();
 await page.getByLabel("Message ORIENTAI").fill("What should I verify before analyzing this bracket?");
 await page.getByRole("button",{name:"Start conversation"}).click();
 await expect(page).toHaveURL(/\/copilot$/);
 await expect(page.getByRole("region",{name:"Engineering conversation"})).toBeVisible();
 await expect(page.getByRole("article",{name:"Uploaded STL model in chat"})).toBeVisible();
 await expect(page.getByRole("region",{name:"Analysis workflow"})).toBeVisible();
 await expect(page.getByText("What should I verify before analyzing this bracket?")).toBeVisible();
 await expect(page.getByText(/Local engineering guide · no external AI request/).last()).toBeVisible();
 await expect(page.getByRole("button",{name:"Confirm units & dimensions"})).toBeVisible();
 expect(remotePosts).toEqual([]);
});

test("mobile entry is navigable and rejects unsupported CAD formats",async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto("/");
 await expect(page.getByRole("heading",{name:"What are we working on today?"})).toBeVisible();
 await page.getByLabel("Select STL part").setInputFiles({
  name:"sample.step",mimeType:"application/octet-stream",buffer:Buffer.from("sample")
 });
 await expect(page.locator(".oaHomeError")).toContainText("Other CAD formats are not yet supported");
 await page.getByRole("button",{name:"Toggle sidebar"}).click();
 await expect(page.getByRole("navigation",{name:"Primary navigation"})).toBeVisible();
 await page.getByRole("button",{name:"Close sidebar"}).first().click();
 const size=await page.evaluate(()=>({width:document.documentElement.scrollWidth,viewport:window.innerWidth}));
 expect(size.width).toBeLessThanOrEqual(size.viewport+1);
});
