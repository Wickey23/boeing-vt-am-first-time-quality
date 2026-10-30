# Configure Virginia Tech ARC for ORIENTAI engineering copilot

**Provider:** Virginia Tech ARC's hosted language models. Official docs: https://docs.arc.vt.edu/ai/011_llm_api_arc_vt_edu.html

**Important distinction:**
- **Web login and API-key creation:** https://llm.arc.vt.edu/
- **Chat-completions API:** `https://llm-api.arc.vt.edu/api/v1/chat/completions` (OpenAI-compatible, Bearer auth)
- **Do not put the secret inside a chat message, frontend settings, GitHub source, NEXT_PUBLIC_ variable, issue, screenshot or client bundle.**

## 1. Create a personal API key

1. Sign in to https://llm.arc.vt.edu/ with your VT identity.
2. Open user profile > Settings > Account > API keys.
3. Create a key and store it in an approved password manager; copy it into your private local environment or Vercel project secrets.
4. ARC explicitly prohibits sharing personal API keys. A team/public deployment must use a separately ARC-approved arrangement; do **not** put your personal key behind a public endpoint for other people to use without authorization.

## 2. Local development

Copy `.env.example` to `.env.local` and set:

```dotenv
AI_COPILOT_ENABLED=true
ARC_API_KEY=<YOUR_PRIVATE_VT_ARC_KEY>
ARC_API_BASE_URL=https://llm-api.arc.vt.edu/api/v1
ARC_MODEL=gpt-oss-120b
```

Start with `npm run dev`. The chosen model is a documented ARC model; model availability may change. You can switch to a documented supported model such as `DeepSeek-V4.1-Flash` or `GLM-5.3` when suitable.

The backend selector in `lib/ai-provider.ts` pins the API to ARC's official host. When `ARC_API_KEY` is set, ARC is chosen over the optional existing Vercel AI Gateway.

## 3. Private Vercel deployment

Open the correct Vercel **project** for ORIENTAI > **Settings** > **Environment Variables**. Add:
- `AI_COPILOT_ENABLED` = `true`
- `ARC_API_KEY` = your private key (mark as Sensitive if supported)
- `ARC_API_BASE_URL` = `https://llm-api.arc.vt.edu/api/v1`
- `ARC_MODEL` = `gpt-oss-120b`

Choose only environments authorized for your personal use and **redeploy** to apply changes. Do not put the key in GitHub Actions or public previews merely to make demonstrations work.

**Security and data restriction:** ARC says its service is hosted on university infrastructure, and requests are logged and retained under university policies. That does not establish approval to send Boeing/export-controlled/ITAR/DFARS data. Confirm applicable approval with VT and sponsor officials before exposing any restricted geometry, drawings, technical descriptions or attachments.

## 4. What the current software actually connects

- `app/api/engineering-copilot/route.ts` uses ARC or the preexisting Vercel provider **only when** `AI_COPILOT_ENABLED=true`, with a configured server-side key and an explicit `allowExternal=true` payload.
- `components/EngineeringCopilot.tsx` exposes an **explicit user authorization** checkbox and an `Ask AI about approved context` control in the advanced/copilot workspace. It supplies reviewed notes and document excerpts; the STL binary is not transmitted.
- **The main `/copilot` chat (`components/v2/ChatStudy.tsx`) uses the local guide by default and can call ARC only when the engineer enables explicit external AI consent.** ARC does not execute solvers or directly inspect STL triangles.
- For ARC the current adapter accepts text and reviewed excerpts, not direct PDFs. ARC separately documents a file upload/RAG API but that is not implemented here. Do not assume browser PDFs are automatically sent to ARC.
- The route has a 23-second upstream timeout and Vercel runtime maxDuration of 30 seconds. ARC queues may exceed this; production-grade longer jobs need streaming or a durable queue. HTTP 429/503 responses do not prove invalid keys.
- For authorization/use, there is a process-local soft request budget; **it is not a user authentication system**, abuse protection or a compliant shared-organization service. Do not use the current prototype as a publicly available shared ARC proxy.

## 5. Verify without leaking secrets

1. Locally, `GET /api/engineering-copilot` should return `{"enabled":true,"requiresApproval":true}` after configuration. It never returns the key or model endpoint.
2. In the advanced copilot, approve only non-controlled test text and select **Ask AI about approved context**. Expect a plain-text answer; no actual simulation is run by the language model.
3. Validate returned reasoning against project sources and separately executed engineering worker results.
4. Run `npm test`, `npm run typecheck`, `npm run build`, and browser checks; provider-selection tests are `tests/ai-provider.test.ts`.
5. Only claim deployed ARC connectivity after a real authenticated test using a privately configured key; never include the secret or request logs with sensitive content in an issue.

**References:** https://docs.arc.vt.edu/ai/011_llm_api_arc_vt_edu.html and https://docs.arc.vt.edu/ai/010_llm_arc_vt_edu.html.

## 6. ARC notebook compatibility / 401 troubleshooting

The VT Elicitron classroom notebook uses the same `POST /api/v1/chat/completions` endpoint, JSON `model` and `messages` fields, and `Authorization: Bearer <key>` header as ORIENTAI. Its example sets `DeepSeek-V4.1-Flash-thinking-low`, while ORIENTAI defaults to the documented `gpt-oss-120b`; this model choice alone does not explain HTTP 401/403. Model availability changes. **Only change `ARC_MODEL` to one confirmed available in ARC's current documentation or model list.**

A classroom notebook sets `API_KEY = "paste-your-key-here"` as a Python string. **Vercel's `ARC_API_KEY` must contain the actual secret, not the variable assignment, sample placeholder, copied `Bearer` header, or notebook source code.** The server adapter tolerates a single surrounding pair of Python-style quotes and an accidental `Bearer ` prefix; it refuses documented placeholder values. These protections do not make an invalid or revoked token valid.

ARC upstream responses are now distinguished: HTTP **401** = credential rejection; **403** = access denied; **404** = model or endpoint not found; **429/503** = capacity/queue problem. The UI never displays the upstream response body or secret. Vercel's public GET capability check reports only configuration presence, **not** whether ARC accepts the key.

The Elicitron notebook retries transient connection failures up to five times and waits as long as 900 seconds. The ORIENTAI serverless chat route has a 23-second upstream timeout and no durable queue. To support long ARC model queues in a future milestone, implement streamed responses or a durable background job instead of copying the notebook's long blocking timeout into Vercel.
