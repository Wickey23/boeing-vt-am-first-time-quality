/** Part/build-specific engineering test feedback; manual, traceable, never model training. */
export const FEEDBACK_VERSION="orientai.feedback.v1" as const;
export type FeedbackOutcome="observed"|"not-observed"|"inconclusive";
export type InspectionFeedback={
 schema:typeof FEEDBACK_VERSION;id:string;partHash:string;buildId:string;
 sourceReference:string;testMethod:string;findingId:string|null;
 outcome:FeedbackOutcome;observation:string;reviewedBy:string;
 submittedAt:string;userReviewedSource:true;
};
export type FeedbackDraft={
 buildId:string;sourceReference:string;testMethod:string;findingId:string|null;
 outcome:FeedbackOutcome;observation:string;reviewedBy:string;userReviewedSource:boolean;
};
export function blankFeedbackDraft():FeedbackDraft{return {
 buildId:"",sourceReference:"",testMethod:"",findingId:null,outcome:"inconclusive",
 observation:"",reviewedBy:"",userReviewedSource:false
};}
export function recordInspectionFeedback(partHash:string,d:FeedbackDraft,existing:InspectionFeedback[],now=new Date().toISOString()):InspectionFeedback{
 const clean=(v:string,max:number)=>v.trim().slice(0,max);
 if(!/^[a-f0-9]{64}$/i.test(partHash))throw Error("A current part fingerprint is required.");
 if(existing.length>=30)throw Error("Maximum 30 local inspection feedback records.");
 if(!d.userReviewedSource)throw Error("Confirm that you reviewed the source of this test observation.");
 if(!["observed","not-observed","inconclusive"].includes(d.outcome))
  throw Error("Invalid inspection observation status.");
 const buildId=clean(d.buildId,90),sourceReference=clean(d.sourceReference,150),
  testMethod=clean(d.testMethod,130),observation=clean(d.observation,1700),
  reviewedBy=clean(d.reviewedBy,90);
 if(buildId.length<3||sourceReference.length<3||testMethod.length<4||
  observation.length<16||reviewedBy.length<2)
  throw Error("Provide a build ID, source/revision, test method, observation (16+ characters), and reviewer.");
 if(!Number.isFinite(Date.parse(now)))throw Error("Invalid review timestamp.");
 const id="F"+String(1+Math.max(0,...existing.map(x=>Number(x.id.replace(/^F/,""))||0)));
 return {
  schema:FEEDBACK_VERSION,id,partHash,buildId,sourceReference,testMethod,
  findingId:d.findingId?.slice(0,140)??null,outcome:d.outcome,observation,
  reviewedBy,submittedAt:now,userReviewedSource:true
 };
}
export function restoreInspectionFeedback(raw:unknown,partHash:string):InspectionFeedback[]{
 if(!Array.isArray(raw)||!/^[a-f0-9]{64}$/i.test(partHash))return [];
 const seen=new Set<string>(),out:InspectionFeedback[]=[];
 for(const item of raw){
  if(!item||typeof item!=="object")continue;
  const x=item as Partial<InspectionFeedback>;
  if(x.schema!==FEEDBACK_VERSION||x.partHash!==partHash||
   typeof x.id!=="string"||seen.has(x.id)||
   typeof x.buildId!=="string"||typeof x.sourceReference!=="string"||
   typeof x.testMethod!=="string"||typeof x.observation!=="string"||
   typeof x.reviewedBy!=="string"||typeof x.submittedAt!=="string"||
   !["observed","not-observed","inconclusive"].includes(x.outcome??"")||
   x.userReviewedSource!==true)continue;
  seen.add(x.id);out.push(x as InspectionFeedback);
  if(out.length>=30)break;
 }
 return out;
}
export function feedbackOverview(items:InspectionFeedback[],findingIds:string[]){
 const relevant=items.filter(x=>x.findingId&&findingIds.includes(x.findingId));
 return {records:items.length,linked:relevant.length,
  observed:relevant.filter(x=>x.outcome==="observed").length,
  notObserved:relevant.filter(x=>x.outcome==="not-observed").length,
  inconclusive:relevant.filter(x=>x.outcome==="inconclusive").length,
  caveat:"User-reviewed source entries are not independently validated by ORIENTAI; no sensitivity, specificity, failure rate or model qualification is calculated."};
}
