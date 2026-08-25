# Pilot spec — Sytadel Billing as a standalone, OSS, drop-in payments module

**Status:** proposed · **Type:** target-state design + pilot plan
**Author:** (draft) · **Date:** 2026-08

## Why this pilot

Sytadel's product thesis (see [[product-direction]]) is an **open-source, composable
"security-first backend toolkit" for SaaS builders** — each module usable
standalone AND as the full stack. The cheapest, highest-signal way to validate
that thesis is to make **one module genuinely drop-in for one real external app**,
end to end. Billing is the chosen wedge because its killer feature —
**secure MercadoPago integration for LATAM** — is a concrete, underserved pain
("configurás params y cobrás seguro") and expresses the security identity through
the most-wanted feature.

> **Not** competing with Stripe. Billing *wraps* providers (MercadoPago, Stripe,
> mock) behind one safe API. The differentiator is *secure by default* (webhook
> signature verification, idempotency, the provider token never touches the
> consumer app) and *LATAM-first* (MercadoPago DX done right).

**Success metric:** a developer goes from zero to "I charged a test payment and
got a verified webhook back" in **under 10 minutes**, with **no provider token in
their own app**.

## Reference consumer

`vacaciones-web` (a real Next.js travel-package site) is the integration model —
not the pilot consumer (it's a shipped client product). Today it embeds the MP
SDK directly, holds the MP access token, and its webhook **does not verify the MP
signature**. Handing payments to Sytadel Billing would *remove its token*, *add
signature verification for free*, and let it "forget about payments."

## The seam (who owns what)

| Sytadel Billing (payment orchestration) | Consumer app (business logic) |
|---|---|
| Talk to the provider (token, SDK, create checkout) | Compute the cart total |
| Receive + **verify** the provider webhook | Reserve inventory / holds |
| Track payment state (re-fetch from provider = source of truth) | Create the domain record on "paid" |
| **Notify the app via a signed outbound webhook** | React to the event (confirm, email, fulfil) |

## Current state (what exists) vs gaps (what the pilot builds)

Grounded in `billing-api/src/modules/billing/billing.service.ts`:

| Capability | Today | Pilot |
|---|---|---|
| Provider abstraction | ✅ mock / stripe / mercadopago, config-selected | keep; expose provider per request |
| Checkout | 🟡 `createCheckoutSession` — **subscription/plan-oriented** | add **one-off** + **usage** checkout surface |
| Usage metering | ✅ `recordUsageEvent` + period close | keep |
| Inbound webhooks | ✅ Stripe verified; MP now verified (audit fix); re-fetches provider = source of truth | keep |
| **Outbound webhooks (→ consumer app)** | ❌ **missing** | **build — the core of "forget about it"** |
| Idempotency keys (money endpoints) | ❌ missing | **build** |
| External developer auth (API keys) | 🟡 base exists: `API_CLIENT` role + `clientAppId` at the gateway | self-serve issuance + scoping + rotation |
| Public API contract (OpenAPI) | ❌ missing | **build** — versioned, documented |
| Standalone (no auth dependency) | ❌ billing needs auth for entitlements (internal HMAC) | decouple OR bundle a minimal key-auth |

## Architecture decisions

1. **External apps authenticate with an API key**, resolved by the ZeroTrust
   gateway as `API_CLIENT` (already the shape). The consumer never sees a
   provider token. Rate-limit + per-key usage metering come free from the gateway.
2. **Outbound webhooks are HMAC-signed** using the same canonical + HMAC machinery
   as the internal ZT/service signatures (Part 02 of the guide) — *inverted*:
   Sytadel signs, the consumer verifies with a per-tenant webhook secret. Carry
   the consumer's `external_reference` + `metadata` round-trip so the app knows
   *which* domain object the event maps to.
3. **Idempotency**: money-moving endpoints accept an `Idempotency-Key` header;
   outbound webhook delivery is idempotent + retried with backoff.
4. **Keep PCI out of scope**: MP/Stripe remain the processor; Sytadel never stores
   card data (PAN). This is a load-bearing design constraint — do not break it.
5. **Standalone**: billing's only cross-service need is *entitlements* (from auth).
   Decision needed (see open questions) — decouple behind an interface with a
   "no-entitlements / all-allowed" default, or bundle a minimal key-auth.

## Concrete contract (the vacaciones-web pattern)

**Create checkout** (app → billing, API-key auth):
```
POST /checkout        Idempotency-Key: <uuid>
{
  "mode": "one_off",                 // one_off | subscription | usage
  "provider": "mercadopago",         // or stripe / mock
  "items": [{ "title": "Reserva X", "amount": 120000, "currency": "ARS", "qty": 1 }],
  "payer": { "email": "..." },
  "returnUrls": { "success": "...", "failure": "...", "pending": "..." },
  "externalReference": "paquete:42:hold:abc",
  "metadata": { "paqueteId": "42", "holdId": "abc" },
  "webhookUrl": "https://app/api/sytadel/webhook"
}
→ 200 { "checkoutUrl": "https://mp/checkout/...", "paymentIntentId": "..." }
```

**Outbound webhook** (billing → app, signed):
```
POST <webhookUrl>
Headers: x-sytadel-signature: ts=…,v1=<hmac>   x-sytadel-event-id: <uuid>
{ "event": "payment.approved", "externalReference": "paquete:42:hold:abc",
  "metadata": {...}, "status": "approved", "amount": 120000, "provider": "mercadopago" }
```
The app verifies the signature, dedupes on `x-sytadel-event-id`, then runs its
own logic (confirm reserva, email). Payment state always reflects the provider
(billing re-fetches), so a forged webhook can't fabricate a payment.

## Phased task breakdown (each phase shippable)

1. **One-off checkout** — add `mode: one_off` to the checkout surface + provider
   adapters (start with MercadoPago, since that's the wedge). Reuse the existing
   MP `Preference` creation, generalized off subscriptions.
2. **Outbound signed webhooks** *(the core)* — a `WebhookEndpoint` per tenant
   (url + secret), a signer (invert the HMAC canonicalization), a delivery worker
   with retries + `event_id` dedupe. Emit `payment.approved` / `.failed` from the
   inbound handler after the provider re-fetch.
3. **Idempotency** — `Idempotency-Key` on `/checkout`; store + replay results.
4. **API-key issuance** — self-serve create/scope/rotate keys for `API_CLIENT`
   (build on `clientAppId` + service accounts).
5. **Decouple from auth** — entitlements behind an interface with an
   all-allowed default so billing runs standalone.
6. **OpenAPI + 10-minute quickstart** — versioned contract, an SDK snippet, and a
   runnable example app (sanitized vacaciones-web pattern).

## Validation

- Dogfood: a throwaway consumer app hits `/checkout` (mock provider) → receives a
  signed outbound webhook → verifies it. Assert the round-trip + idempotency.
- The meta-repo **Smoke CI** covers billing boots + the new endpoints.
- The real acceptance test is the **10-minute quickstart** working from a clean
  clone.

## Open decisions (need the user)

1. **Standalone strategy**: decouple entitlements (interface + all-allowed
   default) vs bundle a minimal key-auth into billing? (Affects "use just billing".)
2. **B2B2C tenant model**: the consumer app is a tenant, but its *end users* pay —
   is that a flat tenant or a two-level model? (One-off checkout may not need it;
   subscriptions-for-the-app's-customers would.)
3. **Pilot delivery**: self-host (docker) first, or a hosted sandbox for the
   quickstart?
4. **Which provider first**: MercadoPago (the wedge) — confirm.

## Non-goals (for the pilot)

- Rebuilding Stripe features (proration, dunning, tax, invoicing).
- Storing card data / entering PCI scope.
- Making all modules standalone at once — billing first, as the template.
