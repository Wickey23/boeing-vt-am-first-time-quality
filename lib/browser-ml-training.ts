const FEATURES=["build_height_mm","down_facing_area_mm2","support_proxy_mm3","contact_area_mm2","overhang_fraction","part_volume_mm3","surface_area_mm2"] as const;
const REQUIRED=["part_id","process_profile_id",...FEATURES,"target_support_volume_mm3"] as const;
function parseCSV(text:string){const rows:string[][]=[];let row:string[]=[],cell="",quote=false;for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quote&&text[i+1]==='"'){cell+='"';i++}else quote=!quote}else if(c===','&&!quote){row.push(cell.trim());cell=""}else if((c==='\n'||c==='\r')&&!quote){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell.trim());if(row.some(v=>v!==""))rows.push(row);row=[];cell=""}else cell+=c}if(quote)throw Error("Malformed CSV: unterminated quoted field");row.push(cell.trim());if(row.some(v=>v!==""))rows.push(row);return rows}
type Entry={part:string;profile:string;x:number[];y:number};
const mae=(a:number[],b:number[])=>a.reduce((s,v,i)=>s+Math.abs(v-b[i]),0)/a.length;
function solve(A:number[][],b:number[]){const n=b.length;const m=A.map((r,i)=>[...r,b[i]]);for(let i=0;i<n;i++){let pivot=i;for(let j=i+1;j<n;j++)if(Math.abs(m[j][i])>Math.abs(m[pivot][i]))pivot=j;if(Math.abs(m[pivot][i])<1e-12)throw Error("Degenerate feature matrix");[m[i],m[pivot]]=[m[pivot],m[i]];const v=m[i][i];for(let k=i;k<=n;k++)m[i][k]/=v;for(let j=0;j<n;j++)if(j!==i){const factor=m[j][i];for(let k=i;k<=n;k++)m[j][k]-=factor*m[i][k]}}return m.map(r=>r[n])}
export async function trainFromCSV(text:string){
 if(text.length>2e6)throw Error("CSV exceeds 2 MB");
 const rows=parseCSV(text);if(rows.length<2)throw Error("CSV has no data");
 const header=rows[0],missing=REQUIRED.filter(k=>!header.includes(k));if(missing.length)throw Error("Missing columns: "+missing.join(", "));
 if(new Set(header).size!==header.length)throw Error("Duplicate CSV header names");
 const cols=Object.fromEntries(header.map((v,i)=>[v,i]));
 const entries:Entry[]=rows.slice(1).map((r,i)=>{if(r.length!==header.length)throw Error("Column count differs at row "+(i+2));const x=FEATURES.map(k=>Number(r[cols[k]])),y=Number(r[cols.target_support_volume_mm3]);if(!r[cols.part_id]||!r[cols.process_profile_id]||[...x,y].some(v=>!Number.isFinite(v))||x.some(v=>v<0)||x[4]>1||y<0)throw Error("Invalid required value at row "+(i+2));return{part:r[cols.part_id],profile:r[cols.process_profile_id],x,y}});
 const parts=[...new Set(entries.map(r=>r.part))].sort(),profiles=[...new Set(entries.map(r=>r.profile))];if(entries.length<30||parts.length<5)throw Error("At least 30 real labeled rows from 5 distinct parts required");if(profiles.length!==1)throw Error("Only one manufacturing profile per training file");
 const seen=new Set<string>();for(const r of entries){const key=[r.part,r.profile,...r.x.slice(0,4)].join("|");if(seen.has(key))throw Error("Duplicate geometry/orientation record found");seen.add(key)}
 // Deterministic unseen-part holdout, never splitting orientations from the same part.
 const holdoutParts=new Set(parts.filter((_,i)=>i%4===0)),train=entries.filter(r=>!holdoutParts.has(r.part)),test=entries.filter(r=>holdoutParts.has(r.part));if(!train.length||!test.length)throw Error("Invalid holdout split");
 const means=FEATURES.map((_,i)=>train.reduce((s,r)=>s+r.x[i],0)/train.length);
 const scales=FEATURES.map((_,i)=>{const v=Math.sqrt(train.reduce((s,r)=>s+(r.x[i]-means[i])**2,0)/train.length);return v>1e-10?v:1});
 const xtrain=train.map(r=>[1,...r.x.map((x,i)=>(x-means[i])/scales[i])]);
 const ymean=train.reduce((s,r)=>s+r.y,0)/train.length;
 const dim=8,alpha=10;
 const gram=Array.from({length:dim},()=>Array(dim).fill(0)),rhs=Array(dim).fill(0);
 for(let k=0;k<train.length;k++)for(let i=0;i<dim;i++){rhs[i]+=xtrain[k][i]*(train[k].y-ymean);for(let j=0;j<dim;j++)gram[i][j]+=xtrain[k][i]*xtrain[k][j]}
 for(let i=1;i<dim;i++)gram[i][i]+=alpha;gram[0][0]+=1e-7;
 const coeff=solve(gram,rhs),intercept=ymean+coeff[0];
 const predictions=test.map(r=>Math.max(0,intercept+coeff.slice(1).reduce((s,c,i)=>s+c*(r.x[i]-means[i])/scales[i],0)));
 const actual=test.map(r=>r.y),baseline=test.map(r=>r.x[2]),error=mae(actual,predictions),base=mae(actual,baseline);
 const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(text));const sha256=Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,"0")).join("");
 const passed=error<base;
 const report={status:passed?"RESEARCH_MODEL_CANDIDATE":"REJECTED_BASELINE_NOT_BEATEN",rows:entries.length,parts:parts.length,profile:profiles[0],training_rows:train.length,holdout_rows:test.length,holdout_parts:holdoutParts.size,mae_mm3:error,baseline_proxy_mae_mm3:base,dataset_sha256:sha256,warning:"Unverified provenance. Uploader must demonstrate actual slicer measurements. This client-side fit is exploratory, not a server-deployed trained model."};
 const artifact=passed?{schema:"orientation-support-surrogate/v1",status:"RESEARCH_ONLY_NOT_QUALIFIED",version:"local-"+sha256.slice(0,12),profile_id:profiles[0],features:[...FEATURES],scaler_mean:means,scaler_scale:scales,coefficients:coeff.slice(1),intercept,training:report,limitations:["Unverified uploaded label provenance","Unseen-part holdout only; no independent external validation","Not qualified for aerospace manufacturing decisions"]}:null;
 return{report,artifact};
}
