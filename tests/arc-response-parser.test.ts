import {test} from "node:test";
import assert from "node:assert/strict";
import {visibleCopilotAnswer} from "../lib/arc-response-parser";

test("ARC responses show only final output when thinking tags appear",()=>{
 assert.equal(visibleCopilotAnswer("<think>internal reasoning</think>Answer"),"Answer");
 assert.equal(visibleCopilotAnswer(" <THINK>hidden\nsteps</THINK> Answer. "),"Answer.");
});
test("ARC supports text and OpenAI content-part responses",()=>{
 assert.equal(visibleCopilotAnswer([{type:"text",text:"Hello"},{type:"image",url:"x"},{type:"text",text:"world"}]),"Hello\nworld");
 assert.equal(visibleCopilotAnswer(null),"");
});
