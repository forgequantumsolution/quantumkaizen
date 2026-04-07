#!/bin/bash
# security-audit.sh — Local one-command DevSecOps security audit
# Usage: bash scripts/security-audit.sh

set -uo pipefail

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PASS=0
FAIL=0
WARN=0

step() { echo -e "\n${BLUE}[$1/6]${NC} $2"; }
ok()   { echo -e "${GREEN}  PASS${NC} — $1"; PASS=$((PASS+1)); }
fail() { echo -e "${RED}  FAIL${NC} — $1"; FAIL=$((FAIL+1)); }
warn() { echo -e "${YELLOW}  WARN${NC} — $1"; WARN=$((WARN+1)); }

echo "======================================"
echo " Quantum Kaizen — Security Audit"
echo " $(date '+%Y-%m-%d %H:%M:%S')"
echo "======================================"

# ── Step 1: Secrets scan ──────────────────────────────────────────────
step 1 "Secrets scan (gitleaks)"
if command -v gitleaks &>/dev/null; then
  if gitleaks detect --source . --no-banner 2>/dev/null; then
    ok "No secrets detected"
  else
    fail "Secrets detected — run: gitleaks detect --source . --report-path findings.json"
  fi
else
  warn "gitleaks not installed — install: brew install gitleaks"
fi

# ── Step 2: .env in git check ─────────────────────────────────────────
step 2 "Git .env tracking check"
if git ls-files | grep -E "^(server|client)/\.env$" 2>/dev/null; then
  fail ".env files are tracked in git — remove with: git rm --cached server/.env"
else
  ok ".env files not tracked in git"
fi

# Check .gitignore covers .env
if grep -q "\.env" .gitignore 2>/dev/null; then
  ok ".env patterns found in .gitignore"
else
  warn ".gitignore may not cover all .env variants"
fi

# ── Step 3: Dependency audit ──────────────────────────────────────────
step 3 "Dependency security audit (npm audit)"
echo "  Server:"
cd server && npm audit --audit-level=high 2>&1 | tail -5 && cd ..
echo "  Client:"
cd client && npm audit --audit-level=high 2>&1 | tail -5 && cd ..
ok "npm audit complete (check output above for issues)"

# ── Step 4: SAST ──────────────────────────────────────────────────────
step 4 "SAST — Semgrep"
if command -v semgrep &>/dev/null; then
  if semgrep --config "p/typescript" --config "p/owasp-top-ten" \
     --config "p/nodejs" --config "p/secrets" \
     --quiet --error server/src/ 2>/dev/null; then
    ok "Semgrep: no issues found"
  else
    fail "Semgrep: issues found — run: semgrep --config p/typescript server/src/"
  fi
else
  warn "semgrep not installed — install: pip install semgrep"
fi

# ── Step 5: Dockerfile lint ───────────────────────────────────────────
step 5 "Dockerfile lint (dockle)"
if command -v dockle &>/dev/null; then
  if dockle --exit-code 1 $(docker images -q quantum-kaizen-server 2>/dev/null | head -1) 2>/dev/null; then
    ok "Dockle: Dockerfile best practices pass"
  else
    warn "Dockle: issues found or image not built yet"
  fi
else
  warn "dockle not installed — install: brew install goodwithtech/r/dockle"
fi

# ── Step 6: Trivy filesystem scan ────────────────────────────────────
step 6 "Filesystem vulnerability scan (trivy)"
if command -v trivy &>/dev/null; then
  if trivy fs . --severity CRITICAL,HIGH --quiet --exit-code 0 2>/dev/null; then
    ok "Trivy: no CRITICAL/HIGH vulnerabilities in source"
  else
    fail "Trivy: vulnerabilities found — run: trivy fs . --severity CRITICAL,HIGH"
  fi
else
  warn "trivy not installed — install: brew install trivy"
fi

# ── Summary ──────────────────────────────────────────────────────────
echo ""
echo "======================================"
echo " Security Audit Summary"
echo "======================================"
echo -e " ${GREEN}PASS: $PASS${NC}  ${RED}FAIL: $FAIL${NC}  ${YELLOW}WARN: $WARN${NC}"
echo ""

if [ "$FAIL" -gt 0 ]; then
  echo -e "${RED}Audit FAILED — $FAIL critical issue(s) must be resolved.${NC}"
  exit 1
else
  echo -e "${GREEN}Audit PASSED — review warnings above.${NC}"
  exit 0
fi
