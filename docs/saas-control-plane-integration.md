# SaaS Control Plane Integration

Use the Auth API provisioning contract from your trusted application backend to create the Sytadel organization, tenant, owner memberships, application, production environment, and service account as one retryable operation. Browser and mobile clients must never call the internal provisioning routes or receive the service-account credential.

## Quick path

1. Complete your own user signup and identify the active Sytadel owner user ID. The provisioning contract does not create a user.
2. Generate one UUID idempotency key for this onboarding attempt and persist it with the request in your backend.
3. From a private backend process, sign and submit `POST /internal/provisioning` to Auth API. Retry the same normalized request with the same key after transient failures; use a fresh timestamp and nonce for every HTTP attempt.
4. On completion, store the returned service-account secret immediately in your secret manager. Keep it out of logs, browser responses, analytics, and support tickets.
5. Wait until the appropriate Sytadel platform entitlements are active before issuing service-account API tokens or enabling protected API usage.
6. Render organization and linked-tenant metadata in your operator UI using the user-authenticated organization APIs; do not send provisioning credentials to that UI.

## Provisioning request

Configure the Auth API base URL (including its `/api` prefix), internal service secret, HMAC secret, and a private nonce source in the integrating backend's secret manager. Auth API uses `AUTH_INTERNAL_SERVICE_SECRET`, `AUTH_INTERNAL_HMAC_SECRET`, and optionally `AUTH_INTERNAL_MAX_CLOCK_SKEW_MS` (default 30,000 ms). Production deployments must provide the internal secrets; development/test fallbacks are not production credentials. Auth API also requires `AUTH_PROVISIONING_SECRET_ENCRYPTION_KEY`: a private 32-byte base64 key used to retain encrypted credential material for idempotent replay. Keep that key stable while encrypted provisioning records remain; rotation requires a planned re-encryption or dual-key migration.

`POST /internal/provisioning` accepts a signed JSON body with these fields:

| Field | Purpose |
|---|---|
| `idempotencyKey` | UUID scoped to the trusted caller; reuse it only for this exact logical request. |
| `ownerUserId` | UUID of an already-existing active Auth user. |
| `organizationName`, `organizationSlug` | Organization identity; slug is lowercase letters, digits, and hyphens. |
| `tenantName`, `tenantSlug` | Initial security tenant identity. |
| `applicationName`, `applicationSlug` | Initial client application identity. |
| `applicationDescription` | Optional description, up to 500 characters. |
| `serviceAccountName` | Initial technical identity. |
| `serviceAccountDescription` | Optional description, up to 500 characters. |
| `serviceAccountScopes` | Optional unique list of Auth API allowlisted scopes. |

The API creates an organization billing account, organization OWNER membership, FREE tenant, tenant OWNER membership, organization-to-tenant link, client application, production environment, and service account. Tenant provisioning is intentionally not a Sytadel billing entitlement bypass.

### Internal request signature

Every `/internal/*` request is protected by `InternalServiceGuard`. Send these headers:

| Header | Value |
|---|---|
| `x-internal-service-secret` | Shared Auth internal-service secret. |
| `x-internal-service-ts` | Current Unix timestamp in milliseconds. |
| `x-internal-service-nonce` | Fresh unique value for this HTTP attempt; a replayed nonce is rejected. |
| `x-internal-service-signature` | Lowercase hex HMAC-SHA256 of the canonical request string below. |

The canonical string is five UTF-8 fields joined by newline, with no trailing newline:

```text
UPPERCASE_METHOD
PATH_AND_QUERY_AS_RECEIVED_BY_AUTH_API
LOWERCASE_HEX_SHA256_OF_COMPACT_JSON_BODY
TIMESTAMP_MILLISECONDS
NONCE
```

For a bodyless request, the body digest is SHA-256 of the empty string. For JSON, serialize a stable property order compactly, send those bytes, and compute the digest so it matches Auth's parsed-body JSON serialization. Sign the API-prefixed path (for example `/api/internal/provisioning`), not just the controller-relative path. The HMAC key is `AUTH_INTERNAL_HMAC_SECRET`; the separate service-secret header is also required. Use a new timestamp and nonce on every retry, while preserving the idempotency key and request payload.

Example FastAPI-backend helper for this JSON contract:

