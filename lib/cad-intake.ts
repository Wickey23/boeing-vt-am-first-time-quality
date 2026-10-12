export type CadFormat = "STL" | "STEP" | "3MF" | "UNKNOWN";
export type CadSupport = "inspectable" | "planned" | "unsupported";
export type CadDescriptor = { format:CadFormat; support:CadSupport; reason:string };
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
export function describeCadFile(name:string):CadDescriptor {
 const ext=name.toLowerCase().split(".").pop();
 if(ext==="stl") return {format:"STL",support:"inspectable",reason:"Triangle-mesh geometry can be inspected. STL has no embedded units."};
 if(ext==="step"||ext==="stp") return {format:"STEP",support:"planned",reason:"Native BREP parsing requires a CAD kernel worker. It is not available in this release."};
 if(ext==="3mf") return {format:"3MF",support:"planned",reason:"3MF parsing is not yet implemented in this release."};
 return {format:"UNKNOWN",support:"unsupported",reason:"Upload a supported STL mesh, or choose STEP/3MF to view the planned format requirements."};
}
export function validateCadFile(file:Pick<File,"name"|"size">):string | null {
 if(!file.name || file.name.length>255) return "Invalid file name.";
 if(file.size===0) return "The selected file is empty.";
 if(file.size>MAX_UPLOAD_BYTES) return "This research release limits files to 25 MB.";
 const d=describeCadFile(file.name);
 if(d.support==="unsupported") return "Unsupported file extension.";
 return null;
}
export async function sha256(buffer:ArrayBuffer):Promise<string>{
 const digest=await crypto.subtle.digest("SHA-256",buffer);
 return Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,"0")).join("");
}
