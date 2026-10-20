import {test,expect,type Page} from '@playwright/test';
async function upload(page:Page,name='cube-10mm'){
 await page.goto('/orientation');await page.getByLabel('CAD file',{exact:true}).setInputFiles('public/verification/'+name+'.stl');
 await expect(page.getByRole('button',{name:'Confirm dimensions & continue',exact:true})).toBeEnabled();
 await expect(page.getByText('96 evaluated',{exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Confirm dimensions & continue',exact:true}).click();
 await page.getByRole('button',{name:'Find build orientations',exact:true}).click();
 await expect(page.getByText('96 evaluated',{exact:true})).toBeVisible();
}
async function advanced(page:Page){await page.getByRole('button',{name:'2 · Manufacturing setup',exact:true}).click();await page.getByText('Advanced settings',{exact:true}).click()}
test('guided upload, fields, mesh comparisons and reports share one run',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await upload(page);await expect(page.locator('canvas')).toBeVisible();
 await page.getByRole('button',{name:'Optional studies',exact:true}).click();await page.getByText('Steady heat-transfer study',{exact:true}).click();
 const thermal=page.locator('section').filter({has:page.getByRole('heading',{name:'Part-specific steady conduction',exact:true})});
 await thermal.getByRole('checkbox').check();await thermal.getByRole('button',{name:'Run steady conduction',exact:true}).click();await expect(thermal.getByText(/Completed for/)).toBeVisible();await thermal.getByRole('button',{name:'Compare coarse vs finer mesh',exact:true}).click();await expect(thermal.getByText('Two-resolution sensitivity check',{exact:true})).toBeVisible();
 await page.getByText('Service-load stress study',{exact:true}).click();
 const structural=page.locator('section').filter({has:page.getByRole('heading',{name:'Part-specific service-load elasticity',exact:true})});
 await structural.getByRole('checkbox').check();await structural.getByRole('button',{name:'Run service-load FEM',exact:true}).click();await expect(structural.getByText(/Completed for/)).toBeVisible();await structural.getByRole('button',{name:'Compare structural mesh resolutions',exact:true}).click();await expect(structural.getByRole('heading',{name:'Structural mesh sensitivity',exact:true})).toBeVisible();
 await page.getByText('Viewer settings & calculated fields',{exact:true}).click();await page.getByRole('combobox',{name:'Visualization',exact:true}).selectOption('stress');await expect(page.getByText(/Calculated field:.*MPa/)).toBeVisible();
 await page.getByRole('button',{name:'Save & report',exact:true}).click();await page.getByRole('link',{name:'Download engineering report',exact:true}).click();await expect(page.getByRole('heading',{name:'cube-10mm.stl',exact:true})).toBeVisible();
 const run=await page.getByText(/^Run .* · /).innerText();await page.reload();await expect(page.getByText(run,{exact:true})).toBeVisible();
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Download JSON',exact:true}).click();expect((await download).suggestedFilename()).toMatch(/^orientai-.*\.json$/);
 const pdf=page.waitForEvent('download');await page.getByRole('button',{name:'Download PDF',exact:true}).click();expect((await pdf).suggestedFilename()).toMatch(/^orientai-.*\.pdf$/);expect(errors).toEqual([]);
});
test('settings invalidate results without silently rerunning',async({page})=>{
 await upload(page);await advanced(page);await page.getByLabel('Arbitrary-angle samples (plus 24 orthogonal)',{exact:true}).fill('0');
 await expect(page.getByText('96 evaluated',{exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'3 · Results',exact:true})).toBeDisabled();
 await page.getByRole('button',{name:'Find build orientations',exact:true}).click();await expect(page.getByText('24 evaluated',{exact:true})).toBeVisible();
});
test('saved revisions preserve projects and comparison renders',async({page})=>{
 await upload(page,'aerospace-mounting-lug');await page.getByRole('button',{name:'Save & report',exact:true}).click();await page.getByLabel('Local project name',{exact:true}).fill('Lug study');await page.getByText(/Saved projects & run history/).click();await page.getByRole('button',{name:'Save current revision',exact:true}).click();await expect(page.getByText('Revision saved on this device.',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Compare alternatives',exact:true}).click();await page.getByRole('button',{name:'Compare two orientations side by side',exact:true}).click();await expect(page.locator('canvas')).toHaveCount(3);
 await advanced(page);await page.getByLabel('Arbitrary-angle samples (plus 24 orthogonal)',{exact:true}).fill('0');await page.getByRole('button',{name:'Find build orientations',exact:true}).click();await expect(page.getByText('24 evaluated',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Save & report',exact:true}).click();await page.getByText(/Saved projects & run history/).click();await page.getByRole('button',{name:'Open revision',exact:true}).click();await expect(page.getByText('96 evaluated',{exact:true})).toBeVisible();await page.reload();await expect(page.getByText('96 evaluated',{exact:true})).toBeVisible();
});
test('teaching samples and invalid mesh inspection on mobile',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 for(const name of ['aerospace-overhang-bracket','aerospace-thin-wall-channel','aerospace-nozzle-sleeve','invalid-open-surface']){
  await page.goto('/orientation');if(await page.getByRole('button',{name:'Check or replace part',exact:true}).count()){await page.getByRole('button',{name:'Check or replace part',exact:true}).click();await page.getByText('Replace this part',{exact:true}).click()}
  await page.getByLabel('CAD file',{exact:true}).setInputFiles('public/verification/'+name+'.stl');await expect(page.getByRole('button',{name:'Confirm dimensions & continue',exact:true})).toBeEnabled();
  if(name==='invalid-open-surface')await expect(page.getByText(/OPEN_SURFACE/)).toBeVisible();
  await page.getByRole('button',{name:'Confirm dimensions & continue',exact:true}).click();await page.getByRole('button',{name:'Find build orientations',exact:true}).click();await expect(page.getByText('96 evaluated',{exact:true})).toBeVisible();
 }
 await page.getByRole('button',{name:'Optional studies',exact:true}).click();await page.getByText('Steady heat-transfer study',{exact:true}).click();await expect(page.getByRole('button',{name:'Run steady conduction',exact:true})).toBeDisabled();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBeTruthy();
});
test('welcome hides results and unit changes require confirmation',async({page})=>{
 await page.goto('/orientation');await expect(page.getByRole('heading',{name:'Upload your part',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Find build orientations',exact:true})).toHaveCount(0);await expect(page.getByText('Part-specific steady conduction',{exact:true})).toHaveCount(0);
 await page.getByLabel('CAD file',{exact:true}).setInputFiles('public/verification/cube-10mm.stl');await expect(page.getByText('10.00 × 10.00 × 10.00',{exact:false})).toBeVisible();
 await page.getByLabel('STL source units',{exact:true}).selectOption('25.4');await expect(page.getByText('254.00 × 254.00 × 254.00',{exact:false})).toBeVisible();await expect(page.getByRole('button',{name:'2 · Manufacturing setup',exact:true})).toBeDisabled();
 await page.reload();await expect(page.getByRole('button',{name:'Confirm dimensions & continue',exact:true})).toBeEnabled();await expect(page.getByRole('button',{name:'3 · Results',exact:true})).toBeDisabled();
});
