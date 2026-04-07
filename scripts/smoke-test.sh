#!/bin/bash
# smoke-test.sh — Post-deploy verification
# Usage: BASE_URL=https://app.quantumkaizen.io bash scripts/smoke-test.sh

set -uo pipefail

BASE_URL="${BASE_URL:-http://localhost}"
PASS=0
FAIL=0

GREEN='\033[0;32m'; RED='\033[0;31m'; NC='\033[0m'

check() {
  local desc="$1" url="$2" expected="$3"
  local status
  status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$url" 2>/dev/null || echo "000")
  if [ "$status" = "$expected" ]; then
    echo -e "${GREEN}PASS${NC} [$status] $desc"
    PASS=$((PASS+1))
  else
    echo -e "${RED}FAIL${NC} [$status expected $expected] $desc — $url"
    FAIL=$((FAIL+1))
  fi
}

echo "=== Smoke Test: $BASE_URL ==="
check "Landing page"       "$BASE_URL/"                         "200"
check "Health liveness"    "$BASE_URL/health"                   "200"
check "Health readiness"   "$BASE_URL/health/ready"             "200"
check "API reachable"      "$BASE_URL/api/v1/auth/me"           "401"
check "Rate limiter works" "$BASE_URL/api/v1/auth/login"        "400"
check "Hidden files denied" "$BASE_URL/.env"                    "404"
check "CSP header present" "$BASE_URL/"                         "200"

echo ""
echo "Results: PASS=$PASS  FAIL=$FAIL"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
