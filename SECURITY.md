# Security Policy — Quantum Kaizen

## Supported Versions

| Version | Supported |
|---------|-----------|
| Latest (main) | ✅ Actively supported |
| Older releases | ❌ No security patches |

## Reporting a Vulnerability

**Please do NOT open a public GitHub issue for security vulnerabilities.**

Report vulnerabilities privately to: **security@forgequantumsolution.com**

Include in your report:
- Description of the vulnerability
- Steps to reproduce
- Affected component (client / server / infrastructure)
- Potential impact assessment
- Any suggested fixes (optional)

### What to expect
| Milestone | Timeline |
|-----------|----------|
| Acknowledgement | Within 48 hours |
| Triage & severity assessment | Within 7 days |
| Fix or mitigation | Within SLA below |
| Public disclosure | Coordinated with reporter |

### Vulnerability SLA
| Severity | CVSS Score | Fix Within |
|----------|-----------|------------|
| Critical | 9.0 – 10.0 | 24 hours |
| High | 7.0 – 8.9 | 7 days |
| Medium | 4.0 – 6.9 | 30 days |
| Low | 0.1 – 3.9 | 90 days |

## Scope

**In scope:**
- `server/` — Express API, authentication, authorization
- `client/` — React frontend, Zustand auth store
- `docker-compose*.yml` — Container configuration
- CI/CD pipeline security
- Dependency vulnerabilities

**Out of scope:**
- Denial of service attacks
- Social engineering
- Physical security
- Third-party services (MinIO, PostgreSQL, Redis upstream vulnerabilities)

## Security Controls

This application implements:
- JWT authentication with short-lived access tokens (15 min) and refresh token rotation
- bcrypt password hashing (cost factor 12)
- Role-based access control (RBAC)
- Multi-tenant data isolation
- Input validation via Zod on all endpoints
- CSRF protection (double-submit cookie)
- HTTP security headers (Helmet + custom CSP, HSTS, CORP, COOP)
- Rate limiting (global + per-endpoint for auth routes)
- Parameterized queries via Prisma ORM
- Structured audit logging for all security events
- Container security (non-root users, minimal images)
- Secrets managed via environment variables (never committed to git)

## Security Architecture

```
Internet → Nginx (TLS, headers, rate limit) → Express API (auth middleware)
                                                        ↓
                                               PostgreSQL (Prisma ORM)
                                               Redis (session / rate limit)
                                               MinIO (file storage)
```

## Acknowledgements

We thank security researchers who responsibly disclose vulnerabilities.
Coordinated disclosures will be credited in release notes (with permission).
