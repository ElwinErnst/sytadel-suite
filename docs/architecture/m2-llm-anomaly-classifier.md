# M2 — LLM Anomaly Classifier (Design)

Status: **Draft / for review**
Scope: First feature of Milestone M2 (AI-powered security layer).
Owner service: `auth-api` (submodule) — where `session-anomaly` already lives.

---

## 1. Goal

When the existing rule-based engine detects a session anomaly (`severity != info`),
an out-of-band LLM classifier labels the event as **legitimate / suspicious / critical**,
with a short rationale and a recommended action. Classification is produced with
Claude using **structured output** (guaranteed enum), stored alongside the event,
and reported with precision/recall metrics from an eval harness.

Non-goals for this slice: the NL→RBAC policy generator and the AI-driven access
review (later M2 features).

---

## 2. Hard architectural constraint

> **The LLM call MUST NOT run inside the synchronous login path.**

Login (`auth.service` / `passkeys.service`) calls `SessionAnomalyService.analyze()`
synchronously to emit the JWT. That path must stay fast, deterministic, and free of
external network dependencies. The classifier therefore runs **after** the rule engine
persists an anomaly event, on a separate execution path. A Claude outage, latency
spike, or cost cap can never block or slow a login.

---

## 3. Approach A — async on persist

```
login → SessionAnomalyService.analyze()  (rule engine, synchronous)
             │
             ├─ severity == info  → nothing persisted, nothing classified
             │
             └─ severity != info  → persist SessionAnomalyEvent
                                     └─ emit "anomaly.persisted" (in-process event)
                                                 │  (async, off the login path)
                                                 ▼
                                   AnomalyClassifierListener
                                     → build prompt from event context
                                     → Claude (structured output)
                                     → persist classification (or mark failed)
```

- Decoupling mechanism: **`@nestjs/event-emitter`** (`EventEmitter2`). The rule engine
  emits `anomaly.persisted` with the event id after `events.save(row)`; a
  `@OnEvent('anomaly.persisted', { async: true })` listener does the classification.
- The listener is fire-and-forget from the login path's perspective. Its own failures
  are contained (see §7) and never propagate back.
- Rationale over a scheduled batch job (option B): classification lands within seconds
  of the event, and the same listener path is reused by the eval harness — no second
  code path to maintain. A cron backfill can be added later for events left `pending`.

---

## 4. Data model

New table `session_anomaly_classifications` (1:1 logical, but its own row so we can
re-run classification for evals without mutating the source event):

| column | type | notes |
|---|---|---|
| `id` | uuid PK | |
| `event_id` | uuid FK → `session_anomaly_events.id` (ON DELETE CASCADE) | |
| `status` | varchar(16) | `pending` \| `classified` \| `failed` |
| `label` | varchar(16) null | `legitimate` \| `suspicious` \| `critical` |
| `confidence` | numeric(3,2) null | 0.00–1.00 |
| `rationale` | text null | short model explanation |
| `recommended_action` | varchar(32) null | `allow` \| `step_up_auth` \| `alert` \| `block` |
| `model` | varchar(64) null | model id actually used |
| `input_tokens` / `output_tokens` | int null | for cost/latency reporting |
| `latency_ms` | int null | |
| `error` | text null | populated when `status = failed` |
| `created_at` / `updated_at` | timestamptz | |

Index on `(event_id)` and `(status)`. Keeping it a separate table (not columns on
`SessionAnomalyEvent`) means the eval harness and any future re-classification runs
never touch production anomaly rows.

---

## 5. LLM contract (structured output)

**Input** (assembled by the listener, never raw PII beyond what the event already holds):
- `flags` (e.g. `new_ip`, `new_country`, `new_user_agent`, `first_login`)
- `score`, `severity` (rule-engine outputs)
- `country`, `city`, `loginKind` (`password` \| `passkey`)
- a compact summary of the user's recent login history (counts of distinct
  IPs / countries / UA fingerprints in the window) — **not** raw history rows.

**Output schema** (enforced with `output_config.format` / `messages.parse`):

