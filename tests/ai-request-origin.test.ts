import {test} from "node:test";
import assert from "node:assert/strict";
import {isAllowedAiRequestOrigin} from "../lib/ai-request-origin";

const url="https://boeing-vt-am-first-time-quality.vercel.app/api/engineering-copilot";
const request=(headers:Record<string,string>)=>new Request(url,{method:"POST",headers});

test("same-origin ARC browser calls are accepted",()=>{
 assert.equal(isAllowedAiRequestOrigin(request({origin:"https://boeing-vt-am-first-time-quality.vercel.app","sec-fetch-site":"same-origin"})),true);
 assert.equal(isAllowedAiRequestOrigin(request({"sec-fetch-site":"same-origin"})),true);
});
test("foreign and opaque browser origins cannot consume ARC quota",()=>{
 assert.equal(isAllowedAiRequestOrigin(request({origin:"https://evil.example","sec-fetch-site":"cross-site"})),false);
 assert.equal(isAllowedAiRequestOrigin(request({origin:"null"})),false);
 assert.equal(isAllowedAiRequestOrigin(request({origin:"https://boeing-vt-am-first-time-quality.vercel.app:443","sec-fetch-site":"cross-site"})),false);
 assert.equal(isAllowedAiRequestOrigin(request({origin:"https://attacker.vercel.app"})),false);
});
test("missing Origin is not authentication; only same-origin browser CSRF is mitigated",()=>{
 assert.equal(isAllowedAiRequestOrigin(request({})),true);
});
