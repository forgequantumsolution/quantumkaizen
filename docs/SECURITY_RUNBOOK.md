# Security Runbook — Quantum Kaizen

## Incident Severity Matrix

| SEV | Condition | Response Time | Action |
|-----|-----------|--------------|--------|
| SEV-1 | Production down / data breach / active attack | 15 min | All hands |
| SEV-2 | Auth broken / >10% users affected / CRITICAL CVE | 30 min | On-call engineer |
| SEV-3 | Single module broken / HIGH CVE | 4 hours | Engineering team |
| SEV-4 | Minor bug / MEDIUM CVE | Next business day | Ticket + schedule |

---

## Responding to Alerts

### Brute Force / Auth Failure Spike
1. Check logs: `grep "LOGIN_FAILURE" logs/combined.log | wc -l`
2. Identify source IPs: `grep "LOGIN_FAILURE" logs/combined.log | jq '.ip' | sort | uniq -c | sort -rn`
3. If from single IP/range — block at nginx: add `deny <IP>;` to nginx.conf
4. If credential stuffing — enable CAPTCHA (set env `ENABLE_CAPTCHA=true`)
5. Notify affected users if accounts were accessed

### Exposed Secret / Credential Leak
1. **Immediately invalidate** the leaked credential (rotate JWT_SECRET, revoke API key)
2. Rotating JWT_SECRET invalidates ALL active sessions — users must re-login
3. Check git history: `git log --all --full-history -- "**/.env*"`
4. Remove from history if committed: `git filter-branch` or BFG Repo Cleaner
5. Notify affected users / downstream systems
6. Post-mortem within 48 hours

### Rotating JWT Secret (zero-downtime)
```bash
# 1. Generate new secret
NEW_SECRET=$(openssl rand -base64 48)

# 2. Update env var on all instances simultaneously
# (brief window where old tokens are invalid — acceptable for QMS)

# 3. Verify server restarts cleanly
curl https://app.quantumkaizen.io/health

# 4. Monitor auth failure rate for 5 minutes
```

### Rotating Database Password
```bash
# 1. Update password in PostgreSQL
docker exec -it qk-db psql -U postgres -c "ALTER USER postgres PASSWORD 'NEW_PASSWORD';"

# 2. Update DATABASE_URL env var and restart server
# 3. Verify /health/ready returns database: ok
```

### Dependency CVE — Emergency Patch
```bash
# 1. Identify affected package
npm audit --json | jq '.vulnerabilities'

# 2. Apply fix
cd server && npm audit fix
# or: npm install <package>@<patched-version>

# 3. Run tests
npm test

# 4. Deploy (tag a patch release)
git tag v<version>-patch && git push origin v<version>-patch
```

---

## Credential Rotation Schedule

| Secret | Rotation Frequency | How to Rotate |
|--------|-------------------|---------------|
| JWT_SECRET | Every 90 days (or immediately if exposed) | Update env var, restart server |
| JWT_REFRESH_SECRET | Every 90 days | Update env var, restart server (invalidates all refresh tokens) |
| DATABASE_URL password | Every 180 days | ALTER USER + update env var |
| S3_SECRET_KEY | Every 180 days | Generate new MinIO key + update env var |
| SMTP credentials | On provider renewal | Update env var |

---

## Post-Incident Review Template

```
## Incident Post-Mortem

**Date:** YYYY-MM-DD
**Severity:** SEV-X
**Duration:** X hours Y minutes
**Affected users:** N

### Timeline
- HH:MM — Alert fired / issue reported
- HH:MM — Engineer acknowledged
- HH:MM — Root cause identified
- HH:MM — Mitigation applied
- HH:MM — Service restored
- HH:MM — Post-mortem complete

### Root Cause (5 Whys)
1. Why did X happen? Because...
2. Why did that happen? Because...
3. Why? Because...
4. Why? Because...
5. Root cause: ...

### Impact
- Users affected:
- Data at risk:
- Business impact:

### What went well
-

### Action items
| Action | Owner | Due Date |
|--------|-------|----------|
| | | |
```
