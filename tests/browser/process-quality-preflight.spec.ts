import {test,expect} from "@playwright/test";

test("LPBF process-window checker flags out-of-range settings and alerts the engineer without AI",async({page})=>{
 const posts:string[]=[];page.on("request",r=>{if(r.method()==="POST"&&r.url().includes("/api/engineering-copilot"))posts.push(r.url());});
 await page.goto("/copilot");
 await page.getByRole("button",{name:/Try synthetic cantilever bracket/}).click();
 await page.getByRole("button",{name:"Confirm units & dimensions"}).click();
 await page.locator(".oaAdvancedToolsDisclosure > summary").click();
 const card=page.getByRole("region",{name:"Deterministic LPBF process quality review"});
 await expect(card).toBeVisible();
 await expect(card).toContainText("Manufacturing evidence missing");
 await card.getByText("Enter machine, material and approved process limits").click();
 await card.getByLabel("Process machine").fill("Synthetic machine A");
 await card.getByLabel("Process material").fill("Synthetic material - test only");
 await card.getByLabel("Process parameter set").fill("QA synthetic v1");
 await card.getByLabel("Process source reference").fill("SYNTHETIC-TEST-ONLY-01");
 const fields=[
  ["Laser power","200","180","230"],
  ["Scan speed","1100","700","900"],
  ["Hatch spacing","0.1","0.09","0.12"],
  ["Layer thickness","0.04","0.03","0.05"]
 ] as const;
 for(const [label,value,minimum,maximum] of fields){
  await card.getByLabel("Planned "+label).fill(value);
  await card.getByLabel(label+" source minimum").fill(minimum);
  await card.getByLabel(label+" source maximum").fill(maximum);
 }
 await expect(card).toContainText("Scan speed is outside the declared window");
 await expect(card).toContainText("Outside entered process limits");
 await card.getByLabel("Review process source applicability").check();
 await expect(page.getByText(/reviewed LPBF parameter settings triggered 1 deterministic process-window blocker/)).toBeVisible();
 await expect(card).toContainText("4/4");
 await expect(card).toContainText("Diagnostic only");
 expect(posts).toEqual([]);
});

test("development ticker remains present and is clearly not a quality score",async({page})=>{
 await page.goto("/copilot");
 const ticker=page.locator(".oaBuildTicker");
 await expect(ticker).toBeVisible();
 await expect(ticker).toContainText("QUALITY ENGINE DEVELOPMENT");
 await expect(ticker).toContainText("tracked code changes");
 await expect(ticker.locator(".oaBuildTickerValue")).toContainText(/\d+/);
});

test("a new STL resets machine-specific process review to prevent stale qualified claims",async({page})=>{
 await page.goto("/copilot");
 await page.getByRole("button",{name:/Try synthetic cantilever bracket/}).click();
 await page.getByRole("button",{name:"Confirm units & dimensions"}).click();
 await page.locator(".oaAdvancedToolsDisclosure > summary").click();
 const card=page.getByRole("region",{name:"Deterministic LPBF process quality review"});
 await card.getByText("Enter machine, material and approved process limits").click();
 await card.getByLabel("Process machine").fill("Test machine");
 await expect(card.getByLabel("Process machine")).toHaveValue("Test machine");
 await page.getByLabel("STL coordinate units").selectOption("25.4");
 await expect(card.getByLabel("Process machine")).toHaveValue("");
 await expect(card).toContainText("Confirm STL units to review the build");
});
