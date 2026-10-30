/** Extract user-visible ARC/OpenAI-compatible text without exposing thinking tags. */
export function visibleCopilotAnswer(answer:unknown):string{
 const raw=typeof answer==="string"?answer:
  Array.isArray(answer)?answer.filter((x):x is {type:"text";text:string}=>
   Boolean(x&&typeof x==="object"&&x.type==="text"&&typeof x.text==="string"))
   .map(x=>x.text).join("\n"):"";
 // Some hosted thinking-model variants include textual <think> sections;
 // retain only the final answer, as in VT's Elicitron example notebook.
 return raw.replace(/<think>[\s\S]*?<\/think>/gi,"").replace(/<think>[\s\S]*$/gi,"").trim();
}
