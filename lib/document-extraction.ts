/** Extract plain, source-addressable text locally from selected Office Open XML formats.
 * No CAD geometry, PDF raster OCR, or drawing interpretation is performed.
 * Strict zip-bomb bounds protect the main thread from oversized archive XML.
 */
import {unzipSync} from "fflate";
const MAX_XML_BYTES=5_000_000;
const decode=(input:string)=>input.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|apos|quot);/gi,(_,code:string)=>{
 if(code.startsWith("#")){const cp=code.toLowerCase().startsWith("#x")?parseInt(code.slice(2),16):parseInt(code.slice(1),10);return cp>0&&cp<=0x10ffff?String.fromCodePoint(cp):" ";}
 return ({amp:"&",lt:"<",gt:">",apos:"'",quot:'"'} as Record<string,string>)[code.toLowerCase()]??" ";
});
const strip=(xml:string)=>decode(xml.replace(/<(?:w:tab|text:tab)\b[^>]*\/>/gi," ").replace(/<(?:w:br|text:line-break)\b[^>]*\/>/gi,"\n").replace(/<[^>]+>/g," ")).replace(/[ \t]+/g," ").trim();
const xmlText=(arr:Uint8Array)=>new TextDecoder("utf-8",{fatal:true}).decode(arr);
function safelyReadArchive(bytes:Uint8Array,names:string[]):Record<string,string>{
 if(bytes.length>3*1024*1024)throw Error("Reference archive exceeds 3 MB.");
 const allowed=new Set(names);
 const entries=unzipSync(bytes,{filter:f=>allowed.has(f.name)&&f.originalSize<=MAX_XML_BYTES});
 const out:Record<string,string>={};
 for(const [name,data] of Object.entries(entries)){
  if(data.length>MAX_XML_BYTES)throw Error("Decompressed document content exceeds 5 MB.");
  out[name]=xmlText(data);
 }
 return out;
}
export function extractDocx(bytes:Uint8Array):string{
 const files=safelyReadArchive(bytes,["word/document.xml"]);
 const xml=files["word/document.xml"];
 if(!xml)throw Error("DOCX archive has no main document XML.");
 const paras=[...xml.matchAll(/<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/g)];
 const lines=paras.map((p,i)=>{
   const runs=[...p[1].matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map(t=>decode(t[1])).join("");
   return runs.trim()?("P"+(i+1)+": "+runs.trim()):null;
 }).filter((s):s is string=>s!==null);
 if(!lines.length)throw Error("DOCX contains no extractable paragraphs. A scanned drawing cannot be read as text.");
 return lines.join("\n").slice(0,30000);
}
function attr(xml:string,name:string):string|undefined{
 return xml.match(new RegExp(name+'="([^"]+)"'))?.[1];
}
export function extractXlsx(bytes:Uint8Array):string{
 const files=safelyReadArchive(bytes,["xl/sharedStrings.xml","xl/worksheets/sheet1.xml"]);
 const sheet=files["xl/worksheets/sheet1.xml"];
 if(!sheet)throw Error("No first worksheet XML found; this local extraction supports the first worksheet only.");
 const strings=(files["xl/sharedStrings.xml"]?.match(/<si(?:\s[^>]*)?>[\s\S]*?<\/si>/g)??[]).map(si=>
  [...si.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(t=>decode(t[1])).join("")
 );
 const lines:string[]=[];
 for(const row of sheet.matchAll(/<row(?:\s[^>]*)?>([\s\S]*?)<\/row>/g)){
  const rn=attr(row[0],"r")??String(lines.length+1);
  const cells:string[]=[];
  for(const cell of row[1].matchAll(/<c(\s[^>]*)?>([\s\S]*?)<\/c>/g)){
   const ref=attr(cell[1]??"","r")??"?";
   const type=attr(cell[1]??"","t");
   const v=cell[2].match(/<v>([\s\S]*?)<\/v>/)?.[1]??"";
   const inline=[...cell[2].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(t=>decode(t[1])).join("");
   const value=type==="s"?strings[Number(v)]??"":inline||decode(v);
   if(value.trim())cells.push(ref+"="+value.slice(0,350));
  }
  if(cells.length)lines.push("Row "+rn+": "+cells.join(" | "));
 }
 if(!lines.length)throw Error("First worksheet contains no extractable cell values.");
 return lines.join("\n").slice(0,30000);
}
export async function extractLocalDocument(file:File):Promise<string>{
 const ext=file.name.split(".").pop()?.toLowerCase();
 if(ext==="docx")return extractDocx(new Uint8Array(await file.arrayBuffer()));
 if(ext==="xlsx")return extractXlsx(new Uint8Array(await file.arrayBuffer()));
 throw Error("This local extractor supports DOCX and XLSX only.");
}
