import {test} from "node:test";
import assert from "node:assert/strict";
import {describeModelHttpFailure} from "../lib/arc-http-errors";

test("ARC 401 distinguishes invalid key from 403 entitlement and 404 unknown model",()=>{
 assert.match(describeModelHttpFailure(401,"arc"),/rejected the API key.*401/);
 assert.match(describeModelHttpFailure(403,"arc"),/denied access.*403/);
 assert.match(describeModelHttpFailure(404,"arc"),/selected model or endpoint.*404/);
});
test("ARC capacity errors never imply invalid API credentials",()=>{
 assert.match(describeModelHttpFailure(429,"arc"),/rate limiting/);
 assert.match(describeModelHttpFailure(503,"arc"),/queue timed out/);
 assert.doesNotMatch(describeModelHttpFailure(429,"arc"),/API key/);
});
test("gateway failures stay provider-specific",()=>{
 assert.match(describeModelHttpFailure(403,"gateway"),/AI Gateway/);
 assert.doesNotMatch(describeModelHttpFailure(403,"gateway"),/VT ARC/);
});
