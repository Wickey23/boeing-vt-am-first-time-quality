import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

test('assessment and geometry exports download verified evidence for the current part',async({page},testInfo)=>{
 await page.goto('/copilot/workbench');
 await page.getByLabel('Select STL part').setInputFiles('public/verification/cube-10mm.stl');
 await page.getByRole('button',{name:'Confirm units & dimensions'}).click();
 await page.getByRole('region',{name:'Recommended workflow action'}).getByRole('button',{name:'Run screening'}).click();
 await expect(page.getByText(/Geometry screening results · selected orientation/)).toBeVisible();
 const stages=page.getByRole('navigation',{name:'Assessment stages'});
 await stages.getByRole('button',{name:/Engineering Context/}).click();
 await page.getByRole('textbox',{name:'Service requirements',exact:true}).fill('Inspect mounting-hole diameter against the controlled drawing.');
 await stages.getByRole('button',{name:/Failure Assessment/}).click();
 const panel=page.locator('details.psDecisionExport');await panel.locator('summary').click();
 const capture=async(label:string,name:string)=>{
  const pending=page.waitForEvent('download');await panel.getByRole('button',{name:label,exact:true}).click();
  const download=await pending;await download.saveAs(testInfo.outputPath(name));
  return readFile(testInfo.outputPath(name));
 };
 const raw=await readFile('public/verification/cube-10mm.stl');
 const digest=createHash('sha256').update(raw).digest('hex');
 const evidence=JSON.parse((await capture('Assessment evidence JSON','assessment.json')).toString());
 expect(evidence.manifest.partSha256).toBe(digest);
 expect(evidence.manifest.contentSha256).toMatch(/^[a-f0-9]{64}$/);
 expect(evidence.manifest.sourceVerification).toBe('original-bytes-verified');
 expect(evidence.requirements.find((r:{id:string})=>r.id==='context-requirements').status).toBe('unassessed');
 const pdf=await capture('Export assessment PDF','assessment.pdf');
 expect(pdf.subarray(0,5).toString()).toBe('%PDF-');
 // jsPDF stores Subject as a plain metadata string, even with compressed page streams.
 expect(pdf.toString('latin1')).toContain('Report content SHA-256: '+evidence.manifest.contentSha256);
 const geometry=JSON.parse((await capture('Analysis JSON','geometry.json')).toString());
 expect(geometry.evidenceManifest.partSha256).toBe(digest);
 expect(geometry.evidenceManifest.runId).toBe(evidence.manifest.analysisRunId);
 expect(geometry.evidenceManifest.selectedCandidateId).toBe(evidence.manifest.selectedCandidateId);
 const geometryPdf=await capture('Geometry analysis PDF','geometry.pdf');
 expect(geometryPdf.subarray(0,5).toString()).toBe('%PDF-');
 expect(geometryPdf.toString('latin1')).toContain(geometry.evidenceManifest.inputSha256);
 expect(geometryPdf.toString('latin1').trimEnd().endsWith('%%EOF')).toBe(true);
});
