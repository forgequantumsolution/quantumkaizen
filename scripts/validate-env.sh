#!/bin/bash
# validate-env.sh — Verify all required environment variables are set
# Run before starting the server in production: bash scripts/validate-env.sh

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ERRORS=0

check() {
  local var="$1"
  local desc="$2"
  local required="${3:-true}"
  local value="${!var:-}"

  if [ -z "$value" ]; then
    if [ "$required" = "true" ]; then
      echo -e "${RED}[MISSING]${NC}  $var — $desc"
      ERRORS=$((ERRORS + 1))
    else
      echo -e "${YELLOW}[OPTIONAL]${NC} $var — $desc (not set)"
    fi
  else
    # Mask value in output
    local masked="${value:0:4}****"
    echo -e "${GREEN}[OK]${NC}       $var = $masked"
  fi
}

echo "=== Quantum Kaizen — Environment Validation ==="
echo ""

echo "--- Application ---"
check "NODE_ENV"           "Runtime environment (development|test|production)"
check "PORT"               "Server port" false
check "CORS_ORIGIN"        "Allowed CORS origin(s)"

echo ""
echo "--- Database ---"
check "DATABASE_URL"       "PostgreSQL connection string"

echo ""
echo "--- JWT ---"
check "JWT_SECRET"         "JWT signing secret (min 32 chars)"
check "JWT_REFRESH_SECRET" "JWT refresh token secret (min 32 chars)"

echo ""
echo "--- Redis ---"
check "REDIS_URL"          "Redis connection URL"

echo ""
echo "--- S3 / Object Storage ---"
check "S3_ENDPOINT"        "S3/MinIO endpoint URL"
check "S3_ACCESS_KEY"      "S3 access key"
check "S3_SECRET_KEY"      "S3 secret key"
check "S3_BUCKET"          "S3 bucket name"

echo ""
echo "--- SMTP (optional) ---"
check "SMTP_HOST"          "SMTP server hostname" false
check "SMTP_USER"          "SMTP username" false
check "SMTP_PASS"          "SMTP password" false

echo ""

# Extra validation: JWT secrets must be strong in production
if [ "${NODE_ENV:-}" = "production" ]; then
  if [ ${#JWT_SECRET:-} -lt 32 ]; then
    echo -e "${RED}[WEAK]${NC}     JWT_SECRET must be at least 32 characters in production"
    ERRORS=$((ERRORS + 1))
  fi
  if [ ${#JWT_REFRESH_SECRET:-} -lt 32 ]; then
    echo -e "${RED}[WEAK]${NC}     JWT_REFRESH_SECRET must be at least 32 characters in production"
    ERRORS=$((ERRORS + 1))
  fi
fi

echo ""
if [ "$ERRORS" -gt 0 ]; then
  echo -e "${RED}Validation failed: $ERRORS error(s). Fix before starting the server.${NC}"
  exit 1
else
  echo -e "${GREEN}All required environment variables are set.${NC}"
  exit 0
fi
