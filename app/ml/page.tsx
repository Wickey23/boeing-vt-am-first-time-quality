"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import AppShell from "@/components/v2/AppShell";
export default function MachineLearning(){const[model,setModel]=useState<any>(null);
 useEffect(()=>{fetch("/api/ml/predict").then(r=>r.json()).then(setModel).catch(()=>setModel({ready:false}))},[]);
 return <AppShell title="Machine Learning Lab"><div className="screenGrid"><section className="lightPanel">
 <h2>Train the Orientation Model</h2>
 <p>Train a supervised surrogate using measured slicer support volumes. Each training record represents one part, manufacturing profile and build orientation.</p>
 <h3>1. Collect labeled examples</h3><p className="subtle">Use the <Link href="/orientation">Orientation Workbench</Link> to export orientation candidates. Run each selected orientation through the same authorized slicer configuration and record the actual slicer-reported support volume, along with part and process profile IDs.</p>
 <a href="/ml/DATASET_TEMPLATE.csv" download>Download training CSV template</a>
 <h3>2. Train and evaluate</h3><pre style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere",padding:12,background:"#eef2f7",color:"#12233d",borderRadius:8}}>pip install -r ml/requirements.txt{"\n"}python ml/train.py --csv your_measurements.csv</pre>
 <p className="subtle">Training splits by part, holds out unseen components, and refuses to export a model unless it outperforms the geometric baseline on held-out examples.</p>
 <h3>3. Review and release</h3><p className="subtle">Review the evaluation evidence and commit only an approved research model JSON artifact to <code>ml/models/support-model.json</code>. Deployment alone is not qualification approval.</p>
 </section><section className="lightPanel"><h2>Model Registry</h2>
 {model===null?<p>Checking model status…</p>:model.ready?<><p><b>Research model available</b></p><p>Version: {model.version}</p><p>Profile: {model.profileId}</p><p>Holdout MAE: {model.holdout?.mae_mm3?.toFixed?.(2)} mm³</p><p className="subtle">Unqualified research prediction only. Never override hard feasibility constraints.</p></>:<div className="emptyState"><b>No trained model released</b><span>ML predictions are disabled until real labeled measurements and a validated model artifact are available.</span></div>}
 <h3>Trainable output</h3><p>Predicted slicer support volume, with model version, holdout accuracy, and process-profile match checks.</p>
 <h3>Next expansion</h3><p className="subtle">Add active-learning sample selection, distortion surrogate training, uncertainty intervals and comparison against physical print measurements.</p></section></div></AppShell>
}
