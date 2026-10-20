import {test,expect} from '@playwright/test';
test('STL upload, orientation, local persistence, fields and report share one run',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/orientation');await page.getByLabel('CAD file',{exact:true}).setInputFiles('public/verification/cube-10mm.stl');
 await expect(page.getByText('96 evaluated',{exact:true})).toBeVisible();await expect(page.locator('canvas')).toBeVisible();
 await page.getByRole('checkbox',{name:'I have checked the STL units and displayed dimensions against my intended part.',exact:true}).check();
 const thermal=page.locator('section').filter({has:page.getByRole('heading',{name:'Part-specific steady conduction',exact:true})});
 await thermal.getByRole('checkbox').check();await thermal.getByRole('button',{name:'Run steady conduction',exact:true}).click();await expect(thermal.getByText(/Completed for/)).toBeVisible();await thermal.getByRole('button',{name:'Compare coarse vs finer mesh',exact:true}).click();await expect(thermal.getByText('Two-resolution sensitivity check',{exact:true})).toBeVisible();
 const structural=page.locator('section').filter({has:page.getByRole('heading',{name:'Part-specific service-load elasticity',exact:true})});
 await structural.getByRole('checkbox').check();await structural.getByRole('button',{name:'Run service-load FEM',exact:true}).click();await expect(structural.getByText(/Completed for/)).toBeVisible();await structural.getByRole('button',{name:'Compare structural mesh resolutions',exact:true}).click();await expect(structural.getByRole('heading',{name:'Structural mesh sensitivity',exact:true})).toBeVisible();
 await page.getByRole('combobox',{name:'Visualization',exact:true}).selectOption('stress');await expect(page.getByText(/Calculated field:.*MPa/)).toBeVisible();
 await page.getByRole('link',{name:'Open consolidated report / PDF →',exact:true}).click();await expect(page.getByRole('heading',{name:'cube-10mm.stl',exact:true})).toBeVisible();
 const run=await page.getByText(/^Run .* · /).innerText();await page.reload();await expect(page.getByText(run,{exact:true})).toBeVisible();
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Download JSON',exact:true}).click();expect((await download).suggestedFilename()).toMatch(/^orientai-.*\.json$/);
 const pdf=page.waitForEvent('download');await page.getByRole('button',{name:'Download PDF',exact:true}).click();expect((await pdf).suggestedFilename()).toMatch(/^orientai-.*\.pdf$/);expect(errors).toEqual([]);
});
test('setting changes discard previous results and recalculate',async({page})=>{await page.goto('/orientation');await page.getByLabel('CAD file',{exact:true}).setInputFiles('public/verification/cube-10mm.stl');await expect(page.getByText('96 evaluated',{exact:true})).toBeVisible();await page.getByLabel('Arbitrary-angle samples (plus 24 orthogonal)',{exact:true}).fill('0');await expect(page.getByText('24 evaluated',{exact:true})).toBeVisible();});

test('saved revisions preserve projects and orientation comparison renders',async({page})=>{
 await page.goto('/orientation');await page.getByLabel('CAD file',{exact:true}).setInputFiles('public/verification/aerospace-mounting-lug.stl');await expect(page.getByText('96 evaluated',{exact:true})).toBeVisible();
 await page.getByLabel('Local project name',{exact:true}).fill('Lug study');await page.getByText(/Saved projects & run history/).click();await page.getByRole('button',{name:'Save current revision',exact:true}).click();await expect(page.getByText('Revision saved on this device.',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Compare two orientations side by side',exact:true}).click();await expect(page.locator('canvas')).toHaveCount(3);
 await page.getByLabel('Arbitrary-angle samples (plus 24 orthogonal)',{exact:true}).fill('0');await expect(page.getByText('24 evaluated',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Open revision',exact:true}).click();await expect(page.getByText('96 evaluated',{exact:true})).toBeVisible();
 await page.reload();await page.getByText(/Saved projects & run history/).click();await expect(page.getByRole('button',{name:'Open revision',exact:true})).toBeVisible();
});
test('all teaching samples analyze; invalid mesh blocks physical cases on mobile',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/orientation');
 for(const file of ['aerospace-overhang-bracket','aerospace-thin-wall-channel','aerospace-nozzle-sleeve','invalid-open-surface']){await page.getByLabel('CAD file',{exact:true}).setInputFiles('public/verification/'+file+'.stl');await expect(page.getByText('96 evaluated',{exact:true})).toBeVisible();}
 await page.getByRole('checkbox',{name:'I have checked the STL units and displayed dimensions against my intended part.',exact:true}).check();await expect(page.getByRole('button',{name:'Run steady conduction',exact:true})).toBeDisabled();await expect(page.getByText(/OPEN_SURFACE:/)).toBeVisible();
});