```python
import hashlib
import hmac
import json
import time
import uuid
from urllib.parse import urlsplit


def signed_internal_request(method: str, url: str, payload: dict, service_secret: str, hmac_secret: str):
    # Keep dictionary insertion order stable across retries.
    body = json.dumps(payload, separators=(",", ":"), ensure_ascii=False)
    timestamp = str(int(time.time() * 1000))
    nonce = str(uuid.uuid4())
    parsed = urlsplit(url)
    path_and_query = parsed.path + (f"?{parsed.query}" if parsed.query else "")
    body_hash = hashlib.sha256(body.encode("utf-8")).hexdigest()
    canonical = "\n".join((method.upper(), path_and_query, body_hash, timestamp, nonce))
    signature = hmac.new(hmac_secret.encode("utf-8"), canonical.encode("utf-8"), hashlib.sha256).hexdigest()
    headers = {
        "content-type": "application/json",
        "x-internal-service-secret": service_secret,
        "x-internal-service-ts": timestamp,
        "x-internal-service-nonce": nonce,
        "x-internal-service-signature": signature,
    }
    return body, headers
```

Pass the returned body as the HTTP request content rather than letting a client library serialize it a second time. Validate this signer against the Auth API in a non-production environment before rollout; do not put either signing secret in frontend configuration.

## Idempotency, retries, and credential custody

- Persist the generated UUID idempotency key and the normalized request before the first call. Same-key requests with different normalized inputs are rejected with `409 Conflict`.
- Concurrent same-key requests serialize against the durable operation row. Provisioned resources are created in one Auth database transaction; failed resource writes roll back, while the operation retains recoverable status, current step, safe error code, attempt count, and resource identifiers.
- Retry transient failures with the same key and payload but a fresh signed nonce/timestamp. Do not create a new key merely because a response timed out.
- A completed POST response includes `clientSecret`. A completed replay of the same POST returns the same secret; Auth retains only an encrypted replay copy and the normal service-account credential hash. Store the plaintext in your secret manager before acknowledging onboarding as complete.
- `GET /internal/provisioning/{idempotencyKey}` returns operation state and resource IDs, never `clientSecret`. If the completed POST response was lost, retry that exact POST with its original key and payload to recover the same credential.
- If a credential is unavailable, the API fails closed rather than minting a different value for the same operation. Escalate that state for operator recovery; do not fall back to a new key automatically.

## Entitlements and service-account use

Provisioning creates the tenant with plan `FREE`, no API add-ons, and `billingBypass=false`. It only bootstraps Auth-owned identity and integration resources; it does not activate paid platform features. Complete the normal platform subscription and entitlement flow for the organization/covered tenants before calling entitlement-gated APIs. Service-account token issuance and protected API operations continue to enforce those normal entitlements.

## Organization visibility

Human users authenticate through the normal tenant-scoped session. The App's Organizations page reads:

- `GET /organizations` for the signed-in user's active organization memberships and organization metadata.
- `GET /organizations/{organizationId}/tenants` for linked tenants; Auth verifies active organization membership.

The API also supports `POST /organizations/{organizationId}/tenants` to link an existing tenant when the actor is an active organization OWNER/ADMIN and an active tenant OWNER/ADMIN, and `GET/POST /organizations/{organizationId}/memberships` for existing-user organization membership administration. Adding an organization membership does not create a tenant membership. The current contract has no email invitation, tenant unlink, or membership-deactivation operation; do not present those as supported UI actions.

The older direct-tenant creation path remains available for direct Sytadel usage. It does not create the consolidated organization/billing-account provisioning graph and is not a substitute for this SaaS backend workflow.

## Data ownership

Keep your product catalog, end-customer profiles, business records, and SaaS-specific authorization data in your own application. Sytadel stores identity and access metadata, organization/tenant links, application/environment/service-account metadata, entitlements, and platform billing state. Treat Sytadel IDs as references in your system; do not move your customer business data into Auth API.

## Operational checklist

- [ ] Internal secrets and the provisioning encryption key are held by backend secret management only.
- [ ] Every provisioning retry preserves its key and payload and uses a fresh nonce/timestamp.
- [ ] The integration stores `clientSecret` before reporting successful onboarding and never logs it.
- [ ] UI reads organization/tenant metadata with a user's Auth token and never calls `/internal/*`.
- [ ] Platform entitlements are active before entitlement-gated service-account use.
- [ ] A non-production signed request and same-key replay have been verified before rollout.
