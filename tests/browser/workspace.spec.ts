import {test,expect} from '@playwright/test';
test('STL upload, orientation, local persistence, fields and report share one run',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/orientation');await page.getByLabel('CAD file',{exact:true}).setInputFiles('public/verification/cube-10mm.stl');
 await expect(page.getByText('96 evaluated',{exact:true})).toBeVisible();await expect(page.locator('canvas')).toBeVisible();
 const thermal=page.locator('section').filter({has:page.getByRole('heading',{name:'Part-specific steady conduction',exact:true})});
 await thermal.getByRole('checkbox').check();await thermal.getByRole('button',{name:'Run steady conduction',exact:true}).click();await expect(thermal.getByText(/Completed for/)).toBeVisible();
 const structural=page.locator('section').filter({has:page.getByRole('heading',{name:'Part-specific service-load elasticity',exact:true})});
 await structural.getByRole('checkbox').check();await structural.getByRole('button',{name:'Run service-load FEM',exact:true}).click();await expect(structural.getByText(/Completed for/)).toBeVisible();
 await page.getByRole('combobox',{name:'Visualization',exact:true}).selectOption('stress');await expect(page.getByText(/Calculated field:.*MPa/)).toBeVisible();
 await page.getByRole('link',{name:'Open consolidated report / PDF →',exact:true}).click();await expect(page.getByRole('heading',{name:'cube-10mm.stl',exact:true})).toBeVisible();
 const run=await page.getByText(/^Run .* · /).innerText();await page.reload();await expect(page.getByText(run,{exact:true})).toBeVisible();
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Download JSON',exact:true}).click();expect((await download).suggestedFilename()).toMatch(/^orientai-.*\.json$/);
 const pdf=page.waitForEvent('download');await page.getByRole('button',{name:'Download PDF',exact:true}).click();expect((await pdf).suggestedFilename()).toMatch(/^orientai-.*\.pdf$/);expect(errors).toEqual([]);
});
test('setting changes discard previous results and recalculate',async({page})=>{await page.goto('/orientation');await page.getByRole('button',{name:'Load 10 mm verification cube',exact:true}).click();await expect(page.getByText('96 evaluated',{exact:true})).toBeVisible();await page.getByLabel('Arbitrary-angle samples (plus 24 orthogonal)',{exact:true}).fill('0');await expect(page.getByText('24 evaluated',{exact:true})).toBeVisible();});
