## Summary
<!-- What does this PR do? Why? -->

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Refactor
- [ ] Dependency update
- [ ] Security fix
- [ ] Documentation

---

## Security Checklist
> All boxes must be checked or marked N/A before merge.

### Secrets & Credentials
- [ ] No hardcoded secrets, API keys, tokens, or passwords
- [ ] No `.env` files committed
- [ ] New env vars added to `.env.example` and `scripts/validate-env.sh`

### Input & Data
- [ ] All new user inputs have server-side Zod validation
- [ ] No raw SQL — parameterized queries or Prisma ORM only
- [ ] File uploads validated (MIME type, size limit, renamed server-side)
- [ ] Sensitive data is NOT logged (passwords, tokens, PII)

### Authentication & Authorization
- [ ] New API endpoints have `verifyToken` middleware applied
- [ ] Authorization checks verify resource ownership (not just authentication)
- [ ] Role checks use `requireRole()` middleware

### Code Safety
- [ ] No `eval()`, `exec()`, or dynamic code execution with user input
- [ ] Error responses do not expose stack traces, paths, or DB errors to client
- [ ] New dependencies are from trusted sources and reviewed for CVEs
- [ ] `npm audit` passes at HIGH level for changed workspaces

### Testing
- [ ] Unit/integration tests written for new security-sensitive logic
- [ ] Existing tests still pass (`npm test`)

### Architecture
- [ ] Threat model updated if architecture changed (`docs/THREAT_MODEL.md`)
- [ ] API rate limits considered for new endpoints

---

## Test Plan
<!-- How was this tested? What should reviewers verify? -->

## Screenshots (if UI change)
