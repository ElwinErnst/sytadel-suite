#!/usr/bin/env bash

set -euo pipefail

AUTH_BASE_URL="${AUTH_BASE_URL:-http://localhost:3002/api}"
ZT_BASE_URL="${ZT_BASE_URL:-http://localhost:3010}"
SMOKE_EMAIL="${SMOKE_EMAIL:-admin@test.com}"
SMOKE_PASSWORD="${SMOKE_PASSWORD:-123456}"
SMOKE_TENANT_SLUG="${SMOKE_TENANT_SLUG:-sentinel-labs}"

TMP_DIR="$(mktemp -d)"
RESPONSE_STATUS=""
RESPONSE_BODY=""
ACCESS_TOKEN=""
SMOKE_DOC_ID=""
SMOKE_VAULT_ID=""

cleanup() {
  if [[ -n "$SMOKE_DOC_ID" && -n "$ACCESS_TOKEN" ]]; then
    curl -sS -o /dev/null \
      -X DELETE "${ZT_BASE_URL}/vault/documents/${SMOKE_DOC_ID}" \
      -H "Authorization: Bearer ${ACCESS_TOKEN}" || true
  fi

  if [[ -n "$SMOKE_VAULT_ID" && -n "$ACCESS_TOKEN" ]]; then
    curl -sS -o /dev/null \
      -X DELETE "${ZT_BASE_URL}/vault/vaults/${SMOKE_VAULT_ID}" \
      -H "Authorization: Bearer ${ACCESS_TOKEN}" || true
  fi

  rm -rf "$TMP_DIR"
}

trap cleanup EXIT

json_get() {
  local expression="$1"
  local json_input="${2:-$RESPONSE_BODY}"

  node -e "const data = JSON.parse(process.argv[1]); const value = (${expression}); if (value === undefined || value === null) process.exit(1); process.stdout.write(String(value));" \
    "$json_input"
}

request() {
  local name="$1"
  shift

  local body_file="$TMP_DIR/${name}.body"
  RESPONSE_STATUS="$(curl -sS -o "$body_file" -w '%{http_code}' "$@")"
  RESPONSE_BODY="$(cat "$body_file")"
}

assert_status() {
  local expected="$1"
  local context="$2"

  if [[ "$RESPONSE_STATUS" != "$expected" ]]; then
    echo "FAIL: ${context}"
    echo "Expected HTTP ${expected}, got ${RESPONSE_STATUS}"
    echo "Response body:"
    echo "$RESPONSE_BODY"
    exit 1
  fi
}

assert_body_contains() {
  local needle="$1"
  local context="$2"

  if [[ "$RESPONSE_BODY" != *"$needle"* ]]; then
    echo "FAIL: ${context}"
    echo "Expected response body to contain: $needle"
    echo "Response body:"
    echo "$RESPONSE_BODY"
    exit 1
  fi
}

echo "==> Smoke: login against auth-api"
request login \
  -X POST "${AUTH_BASE_URL}/auth/login" \
  -H 'Content-Type: application/json' \
  --data-raw "{\"email\":\"${SMOKE_EMAIL}\",\"password\":\"${SMOKE_PASSWORD}\",\"tenantSlug\":\"${SMOKE_TENANT_SLUG}\"}"
assert_status 201 "auth login should succeed"

ACCESS_TOKEN="$(
  json_get 'data.accessToken'
)"

if [[ -z "$ACCESS_TOKEN" ]]; then
  echo "FAIL: auth login did not return an accessToken"
  exit 1
fi

echo "==> Smoke: list tenants through zerotrust-api"
request list-tenants \
  "${ZT_BASE_URL}/vault/tenants" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}"
assert_status 200 "listing tenants through Zero Trust should succeed"
assert_body_contains "\"slug\":\"${SMOKE_TENANT_SLUG}\"" "tenant list should include the demo tenant"

echo "==> Smoke: tenant creation must be blocked in vault-api"
request create-tenant \
  -X POST "${ZT_BASE_URL}/vault/tenants" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}"
assert_status 409 "tenant creation in vault should be blocked"
assert_body_contains "Tenant creation is owned by auth-api" "tenant creation should be delegated to auth-api"

