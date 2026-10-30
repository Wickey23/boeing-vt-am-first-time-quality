import {test,expect} from "@playwright/test";

test("main chat never calls ARC without approval, then labels a mocked AI response accurately",async({page})=>{
 const posts:string[]=[];
 await page.route("**/api/engineering-copilot",async route=>{
  const request=route.request();
  if(request.method()==="GET")return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({enabled:true,requiresApproval:true})});
  posts.push(request.postData()??"");
  return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({text:"Simulated ARC reply. Upload an STL and confirm units before geometric screening.",mode:"ai",simulationsExecuted:false,sourceIds:[]})});
 });
 await page.goto("/copilot");
 await expect(page.getByLabel("Authorize AI messages from main chat")).toBeVisible();
 await page.getByLabel("Message ORIENTAI").fill("What can you analyze?");
 await page.getByRole("button",{name:"Send message"}).click();
 await expect(page.getByText("Local engineering guide · no external AI request").last()).toBeVisible();
 expect(posts).toHaveLength(0);
 await page.getByLabel("Authorize AI messages from main chat").check();
 await expect(page.getByText(/configured, not connectivity-verified/)).toBeVisible();
 await page.getByLabel("Message ORIENTAI").fill("Describe the LPBF geometry checks.");
 await page.getByRole("button",{name:"Send message"}).click();
 await expect(page.getByText(/Simulated ARC reply/)).toBeVisible();
 await expect(page.getByText(/External AI · approved text and mesh summary only/)).toBeVisible();
 expect(posts).toHaveLength(1);
 const payload=JSON.parse(posts[0]);
 expect(payload.allowExternal).toBe(true);
 expect(payload.message).toContain("LPBF geometry");
 expect(JSON.stringify(payload)).not.toContain("data:application");
});

test("a failed provider call is not mislabeled as a local-only guide",async({page})=>{
 await page.route("**/api/engineering-copilot",async route=>{
  if(route.request().method()==="GET")return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({enabled:true,requiresApproval:true})});
  return route.fulfill({status:502,contentType:"application/json",body:JSON.stringify({error:"VT ARC rejected the API key (HTTP 401)."})});
 });
 await page.goto("/copilot");
 await page.getByLabel("Authorize AI messages from main chat").check();
 await page.getByLabel("Message ORIENTAI").fill("Check the upstream model.");
 await page.getByRole("button",{name:"Send message"}).click();
 await expect(page.getByText(/AI request failed: VT ARC rejected the API key \(HTTP 401\)/)).toBeVisible();
 await expect(page.getByText(/External AI attempt failed · no solver executed/)).toBeVisible();
 await expect(page.getByText("Local engineering guide · no external AI request")).toHaveCount(0);
});
