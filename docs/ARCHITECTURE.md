# Architecture — Neurofic Admin Dashboard

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Data Sources                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Google Sheets│  │  REST APIs   │  │   CSV Files  │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
└─────────┼────────────────┼────────────────┼────────────────────┘
          │                │                │
          └────────────────┴────────────────┘
                           │
                    ┌──────▼──────┐
                    │  Connector  │  (Stage 2+)
                    │   Engine    │
                    └──────┬──────┘
                           │  ETL
                    ┌──────▼──────────────────┐
                    │      PostgreSQL 16       │
                    │  (neurofic_db)           │
                    │  - usuarios              │
                    │  - refresh_tokens        │
                    │  - conectores            │
                    │  - sincronizaciones      │
                    │  - dashboards / widgets  │
                    │  - audit_log             │
                    └──────┬──────────────────┘
                           │
               ┌───────────┴───────────┐
               │                       │
        ┌──────▼──────┐       ┌────────▼────────┐
        │  Redis 7    │       │   Fastify API   │
        │  (cache)    │       │   Node.js 20    │
        └─────────────┘       └────────┬────────┘
                                       │  HTTP + JWT
                               ┌───────▼────────┐
                               │  React 18 SPA  │
                               │  Vite + Zustand│
                               └────────────────┘
                                       │
                               ┌───────▼────────┐
                               │   Browser      │
                               │  (clinic staff)│
                               └────────────────┘
```

---

## Tech Stack

### Backend

| Component | Technology | Justification |
|-----------|-----------|---------------|
| Runtime | Node.js 20 LTS | Stable, performant, large ecosystem |
| HTTP Server | Fastify 4 | 2-3x faster than Express, schema validation built-in, TypeScript-first |
| ORM | Prisma 5 | Type-safe queries, excellent migration tooling, auto-generated client |
| Database | PostgreSQL 16 | ACID compliant, JSON support, proven for healthcare data |
| Cache | Redis 7 | Sub-millisecond reads for dashboard data; session invalidation |
| Auth | JWT + Refresh Tokens | Stateless access tokens; revocable refresh tokens in DB |
| Validation | Zod | Runtime type safety, great TypeScript inference |
| Logging | Winston | Structured JSON logs, request ID correlation |

### Frontend

| Component | Technology | Justification |
|-----------|-----------|---------------|
| Bundler | Vite 5 | Instant HMR, optimized production builds |
| UI Library | React 18 | Concurrent features, stable ecosystem |
| Routing | React Router v6 | De-facto standard, data router ready |
| State | Zustand 4 | Minimal boilerplate, no context providers, devtools support |
| HTTP | Axios + React Query 5 | Axios for interceptors (token refresh); React Query for server state caching |
| Icons | Lucide React | Consistent, tree-shakable, MIT license |
| Types | TypeScript strict | Zero `any`, catches bugs at compile time |

---

## Connector Pattern

The connector system (Stage 2+) allows ingesting data from external sources without modifying the core schema:

```
Conector (config)
    │
    ▼
Sincronizacion (audit trail)
    │
    ▼
Business tables (raw data)
    │
    ▼
Dashboard / Widget (presentation layer)
```

Each `Conector` record stores:
- `tipo`: GOOGLE_SHEETS | REST_API | POSTGRESQL | CSV
- `config`: JSON blob with credentials/URLs (encrypted at rest in production)
- `ultimaSync`: timestamp of last successful sync

Each run creates a `Sincronizacion` record that tracks rows read, rows inserted, errors, and timing — providing a full audit trail without touching the business data.

---

## Data Flow

```
External Source
    │
    │ 1. Scheduled job / manual trigger
    ▼
Connector Engine (reads Conector.config)
    │
    │ 2. Fetch raw data
    ▼
Transform & Validate (Zod schemas)
    │
    │ 3. Upsert to PostgreSQL
    ▼
PostgreSQL (canonical store)
    │
    │ 4. Cache hot queries
    ▼
Redis (TTL-based cache)
    │
    │ 5. API query
    ▼
Fastify API (JSON response)
    │
    │ 6. HTTPS + JWT
    ▼
React SPA (React Query cache)
    │
    │ 7. Render
    ▼
Browser (clinic staff)
```

---

## Authentication Flow

```
Browser                 API                    Database
  │                      │                        │
  │─── POST /auth/login ─►│                        │
  │                      │── findByEmail ─────────►│
  │                      │◄── Usuario ─────────────│
  │                      │── bcrypt.compare ──────►│ (local)
  │                      │── createRefreshToken ──►│
  │◄── { accessToken,    │                        │
  │      refreshToken }  │                        │
  │                      │                        │
  │─── GET /api/auth/me ─►│                        │
  │   Authorization:     │── jwtVerify ───────────►│ (local)
  │   Bearer <AT>        │                        │
  │◄── { user } ─────────│                        │
  │                      │                        │
  │─── POST /auth/refresh►│                        │
  │   { refreshToken }   │── findRefreshToken ────►│
  │                      │── revokeRefreshToken ──►│ (rotation)
  │                      │── createRefreshToken ──►│ (new token)
  │◄── { accessToken } ──│                        │
```

---

## Folder Structure

### Backend (`/backend/src/`)

```
config/         # Environment validation, logger, Prisma client
controllers/    # Route handlers (thin layer, delegates to services)
services/       # Business logic (AuthService, etc.)
repositories/   # Database queries (UsuariosRepository, etc.)
routes/         # Route registration
middlewares/    # auth, rbac, validate, error handlers
types/          # Shared TypeScript interfaces
app.ts          # Fastify instance factory
index.ts        # Process entry point, graceful shutdown
```

### Frontend (`/frontend/src/`)

```
api/            # HTTP primitives (client.ts with interceptors, auth.ts)
components/ui/  # Reusable UI components
pages/          # Route-level page components
stores/         # Zustand state stores
hooks/          # Custom React hooks
types/          # Shared TypeScript interfaces
```

---

## Security Considerations

- Access tokens: short-lived (15 min), signed with HS256
- Refresh tokens: random 64 bytes, stored as SHA256 hash — raw token never in DB
- Token rotation: each refresh issues a new token and revokes the old one
- Token reuse detection: if a revoked token is used again, all user tokens are revoked
- Passwords: bcrypt with 12 rounds (~250ms per hash, brute-force resistant)
- Rate limiting: 5 login attempts per minute per IP
- CORS: strict origin allowlist
- Helmet: security headers on all responses
- Error handler: stack traces never sent to clients in production
- `.env` excluded from git; `JWT_SECRET` minimum 32 chars enforced at startup