SMOKE_VAULT_SLUG="smoke-$(date +%s)"
SMOKE_VAULT_NAME="Smoke ${SMOKE_VAULT_SLUG}"

echo "==> Smoke: create a vault through zerotrust-api"
request create-vault \
  -X POST "${ZT_BASE_URL}/vault/vaults" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H 'Content-Type: application/json' \
  --data-raw "{\"name\":\"${SMOKE_VAULT_NAME}\",\"slug\":\"${SMOKE_VAULT_SLUG}\"}"
assert_status 201 "vault creation through Zero Trust should succeed"
assert_body_contains "\"slug\":\"${SMOKE_VAULT_SLUG}\"" "created vault should be returned"

SMOKE_VAULT_ID="$(json_get 'data.id')"

echo "==> Smoke: list vaults through zerotrust-api"
request list-vaults \
  "${ZT_BASE_URL}/vault/vaults" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}"
assert_status 200 "listing vaults through Zero Trust should succeed"
assert_body_contains "\"slug\":\"${SMOKE_VAULT_SLUG}\"" "vault list should include the smoke vault"

SMOKE_DOC_PATH="$TMP_DIR/smoke.pdf"
cat >"$SMOKE_DOC_PATH" <<'EOF'
%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Count 1 /Kids [3 0 R] >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 4 0 R >>
endobj
4 0 obj
<< /Length 44 >>
stream
BT /F1 12 Tf 72 120 Td (Sentinel smoke test) Tj ET
endstream
endobj
trailer
<< /Root 1 0 R >>
%%EOF
EOF

echo "==> Smoke: upload a document through zerotrust-api"
request upload-document \
  -X POST "${ZT_BASE_URL}/vault/documents?vaultId=${SMOKE_VAULT_ID}&name=Smoke%20Document" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -F "file=@${SMOKE_DOC_PATH};type=application/pdf"
assert_status 201 "document upload through Zero Trust should succeed"
assert_body_contains "\"vaultId\":\"${SMOKE_VAULT_ID}\"" "uploaded document should belong to the smoke vault"

SMOKE_DOC_ID="$(json_get 'data.id')"

echo "==> Smoke: list documents through zerotrust-api"
request list-documents \
  "${ZT_BASE_URL}/vault/documents?vaultId=${SMOKE_VAULT_ID}" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}"
assert_status 200 "listing documents through Zero Trust should succeed"
assert_body_contains "\"id\":\"${SMOKE_DOC_ID}\"" "document list should include the uploaded document"

echo "==> Smoke: download the uploaded document through zerotrust-api"
DOWNLOADED_DOC_PATH="$TMP_DIR/downloaded.pdf"
DOWNLOAD_STATUS="$(curl -sS -o "$DOWNLOADED_DOC_PATH" -w '%{http_code}' \
  "${ZT_BASE_URL}/vault/documents/${SMOKE_DOC_ID}/download" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}")"
if [[ "$DOWNLOAD_STATUS" != "200" ]]; then
  echo "FAIL: document download through Zero Trust should succeed"
  echo "Expected HTTP 200, got ${DOWNLOAD_STATUS}"
  exit 1
fi

if ! cmp -s "$SMOKE_DOC_PATH" "$DOWNLOADED_DOC_PATH"; then
  echo "FAIL: downloaded document content does not match the uploaded file"
  exit 1
fi

echo "==> Smoke: cleanup uploaded document"
request delete-document \
  -X DELETE "${ZT_BASE_URL}/vault/documents/${SMOKE_DOC_ID}" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}"
assert_status 200 "document cleanup should succeed"
assert_body_contains "\"ok\":true" "document cleanup should confirm success"
SMOKE_DOC_ID=""

echo "==> Smoke: cleanup created vault"
request delete-vault \
  -X DELETE "${ZT_BASE_URL}/vault/vaults/${SMOKE_VAULT_ID}" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}"
assert_status 200 "vault cleanup should succeed"
assert_body_contains "\"ok\":true" "vault cleanup should confirm success"
SMOKE_VAULT_ID=""

echo "Smoke test passed."
