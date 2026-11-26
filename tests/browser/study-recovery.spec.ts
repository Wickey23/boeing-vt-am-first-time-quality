import {test,expect} from '@playwright/test';
test('restoring changed settings preserves the part, archives the old run and requires recalculation',async({page})=>{
 await page.goto('/orientation/advanced');
 await page.getByLabel('CAD file',{exact:true}).setInputFiles('public/verification/cube-10mm.stl');
 await page.getByRole('button',{name:'Confirm dimensions & continue',exact:true}).click();
 await page.getByRole('button',{name:'Find build orientations',exact:true}).click();
 await expect(page.getByText('96 evaluated',{exact:true})).toBeVisible();
 await expect(page.getByText('Active workspace saved on this device.',{exact:true})).toBeVisible();
 const runId=await page.evaluate(async()=>new Promise<string>((resolve,reject)=>{
  const request=indexedDB.open('orientai-local-workspace',1);
  request.onsuccess=()=>{const db=request.result;const tx=db.transaction('workspace','readwrite');const store=tx.objectStore('workspace');const read=store.get('active');let id='';
   read.onsuccess=()=>{const value=read.result;id=value.result.runId;value.settings.unitScale=25.4;store.put(value,'active');};
   tx.oncomplete=()=>{db.close();resolve(id);};tx.onerror=()=>reject(tx.error);
  };request.onerror=()=>reject(request.error);
 }));
 await page.reload();
 await expect(page.getByRole('alert').filter({hasText:'Saved results were set aside'})).toContainText('Saved results were set aside');
 await expect(page.getByLabel('STL source units')).toHaveValue('25.4');
 await expect(page.getByText('96 evaluated',{exact:true})).toHaveCount(0);
 const archived=await page.evaluate(async id=>new Promise<boolean>((resolve,reject)=>{
  const request=indexedDB.open('orientai-local-workspace',1);request.onsuccess=()=>{const db=request.result;const read=db.transaction('workspace').objectStore('workspace').get('recovery-'+id);read.onsuccess=()=>{resolve(read.result?.result?.runId===id);db.close();};read.onerror=()=>reject(read.error);};
 }),runId);
 expect(archived).toBe(true);
});

