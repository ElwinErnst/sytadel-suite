#!/usr/bin/env bash

set -euo pipefail

AUTH_BASE_URL="${AUTH_BASE_URL:-http://localhost:3002/api}"
ZT_BASE_URL="${ZT_BASE_URL:-http://localhost:3010}"
VAULT_BASE_URL="${VAULT_BASE_URL:-http://localhost:3000}"
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

echo "==> Notary smoke: login against auth-api"
request login \
  -X POST "${AUTH_BASE_URL}/auth/login" \
  -H 'Content-Type: application/json' \
  --data-raw "{\"email\":\"${SMOKE_EMAIL}\",\"password\":\"${SMOKE_PASSWORD}\",\"tenantSlug\":\"${SMOKE_TENANT_SLUG}\"}"
assert_status 201 "auth login should succeed"

ACCESS_TOKEN="$(
  json_get 'data.accessToken'
)"

SMOKE_VAULT_SLUG="notary-smoke-$(date +%s)"

echo "==> Notary smoke: create a vault"
request create-vault \
  -X POST "${ZT_BASE_URL}/vault/vaults" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H 'Content-Type: application/json' \
  --data-raw "{\"name\":\"Notary Smoke\",\"slug\":\"${SMOKE_VAULT_SLUG}\"}"
assert_status 201 "vault creation should succeed"
SMOKE_VAULT_ID="$(json_get 'data.id')"

SMOKE_DOC_PATH="$TMP_DIR/notary.pdf"
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
BT /F1 12 Tf 72 120 Td (Notary smoke test) Tj ET
endstream
endobj
trailer
<< /Root 1 0 R >>
%%EOF
EOF

echo "==> Notary smoke: upload a document"
request upload-document \
  -X POST "${ZT_BASE_URL}/vault/documents?vaultId=${SMOKE_VAULT_ID}&name=Notary%20Smoke" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -F "file=@${SMOKE_DOC_PATH};type=application/pdf"
assert_status 201 "document upload should succeed"
SMOKE_DOC_ID="$(json_get 'data.id')"

echo "==> Notary smoke: issue notary record"
request issue-notary \
  -X POST "${ZT_BASE_URL}/vault/notary/documents/${SMOKE_DOC_ID}/issue" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}"
assert_status 201 "notary issue should succeed"
assert_body_contains "\"status\":\"ISSUED\"" "notary issue should return issued status"

echo "==> Notary smoke: fetch document notary status"
request notary-status \
  "${ZT_BASE_URL}/vault/notary/documents/${SMOKE_DOC_ID}/status" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}"
assert_status 200 "notary status should succeed"
assert_body_contains "\"status\":\"ISSUED\"" "notary status should be issued"

echo "==> Notary smoke: fetch public notary verification"
request public-verify \
  "${VAULT_BASE_URL}/public/notary/verify/${SMOKE_DOC_ID}"
assert_status 200 "public notary verify should succeed"
assert_body_contains "\"notaryStatus\":\"ISSUED\"" "public verify should expose issued notary status"
assert_body_contains "\"status\":\"VALID\"" "public verify should report valid document"

echo "Notary smoke passed."
