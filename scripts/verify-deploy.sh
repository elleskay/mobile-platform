#!/usr/bin/env bash
# Smoke-test a deployed API. Catches the failures that matter for this stack:
# dead health endpoint, validation not enforced, the check route not wired, and
# secrets accidentally echoed back.
#
# Usage:
#   ./scripts/verify-deploy.sh https://abc123.execute-api.ap-southeast-1.amazonaws.com
#
# Exits non-zero on any failed check so it can gate CI/CD.

set -euo pipefail

URL="${1:-}"
if [ -z "$URL" ]; then
  echo "Usage: $0 <deployed-api-url>" >&2
  exit 2
fi

URL="${URL%/}"
fail=0
pass=0

note() { printf "  %s\n" "$*"; }
ok()   { pass=$((pass+1)); printf "\033[32m  PASS\033[0m  %s\n" "$*"; }
err()  { fail=$((fail+1)); printf "\033[31m  FAIL\033[0m  %s\n" "$*"; }

check() {
  local name="$1"; shift
  printf "==> %s\n" "$name"
  if "$@"; then ok "$name"; else err "$name"; fi
}

# 1. /health responds 200 with JSON {status: ok}
check_health() {
  local body
  body=$(curl -sS --max-time 10 "$URL/health") || return 1
  echo "$body" | grep -q '"status":"ok"' || { note "body: $body"; return 1; }
}

# 2. POST /reports/check classifies a message (proves the request path + Nest
# routing + DI are wired, not just static health)
check_classify() {
  local body
  body=$(curl -sS --max-time 10 -X POST "$URL/reports/check" \
    -H "content-type: application/json" \
    -d '{"text":"URGENT verify your bank http://evil.example"}') || return 1
  echo "$body" | grep -q '"verdict"' || { note "body: $body"; return 1; }
}

# 3. Validation is enforced: an empty body is rejected with 400
check_validation() {
  local code
  code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 10 -X POST "$URL/reports/check" \
    -H "content-type: application/json" -d '{}')
  [ "$code" = "400" ] || { note "expected 400, got $code"; return 1; }
}

# 4. Unknown fields are rejected (whitelist + forbidNonWhitelisted)
check_whitelist() {
  local code
  code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 10 -X POST "$URL/reports/check" \
    -H "content-type: application/json" -d '{"text":"hi","admin":true}')
  [ "$code" = "400" ] || { note "expected 400 for extra field, got $code"; return 1; }
}

# 5. Report submit enqueues and returns a reportId
check_submit() {
  local body
  body=$(curl -sS --max-time 10 -X POST "$URL/reports" \
    -H "content-type: application/json" \
    -d '{"text":"prize click http://x.example","channel":"sms"}') || return 1
  echo "$body" | grep -qE '"reportId":"[0-9a-f-]+"' || { note "body: $body"; return 1; }
}

# 6. No secret material leaks in responses (regression guard)
check_no_secret_leak() {
  local body
  body=$(curl -sS --max-time 10 "$URL/health")
  if echo "$body" | grep -qiE 'secret|jwt_secret|api_key|password'; then
    note "health response mentions a secret-like field: $body"
    return 1
  fi
}

check "Health endpoint" check_health
check "POST /reports/check classifies" check_classify
check "Validation rejects empty body (400)" check_validation
check "Unknown fields rejected (400)" check_whitelist
check "POST /reports returns a reportId" check_submit
check "No secret material leaked" check_no_secret_leak

echo
echo "Summary: $pass passed, $fail failed"
[ "$fail" -eq 0 ]
