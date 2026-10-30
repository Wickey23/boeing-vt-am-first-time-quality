/** ARC/OpenAI-compatible upstream failures. Never expose upstream bodies or credentials. */
export function describeModelHttpFailure(status:number,provider:"arc"|"gateway"):string{
 if(provider==="arc"){
  switch(status){
   case 401:return "VT ARC rejected the API key (HTTP 401). In Vercel Production, set ARC_API_KEY to a valid key from llm.arc.vt.edu, then redeploy. Paste only the key, not Python quotes.";
   case 403:return "VT ARC denied access (HTTP 403). Check that the ARC account and API key are permitted to use the service; ask VT ARC support if a new key still receives 403.";
   case 404:return "VT ARC could not find the selected model or endpoint (HTTP 404). Verify ARC_MODEL against ARC's current model list; the official chat endpoint is /api/v1/chat/completions.";
   case 400:return "VT ARC rejected this model request (HTTP 400). Check that ARC_MODEL supports chat completions and the request parameters.";
   case 429:return "VT ARC is rate limiting or at concurrency capacity (HTTP 429). Retry after capacity becomes available; no solver ran.";
   case 503:return "VT ARC's model is unavailable or its queue timed out (HTTP 503). Retry later; no solver ran.";
   default:return "VT ARC model request failed (HTTP "+status+"). The local engineering guide remains available.";
  }
 }
 if(status===401||status===403)return "The configured AI Gateway denied the server request (HTTP "+status+"). Verify its server-side authorization.";
 if(status===429||status===503)return "The configured AI Gateway is busy (HTTP "+status+"). Try again later; no solver ran.";
 return "AI model request failed (HTTP "+status+"). The local engineering guide remains available.";
}
