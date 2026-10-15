export type SupportModel={
 schema:string;status:string;version:string;profile_id:string;features:string[];
 scaler_mean:number[];scaler_scale:number[];coefficients:number[];intercept:number;
 training:{mae_mm3:number;baseline_proxy_mae_mm3:number;holdout_parts:number;dataset_sha256:string};
};
export type Features=Record<string,number>;
export function predictSupport(model:SupportModel,features:Features,profileId:string){
 if(model.schema!=="orientation-support-surrogate/v1"||model.status!=="RESEARCH_ONLY_NOT_QUALIFIED")throw new Error("Unsupported model artifact");
 if(model.profile_id!==profileId)throw new Error("Manufacturing process profile does not match trained model");
 if(model.features.length!==model.coefficients.length||model.features.length!==model.scaler_mean.length||model.features.length!==model.scaler_scale.length)throw new Error("Invalid artifact dimensionality");
 let prediction=model.intercept;
 for(let i=0;i<model.features.length;i++){
  const n=features[model.features[i]],scale=model.scaler_scale[i];
  if(!Number.isFinite(n)||!Number.isFinite(scale)||scale<=0)throw new Error("Invalid model features or scaling");
  prediction+=model.coefficients[i]*(n-model.scaler_mean[i])/scale;
 }
 if(!Number.isFinite(prediction))throw new Error("Non-finite ML prediction");
 return{predictedSupportVolumeMm3:Math.max(0,prediction),modelVersion:model.version,profileId,qualification:"RESEARCH_ONLY_NOT_QUALIFIED",holdoutMAEMm3:model.training.mae_mm3};
}
