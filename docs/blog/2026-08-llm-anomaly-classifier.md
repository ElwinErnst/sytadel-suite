# Using Claude to review your session anomalies — with actual eval metrics

Rule-based anomaly detection has a boring failure mode: **alert fatigue**. Every new IP + new country flag looks the same. A user coming back from a Tokyo business trip and an actual account takeover from Vladivostok generate identical events. The person on-call learns to ignore both.

An LLM doesn't replace the rules — it *ranks* what the rules already found. Same events, but with a verdict (`legitimate` / `suspicious` / `critical`), a confidence score, a rationale, and a recommended action (`allow` / `step_up_auth` / `alert` / `block`). The on-call sees the 3 criticals that matter instead of 300 warnings.

This post shows the full pipeline running in production against a NestJS auth service — Claude Sonnet 5 wired as an async classifier — plus the real eval numbers I captured on a 23-case fixture set:

- **Accuracy: 95.7%** (22/23)
- **Critical class: precision 1.00, recall 1.00** (zero false positives, zero missed criticals)
- **Cost: $0.00506 per analysis** (~200 classifications per dollar)
- **Latency: p50 4s, p95 8.7s** — off the login path, so users don't feel it

Full code: [ElwinErnst/auth-api](https://github.com/ElwinErnst/auth-api), module `session-anomaly`.

---

## The pipeline (why async matters)

Rules run synchronously on every login. LLM classification is added as an event listener that runs *after* the login response is already sent to the user:

```
login request
   ↓
auth.service.login (verify password / passkey)
   ↓
create Session
   ↓
sessionAnomalyService.analyze() ← rules run here (~ms)
   ↓
if severity !== 'info':
   ↓
     persist SessionAnomalyEvent
     emit ANOMALY_PERSISTED_EVENT ── ─ ─ ─ ─ ─ ─ ─ ┐
   ↓                                              │
generate tokens + respond 201 to caller           │
                                                  ↓
                                        (event handler, async)
                                                  ↓
                                        classifier.classifyPersisted()
                                                  ↓
                                        create classification (pending)
                                                  ↓
                                        Claude API (~4s)
                                                  ↓
                                        update classification (classified)
```

Three consequences of this design:

1. **Login latency is unchanged.** The rules add microseconds; the LLM never touches the login path.
2. **Classifier failures are safe.** If Claude times out, returns garbage, or the API key expires, the login already succeeded. The classification row stays `pending`/`failed` and a background job can retry later. Authentication is never blocked on the classifier.
3. **Classification arrives seconds after the login.** The user is already in the app; a dashboard, an alert channel, or a step-up-MFA prompt can react to the verdict without holding the login itself hostage.

The event contract is a small struct:

```typescript
export const ANOMALY_PERSISTED_EVENT = 'session-anomaly.persisted';

export type AnomalyHistorySummary = {
  total: number;
  distinctIps: number;
  distinctCountries: number;
  distinctUserAgents: number;
};

export type AnomalyPersistedEvent = {
  eventId: string;
  history: AnomalyHistorySummary;
};
```

The listener consumes it with NestJS's `@OnEvent` and forwards to the classifier — no other coupling between the two modules.

---

## The prompt (deterministic outputs are non-negotiable)

Two decisions here separate "toy" from "engineering":

**1. Structured output via JSON schema.**

Claude's `output_config` with a schema constraint means the response is guaranteed to be valid JSON matching the shape you declared. No regex parsing, no "sometimes it wraps in markdown," no retry loops for malformed output. Set it once, forget it:

```typescript
const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['label', 'confidence', 'rationale', 'recommended_action'],
  properties: {
    label: { type: 'string', enum: ['legitimate', 'suspicious', 'critical'] },
    confidence: { type: 'number' },
    rationale: { type: 'string' },
    recommended_action: {
      type: 'string',
      enum: ['allow', 'step_up_auth', 'alert', 'block'],
    },
  },
} as const;
```

`additionalProperties: false` is mandatory — the API rejects the request otherwise with `output_config.format.schema: For 'object' type, 'additionalProperties' must be explicitly set to false`. Ask me how I found out.

**2. Disable adaptive thinking.**

Sonnet-class models run adaptive thinking by default. For a classification task with `max_tokens: 512`, thinking eats budget that should go to the actual JSON output. The response gets truncated mid-emit and parsing fails. Explicit `thinking: { type: 'disabled' }` on classification calls:

```typescript
const response = await this.client.messages.create({
  model: this.config.model,
  max_tokens: this.config.maxTokens,
  thinking: { type: 'disabled' },
  system: SYSTEM_PROMPT,
  messages: [{ role: 'user', content: userContent }],
  output_config: {
    format: { type: 'json_schema', schema: OUTPUT_SCHEMA },
  },
});
```

The system prompt is short and opinionated — no roleplay, no "you are a helpful assistant":

```
You are a security analyst classifying login anomaly events for a Zero Trust platform.
Given the signals from a rule-based anomaly detector, classify the event and recommend an action.

Labels:
- "legitimate": the anomaly is very likely benign (e.g. a user travelling, or a new device they own).
- "suspicious": the pattern is unusual and warrants extra verification but is not clearly an attack.
- "critical": the pattern strongly suggests account takeover or an active attack.

Recommended actions:
- "allow": no action needed.
- "step_up_auth": require re-verification (MFA / passkey) before continuing.
- "alert": notify the user and/or security team, but do not block.
- "block": block the session outright.

Judge only from the provided signals. Be conservative about "critical" — reserve it for strong evidence
(e.g. a new country together with a new IP and a new device, or a high score). A passkey login is stronger
evidence of legitimacy than a password login. "confidence" is your certainty in the label, from 0 to 1.
```

The user message is the JSON payload of signals + history summary. No extra prose. The model has no incentive to hallucinate anything not in the input.

---

## Evals matter more than the classifier

**Without evals, a feature with an LLM is a toy.** Anyone can wire Claude to an endpoint and demo "look, it classified my thing." That proves nothing about production behavior.

The fixture dataset (`src/modules/session-anomaly/evals/fixtures.ts`) has 25 hand-labeled cases spanning:

- Passkey login from a new IP, established user, frequent traveller → `legitimate`
- Password + new IP + new device, low prior device diversity → `suspicious`
- Password + new IP + new country + new device + high score → `critical`
- Impossible-travel patterns (login from Buenos Aires 10:00, login from Tokyo 10:05)
- First-ever login (no baseline yet)
- Passkey login from a new country (weighted less alarming — passkey binding limits phishing risk)

The eval harness (`evals/anomaly-classifier.eval.ts`) is a no-DB runner: instantiates the classifier with the config, feeds every fixture, records the label + confidence + latency + token counts, computes a confusion matrix and per-class precision/recall.

Run it with:

```bash
docker exec sentinel-suite-auth-api-1 \
  node dist/modules/session-anomaly/evals/anomaly-classifier.eval.js
```

---

## The numbers

Real run against Claude Sonnet 5, `max_tokens: 512`, `thinking: disabled`, structured output enabled:

**Confusion matrix (rows = expected, cols = predicted):**

|                | legitimate | suspicious | critical |
|----------------|-----------:|-----------:|---------:|
| **legitimate** |          7 |          1 |        0 |
| **suspicious** |          0 |          8 |        0 |
| **critical**   |          0 |          0 |        7 |

**Per-class precision / recall:**

| Class      | Precision | Recall | F1   |
|------------|----------:|-------:|-----:|
| legitimate |      1.00 |   0.88 | 0.93 |
| suspicious |      0.89 |   1.00 | 0.94 |
| critical   |      1.00 |   1.00 | 1.00 |

**Aggregate:**

| Metric              | Value                    |
|---------------------|--------------------------|
| Accuracy            | **95.7%** (22/23)        |
| Fatal errors        | 1 (network timeout)      |
| Latency p50         | 4,039 ms                 |
| Latency p95         | 8,682 ms                 |
| Avg input tokens    | 858                      |
| Avg output tokens   | 166                      |
| Total cost (23)     | $0.1164                  |
| **Cost per analysis** | **$0.00506**           |

The interesting story here is the critical class: **precision 1.00, recall 1.00**. The classifier never called `legitimate` or `suspicious` an event that should have been `critical` (no missed criticals), and never called an event `critical` that shouldn't have been (no false alarms).

That's the number that matters for alert fatigue. If you page on `critical`, you're not going to page on false positives, and you're not going to miss real attacks in the fixture set.

The 1 misclassification was a `legitimate` event predicted as `suspicious` — a fail-safe direction. It gets promoted to `step_up_auth` (require MFA) rather than blocked; the user gets a friction bump, not a lockout.

---

## The bugs I hit (worth the specifics)

**Config `additionalProperties: false` is mandatory at every schema level.**
Even for a flat schema like the one above, the API rejects any missing occurrence. Not a warning — a 400. If your schema had a nested object, both levels need the flag.

**Adaptive thinking eats your `max_tokens` budget silently.**
Without `thinking: { type: 'disabled' }`, the same 512-token budget gets split between reasoning tokens and output tokens. The model runs out mid-JSON. `stop_reason` comes back as `max_tokens`. You get a `SyntaxError: Unexpected end of JSON input` in your parser. Deceptive because it looks like your schema was wrong.

**The SDK's `timeout` respects only the initial request.**
Setting `timeout: 15000` doesn't guarantee the whole call completes in 15s if the SDK is doing retries with `maxRetries: 2`. First 15s abort, retry, second 15s abort — total wall time is up to 45s and the caller sees "Request timed out" after the last one. On flaky networks, lower `maxRetries` or handle the retry yourself if you want strict latency SLOs.

**One fixture in 25 timed out.** Not the SDK, not the config — Anthropic's edge had a transient blip. If your dependency on the classifier is a `must succeed` invariant, wrap it in a retry-with-backoff on the DB side (query rows in `pending`/`failed` status and re-classify). In this design, `failed` is fine to leave — a background job can retry later and no user ever notices.

---

## When to use LLM classification (and when not)

**Use it when:**

- You have a working rule-based detector that produces too many `warning`s for humans to triage.
- Explainability matters (the `rationale` field is a first-class output — you can show it to the on-call and to the affected user).
- You can afford ~$5 per 1,000 classifications and 3–8s of async latency per event.
- You have (or can build) an eval fixture set. Without evals, you cannot ship this with a straight face.

**Don't use it when:**

- You need synchronous decisions in the login path. Latency and cost make it infeasible.
- Your rules are already producing zero warnings — you don't have an alert fatigue problem to solve.
- You need deterministic classifications reviewable by auditors. The rules are auditable; an LLM verdict is a fuzzier signal (still auditable via the `rationale` field, but not a spec you can point at).

The pattern that stacks well: **rules for the fast path + LLM for ranking + human in the loop for critical**. Each layer does what it's good at.

---

## Source

- Classifier service: [`src/modules/session-anomaly/anomaly-classifier.service.ts`](https://github.com/ElwinErnst/auth-api/blob/main/src/modules/session-anomaly/anomaly-classifier.service.ts)
- Listener (event → classifier): [`anomaly-classifier.listener.ts`](https://github.com/ElwinErnst/auth-api/blob/main/src/modules/session-anomaly/anomaly-classifier.listener.ts)
- Persistence entity: [`entities/session-anomaly-classification.entity.ts`](https://github.com/ElwinErnst/auth-api/blob/main/src/modules/session-anomaly/entities/session-anomaly-classification.entity.ts)
- Config + defaults: [`config/anomaly-classifier.config.ts`](https://github.com/ElwinErnst/auth-api/blob/main/src/config/anomaly-classifier.config.ts)
- Eval harness: [`evals/anomaly-classifier.eval.ts`](https://github.com/ElwinErnst/auth-api/blob/main/src/modules/session-anomaly/evals/anomaly-classifier.eval.ts)
- Fixture dataset: [`evals/fixtures.ts`](https://github.com/ElwinErnst/auth-api/blob/main/src/modules/session-anomaly/evals/fixtures.ts)
- Full stack (runnable locally): [ElwinErnst/sentinel-suite](https://github.com/ElwinErnst/sentinel-suite)

If you build something similar or spot a hole in the design — the fixture set could use more first-login and passkey cases — drop it in the [repo issues](https://github.com/ElwinErnst/sentinel-suite/issues). Follow-up post will be about extracting classification confidence into a step-up-MFA UX.