```jsonc
{
  "type": "object",
  "additionalProperties": false,
  "required": ["label", "confidence", "rationale", "recommended_action"],
  "properties": {
    "label":               { "type": "string", "enum": ["legitimate","suspicious","critical"] },
    "confidence":          { "type": "number" },          // 0..1
    "rationale":           { "type": "string" },
    "recommended_action":  { "type": "string", "enum": ["allow","step_up_auth","alert","block"] }
  }
}
```

The enum guarantee is the whole point of structured output here: the classifier can
never return a free-text label the system can't act on.

---

## 6. Model & API decisions

- **SDK:** `@anthropic-ai/sdk` (this is a NestJS/TypeScript service). No raw HTTP.
- **Model — DECIDED: `claude-sonnet-5`.** The ROADMAP named *"Sonnet 4.5"*, which is no
  longer the current Sonnet; `claude-sonnet-5` is the vigente equivalent and matches the
  roadmap's "cost-effective + structured output" intent. Kept behind a config value so the
  eval numbers can justify a move to `claude-opus-4-8` if precision/recall on the `critical`
  class falls short. (ROADMAP text should be updated from "Sonnet 4.5" to "Sonnet 5".)
- **No sampling params.** `temperature` / `top_p` / `top_k` are rejected (400) on
  `claude-sonnet-5` and `claude-opus-4-8` — do not send them. Steer via the system prompt.
- **`max_tokens`:** small and bounded — the output is a tiny JSON object; ~512 is ample.
- **Determinism / consistency:** rely on the schema + a rubric-style system prompt
  (explicit criteria for each label). Adaptive thinking is off by default on these models;
  leave it off for a fast, cheap classification.
- **API key:** `ANTHROPIC_API_KEY` via env/config. (Note: the existing
  `secret-rotation.cron` handles *internal* service-account keys, not this external
  provider key — separate concern.)
- **Feature flag:** `ANOMALY_CLASSIFIER_ENABLED`. When off, the listener no-ops and the
  login path is provably untouched.

---

## 7. Failure handling & resilience

Because the classifier is off the login path, failure is cheap:
- Claude call wrapped with a request **timeout** and the SDK's built-in retries
  (`maxRetries`), plus a small app-level cap.
- On exhaustion: set `status = failed`, store `error`, leave the event otherwise intact.
  A later cron/backfill (out of scope for this slice) can retry `pending`/`failed` rows.
- A per-window **cost/rate ceiling** so a burst of anomalies can't run up unbounded spend;
  excess events stay `pending`.
- Typed error handling (`RateLimitError`, `APIConnectionError`, `APIStatusError`) — no
  string matching.

---

## 8. Evals (MANDATORY — per roadmap)

> "Sin evals, un feature con LLM es un juguete."

- **Dataset:** 20–30 labeled anomaly events (hand-labeled `legitimate/suspicious/critical`),
  stored as fixtures. Seed from realistic combinations of flags/geo/device.
- **Harness:** runs the *same* classifier service over the fixture set, computes
  **precision/recall + confusion matrix per class**, and reports **cost/analysis (USD),
  p95 latency, avg tokens/query** (the numbers the M2 blog post needs).
- Runs as a standalone script (not in the login path, not in CI-blocking unit tests
  unless mocked). Real-API eval runs are opt-in.

---

## 9. Observability

- Structured log per classification: `event_id`, `label`, `confidence`, `latency_ms`,
  tokens, `model`.
- Counters for `classified` / `failed` / `pending` to expose a backlog if Claude is down.

---

## 10. Open questions

1. ~~Model~~ — **resolved: `claude-sonnet-5`** (config-driven; revisit via evals).
2. **`recommended_action` wiring:** does M2 slice #1 only *store* the recommendation,
   or does `step_up_auth` / `block` actually feed back into a future login decision?
   (Recommendation: store-only in this slice; acting on it is a separate, security-sensitive
   change.)
3. **History summary shape:** exact fields of the compact history summary passed to the model.
