# Quantum Kaizen

**Enterprise Quality Management & Continuous Improvement Platform**

Built by [Forge Quantum Solutions](https://forgequantum.com)

---

## Overview

Quantum Kaizen is a multi-tenant, enterprise-grade platform for managing quality, compliance, and continuous improvement across manufacturing and regulated industries. It provides integrated modules for document control, non-conformance management, CAPA tracking, risk management, training/LMS, audit trails with 21 CFR Part 11 electronic signatures, and approval workflows — all within a single, unified system.

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, TypeScript, Vite, TailwindCSS, Zustand, TanStack Query/Table, Recharts |
| **Backend** | Node.js 20, Express, TypeScript, Prisma ORM, Socket.IO |
| **Database** | PostgreSQL 16 |
| **Cache/Queue** | Redis 7, BullMQ |
| **Object Storage** | MinIO (S3-compatible) |
| **Auth** | JWT (access + refresh tokens), Passport.js, SAML 2.0 / OIDC (SSO-ready) |
| **Infrastructure** | Docker, Docker Compose, GitHub Actions CI/CD |

## Quick Start

### Prerequisites

- Node.js 20+
- Docker & Docker Compose
- Git

### Option A: Docker (Recommended)

```bash
# Clone the repository
git clone https://github.com/forge-quantum-solutions/quantum-kaizen.git
cd quantum-kaizen

# Start infrastructure services (Postgres, Redis, MinIO)
docker compose up -d

# Install dependencies
cd server && npm install && cd ..
cd client && npm install && cd ..

# Set up the database
cd server
npx prisma generate
npx prisma migrate dev
npm run db:seed
cd ..

# Start development servers (in separate terminals)
cd server && npm run dev
cd client && npm run dev
```

### Option B: Production Docker

```bash
# Copy and configure environment
cp .env.example .env
# Edit .env with production values

# Build and start all services
docker compose -f docker-compose.prod.yml up -d --build

# Run database migrations
docker compose -f docker-compose.prod.yml exec server npx prisma migrate deploy
```

### Default Login

| Field | Value |
|---|---|
| Tenant Code | `FORGE-QS` |
| Email | `admin@forgequantum.com` |
| Password | `QuantumK@izen2026` |

## Project Structure

```
quantum-kaizen/
|-- client/                     # React frontend (Vite)
|   |-- src/
|   |   |-- components/         # Reusable UI components
|   |   |-- pages/              # Route-level page components
|   |   |-- stores/             # Zustand state management
|   |   |-- hooks/              # Custom React hooks
|   |   |-- lib/                # API client, utilities
|   |   +-- types/              # TypeScript type definitions
|   |-- Dockerfile
|   +-- nginx.conf
|-- server/                     # Express API server
|   |-- src/
|   |   |-- config/             # App configuration, logger, passport
|   |   |-- controllers/        # Route handlers
|   |   |-- middleware/         # Auth, validation, security, logging
|   |   |-- routes/             # Express route definitions
|   |   |-- services/           # Business logic (email, reports, etc.)
|   |   |-- jobs/               # Scheduled background tasks
|   |   |-- lib/                # Prisma client instance
|   |   |-- utils/              # Shared utilities
|   |   +-- types/              # TypeScript declarations
|   |-- prisma/
|   |   |-- schema.prisma       # Database schema
|   |   +-- seed.ts             # Database seed data
|   +-- Dockerfile
|-- .github/workflows/          # CI/CD pipelines
|-- docker-compose.yml          # Development infrastructure
|-- docker-compose.prod.yml     # Production deployment
+-- README.md
```

## Core Modules

- **Document Management (DMS)** — 4-level document hierarchy, version control, acknowledgement tracking, expiry/review management
- **Non-Conformance (NC)** — Deviation and NC tracking with severity classification, containment actions, root cause analysis, disposition
- **CAPA** — Corrective and Preventive Action management linked to NCs, audits, and complaints with effectiveness verification
- **Risk Register** — 5x5 risk matrix, residual risk tracking, control measures, periodic review
- **Training/LMS** — Training programs, competency matrices, certification tracking with automatic expiry
- **Approval Workflows** — Configurable multi-stage approval with electronic signatures (21 CFR Part 11)
- **Audit Trail** — Immutable audit logging of all system actions with full before/after state capture
- **Notifications** — Real-time (Socket.IO) and email notifications for assignments, approvals, overdue items

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `PORT` | Server port | `5000` |
| `NODE_ENV` | Environment | `development` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:postgres@localhost:5432/quantum_kaizen` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `JWT_SECRET` | JWT signing secret | *(required in production)* |
| `JWT_REFRESH_SECRET` | Refresh token secret | *(required in production)* |
| `JWT_ACCESS_EXPIRY` | Access token TTL | `15m` |
| `JWT_REFRESH_EXPIRY` | Refresh token TTL | `7d` |
| `CORS_ORIGIN` | Allowed CORS origin | `http://localhost:3000` |
| `S3_ENDPOINT` | MinIO/S3 endpoint | `http://localhost:9000` |
| `S3_ACCESS_KEY` | S3 access key | `minioadmin` |
| `S3_SECRET_KEY` | S3 secret key | `minioadmin` |
| `S3_BUCKET` | S3 bucket name | `quantum-kaizen-docs` |
| `SMTP_HOST` | SMTP server host | `smtp.mailtrap.io` |
| `SMTP_PORT` | SMTP port | `587` |
| `SMTP_USER` | SMTP username | — |
| `SMTP_PASS` | SMTP password | — |
| `SMTP_FROM` | Sender address | `Quantum Kaizen <noreply@quantumkaizen.io>` |
| `SAML_ENTRY_POINT` | SAML IdP SSO URL | — |
| `SAML_ISSUER` | SAML SP entity ID | — |
| `SAML_CALLBACK_URL` | SAML ACS callback | — |
| `SAML_CERT` | SAML IdP certificate | — |
| `OIDC_ISSUER` | OIDC provider issuer | — |
| `OIDC_CLIENT_ID` | OIDC client ID | — |
| `OIDC_CLIENT_SECRET` | OIDC client secret | — |
| `OIDC_CALLBACK_URL` | OIDC redirect URI | — |

## API Overview

All API endpoints are prefixed with `/api/v1`. Authentication is required for all endpoints except login.

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/auth/login` | Authenticate user |
| `POST` | `/auth/refresh` | Refresh access token |
| `POST` | `/auth/logout` | Revoke session |
| `GET` | `/users` | List users (tenant-scoped) |
| `GET/POST` | `/documents` | List/create documents |
| `GET/PUT` | `/documents/:id` | Get/update document |
| `GET/POST` | `/non-conformances` | List/create NCs |
| `GET/PUT` | `/non-conformances/:id` | Get/update NC |
| `GET` | `/notifications` | List user notifications |
| `GET` | `/audit-logs` | Query audit trail |
| `GET` | `/dashboard/stats` | Dashboard statistics |

## Deployment

### Production Checklist

1. Set strong, unique values for `JWT_SECRET`, `JWT_REFRESH_SECRET`, `POSTGRES_PASSWORD`, `MINIO_ROOT_PASSWORD`
2. Configure SMTP for email notifications
3. Set `CORS_ORIGIN` to your production domain
4. Enable HTTPS via reverse proxy (nginx, Caddy, or cloud load balancer)
5. Run database migrations: `npx prisma migrate deploy`
6. Configure SSO (SAML/OIDC) if required
7. Set up monitoring and log aggregation
8. Configure backup strategy for PostgreSQL and MinIO data volumes

### Scaling

- The server is stateless and can be horizontally scaled behind a load balancer
- Use Redis for session affinity with Socket.IO in multi-instance deployments
- PostgreSQL supports read replicas for query-heavy workloads
- MinIO can be deployed in distributed mode for high availability

## License

**Proprietary** — Copyright 2024-2026 Forge Quantum Solutions. All rights reserved.

Unauthorized copying, modification, distribution, or use of this software, via any medium, is strictly prohibited without express written permission from Forge Quantum Solutions.
# quantumkaizen
