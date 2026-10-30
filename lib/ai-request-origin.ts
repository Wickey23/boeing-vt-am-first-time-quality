/**
 * Reject browser requests originating from other sites before spending
 * university model quota. This is CSRF protection, NOT authentication:
 * non-browser HTTP clients can forge or omit Origin.
 */
export function isAllowedAiRequestOrigin(request:Request):boolean{
 const origin=request.headers.get("origin");
 const fetchSite=request.headers.get("sec-fetch-site");
 if(fetchSite==="cross-site")return false;
 if(!origin)return fetchSite!=="cross-site";
 if(origin==="null")return false;
 try{
  const from=new URL(origin);
  const target=new URL(request.url);
  return from.protocol===target.protocol&&from.host===target.host;
 }catch{return false;}
}
