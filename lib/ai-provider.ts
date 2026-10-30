/**
 * Server-only model endpoint selection for the consent-gated interview API.
 * ARC_API_KEY takes precedence when configured. Never pass secrets to the
 * browser, expose them in GET results, or use NEXT_PUBLIC_ keys.
 */
export type CopilotProvider={
 kind:"arc"|"gateway";
 endpoint:string;
 model:string;
 key:string;
};
const ARC_BASE="https://llm-api.arc.vt.edu/api/v1";
export function copilotProvider(env:Record<string,string|undefined>):CopilotProvider|null{
 // Vercel expects a raw token; copying a notebook's quoted Python value or
 // an entire Authorization header otherwise produces a misleading 401.
 // Normalize only common surrounding syntax, never log the secret.
 let arcKey=env.ARC_API_KEY?.trim();
 if(arcKey?.startsWith("Bearer "))arcKey=arcKey.slice(7).trim();
 if(arcKey&&arcKey.length>=2&&((arcKey[0]==='"'&&arcKey.at(-1)==='"')||(arcKey[0]==="'"&&arcKey.at(-1)==="'")))
  arcKey=arcKey.slice(1,-1).trim();
 if(arcKey?.startsWith("Bearer "))arcKey=arcKey.slice(7).trim();
 if(arcKey&&/^(paste-your-key-here|sk-YOUR-API-KEY|YOUR_ARC_API_KEY_HERE|YOUR_PRIVATE_VT_ARC_KEY|<YOUR_PRIVATE_VT_ARC_KEY>)$/i.test(arcKey))
  throw Error("ARC_API_KEY is a placeholder, not a real token.");
 if(arcKey){
  const base=(env.ARC_API_BASE_URL||ARC_BASE).replace(/\/+$/,"");
  // ARC's documented hosted endpoint is pinned; do not accidentally transmit
  // University/project material to an arbitrary environment-supplied host.
  if(base!==ARC_BASE)throw Error("ARC_API_BASE_URL must be the official VT ARC hosted API base URL.");
  const model=(env.ARC_MODEL||"gpt-oss-120b").trim();
  if(!/^[a-zA-Z0-9._/-]{1,96}$/.test(model))throw Error("Invalid ARC_MODEL.");
  return {kind:"arc",endpoint:base+"/chat/completions",model,key:arcKey};
 }
 const key=(env.AI_GATEWAY_API_KEY||env.VERCEL_OIDC_TOKEN)?.trim();
 if(!key)return null;
 return {kind:"gateway",endpoint:"https://ai-gateway.vercel.sh/v1/chat/completions",
  model:env.AI_GATEWAY_MODEL||"openai/gpt-6-luna",key};
}
