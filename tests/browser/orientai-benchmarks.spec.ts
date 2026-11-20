import {test,expect} from "@playwright/test";

test("Synthetic research benchmark opens a local STL study without automatic qualification",async({page})=>{
  await page.goto("/");
  const example=page.getByRole("button",{name:/Thin-walled sleeve/i});
  await expect(example).toBeEnabled();
  await example.click();
  await expect(page).toHaveURL(/\/copilot\/workbench/);
  await expect(page.getByText(/thin-walled-sleeve\.stl/i).first()).toBeVisible();
  await expect(page.getByRole("button",{name:/Confirm units & dimensions/i})).toBeVisible();
  // Evidence gate: generated demonstration meshes are not pre-qualified just because
  // their fixture dimensions are known. The same unit confirmation gate must apply.
  await page.getByRole("navigation",{name:"Assessment stages"})
    .getByRole("button",{name:/Failure Assessment/}).click();
  const exportPanel=page.locator("details.psDecisionExport");
  await exportPanel.locator("summary").click();
  await expect(exportPanel.getByRole("button",{name:"Export assessment PDF"})).toBeDisabled();

});
