import {test} from "node:test";
import assert from "node:assert/strict";
import {copilotProvider} from "../lib/ai-provider";

test("VT ARC provider uses only official host and stays on the server",()=>{
 const p=copilotProvider({
  ARC_API_KEY:"sk-test-arc-secret",
  ARC_API_BASE_URL:"https://llm-api.arc.vt.edu/api/v1/",
  ARC_MODEL:"gpt-oss-120b",
  AI_GATEWAY_API_KEY:"gateway-other"
 });
 assert.equal(p?.kind,"arc");
 assert.equal(p?.model,"gpt-oss-120b");
 assert.equal(p?.endpoint,"https://llm-api.arc.vt.edu/api/v1/chat/completions");
 assert.equal(p?.key,"sk-test-arc-secret");
});
test("ARC key takes precedence but a blank key falls back to existing gateway",()=>{
 const p=copilotProvider({
  ARC_API_KEY:" ",
  AI_GATEWAY_API_KEY:"gateway-test",
  AI_GATEWAY_MODEL:"openai/example"
 });
 assert.equal(p?.kind,"gateway");
 assert.equal(p?.model,"openai/example");
 assert.equal(p?.endpoint,"https://ai-gateway.vercel.sh/v1/chat/completions");
});
test("missing providers return null instead of enabling outbound AI",()=>{
 assert.equal(copilotProvider({}),null);
 assert.equal(copilotProvider({ARC_API_KEY:" ",AI_GATEWAY_API_KEY:" "}),null);
});
test("ARC destination cannot be redirected to a nonofficial host",()=>{
 assert.throws(()=>copilotProvider({ARC_API_KEY:"test",ARC_API_BASE_URL:"https://my-fake-endpoint.example/api/v1"}),/official VT ARC/);
 assert.throws(()=>copilotProvider({ARC_API_KEY:"test",ARC_API_BASE_URL:"http://llm-api.arc.vt.edu/api/v1"}),/official VT ARC/);
 assert.throws(()=>copilotProvider({ARC_API_KEY:"test",ARC_MODEL:"../../bad config"}),/Invalid ARC_MODEL/);
});

test("notebook-style ARC keys normalize without exposing the token",()=>{
 const p=copilotProvider({ARC_API_KEY:'  "sk-notebook-test"  '});
 assert.equal(p?.kind,"arc");
 assert.equal(p?.key,"sk-notebook-test");
 const copiedHeader=copilotProvider({ARC_API_KEY:"Bearer sk-header-test"});
 assert.equal(copiedHeader?.key,"sk-header-test");
 const quotedHeader=copilotProvider({ARC_API_KEY:"'Bearer sk-header-test'"});
 assert.equal(quotedHeader?.key,"sk-header-test");
});
test("ARC notebook placeholders are invalid credentials, not enabled providers",()=>{
 assert.throws(()=>copilotProvider({ARC_API_KEY:"paste-your-key-here"}),/placeholder/);
 assert.throws(()=>copilotProvider({ARC_API_KEY:'"sk-YOUR-API-KEY"'}),/placeholder/);
});
