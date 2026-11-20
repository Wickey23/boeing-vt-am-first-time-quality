import {test,expect} from "@playwright/test";

test("Synthetic research benchmark opens a local STL study without automatic qualification",async({page})=>{
  await page.goto("/");
  const example=page.getByRole("button",{name:/Thin-walled sleeve/i});
  await expect(example).toBeEnabled();
  await example.click();
  await expect(page).toHaveURL(/\/copilot\/workbench/);
  await expect(page.getByText(/thin-walled-sleeve\.stl/i).first()).toBeVisible();
  await expect(page.getByRole("button",{name:/Confirm units & dimensions/i})).toBeVisible();
});
