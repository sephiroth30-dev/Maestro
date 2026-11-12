# Authentication API Reference

Base URL: `http://localhost:3001`

All JSON bodies use `Content-Type: application/json`.

---

## Endpoints

### GET /api/health

Public. Returns server status.

**Response 200**
```json
{
  "status": "ok",
  "timestamp": "2026-05-22T15:00:00.000Z",
  "version": "0.1.0"
}
```

---

### POST /api/auth/login

Authenticates a user and returns tokens.

Rate limited: **5 requests per minute per IP**.

**Request body**
```json
{
  "email": "admin@neurofic.com",
  "password": "Neurofic2026!"
}
```

**Response 200**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "a3f2c1d4e5b6...(128 hex chars)...",
  "usuario": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "nombre": "Administrador",
    "email": "admin@neurofic.com",
    "rol": "ADMIN"
  }
}
```

**Response 400** — Invalid input
```json
{
  "error": "Bad Request",
  "message": "Invalid email format",
  "statusCode": 400
}
```

**Response 401** — Wrong credentials
```json
{
  "error": "Unauthorized",
  "message": "Invalid credentials",
  "statusCode": 401
}
```

**Response 429** — Rate limit exceeded
```json
{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Retry in 58 seconds.",
  "statusCode": 429
}
```

---

### POST /api/auth/refresh

Exchanges a refresh token for a new access token **and a new refresh token**. The used refresh token is revoked (single-use rotation) and the client **must store the new one**: the expiry is sliding, each renewal issues another token of `REFRESH_TOKEN_EXPIRES_IN` (7 d by default), so a session that keeps renewing never expires.

> **Historial (corregido en 1.9.11).** Antes el servidor revocaba el token usado, creaba uno nuevo y **no lo devolvía**; el cliente seguía con el revocado y en la **segunda** renovación (≈ 30 min) se interpretaba como robo y se cerraban todas las sesiones del usuario. La inactividad de 15 min lo disimulaba en el uso normal.
>
> **Reuso.** Un token ya revocado que reaparece **después de 10 s** se trata como robo: se revocan todos los refresh tokens del usuario. Dentro de esos 10 s (dos renovaciones simultáneas con el mismo token, p. ej. una pestaña duplicada) solo falla esa petición y **no** se cierra ninguna otra sesión.

**Request body**
```json
{
  "refreshToken": "a3f2c1d4e5b6...(128 hex chars)..."
}
```

**Response 200**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "9f1c...(128 hex chars, NUEVO)..."
}
```

**Response 401** — Invalid, expired, or already-revoked token
```json
{
  "error": "Unauthorized",
  "message": "Invalid refresh token",
  "statusCode": 401
}
```

---

### POST /api/auth/logout

Revokes the given refresh token. The access token remains valid until its 15-minute expiry (stateless JWT).

**Request body**
```json
{
  "refreshToken": "a3f2c1d4e5b6...(128 hex chars)..."
}
```

**Response 200**
```json
{
  "message": "Logged out successfully"
}
```

---

### GET /api/auth/me

Returns the profile of the currently authenticated user.

**Headers**
```
Authorization: Bearer <accessToken>
```

**Response 200**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "nombre": "Administrador",
  "email": "admin@neurofic.com",
  "rol": "ADMIN"
}
```

**Response 401** — Missing or invalid token
```json
{
  "error": "Unauthorized",
  "message": "Authentication required",
  "statusCode": 401
}
```

---

## JWT Token Lifecycle

```
Login
  │
  ├─► accessToken  (JWT, HS256, 15 minutes)
  │     Payload: { sub, email, rol, iat, exp }
  │
  └─► refreshToken (random 128 hex chars, 7 days)
            │
            │  Stored in DB as SHA256(token)
            │
            ▼
      POST /auth/refresh
            │
            ├─► Verify token exists & not revoked & not expired
            ├─► Revoke old token (rotation; atomic: only one of two simultaneous calls wins)
            ├─► Issue new accessToken AND new refreshToken (7 d, sliding)
            └─► Return { accessToken, refreshToken }
```

### Access Token Payload

```json
{
  "sub": "550e8400-e29b-41d4-a716-446655440000",
  "email": "admin@neurofic.com",
  "rol": "ADMIN",
  "iat": 1716390000,
  "exp": 1716390900
}
```

### Token Reuse Detection

If a **revoked** refresh token is used again **more than 10 s after it was revoked**:
1. All refresh tokens for that user are immediately revoked
2. A warning is logged with the user ID
3. The user must log in again

This detects token theft scenarios where an attacker uses a token after the legitimate user has already used it.

Within 10 s of the revocation (two simultaneous renewals with the same token) only that request is rejected and no other session is closed. "Within 10 s" and "expired" are computed **in SQL**: the pool returns dates as text (`dateStrings: true`), and comparing them in JS depends on Node's time zone (before 1.9.11 the expiry check never fired).

**Known limits.** A tab that copies its `sessionStorage` (duplicate tab) shares the refresh token with the original and is closed at its first renewal after the original renewed; with «Mantener sesión» the tabs stay in sync through the `storage` event. If a renewal response is lost in transit the client keeps the revoked token and the next renewal (after 10 s) is read as theft. There is no absolute session lifetime: a screen that keeps renewing stays logged in until someone logs out or the user is deactivated.

---

## RBAC Roles and Permissions

| Role | Level | Typical Access |
|------|-------|----------------|
| `ADMIN` | 1 | Full system access, user management |
| `GERENCIA` | 2 | All dashboards, reports, connector management |
| `DIRECCION` | 3 | Operational dashboards, KPI reports |
| `FACTURACION` | 4 | Billing dashboards, financial reports |
| `COORDINADORA` | 5 | Service coordination dashboards |
| `ADMISIONES` | 6 | Admissions dashboards |

### Permission Groups

| Group | Roles |
|-------|-------|
| `ADMIN_ONLY` | ADMIN |
| `MANAGEMENT` | ADMIN, GERENCIA, DIRECCION |
| `BILLING` | ADMIN, GERENCIA, FACTURACION |
| `VIEW_DASHBOARD` | All roles |
| `COORDINATION` | ADMIN, GERENCIA, DIRECCION, COORDINADORA |
| `ADMISSIONS` | ADMIN, GERENCIA, DIRECCION, ADMISIONES |

---

## Error Response Format

All errors follow this structure:

```json
{
  "error": "Error title",
  "message": "Human-readable message",
  "statusCode": 400,
  "requestId": "uuid-v4"
}
```

In development, a `stack` field is also included for 5xx errors.

---

## cURL Examples

```bash
# Health check
curl http://localhost:3001/api/health

# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@neurofic.com","password":"Neurofic2026!"}'

# Get current user
curl http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer <accessToken>"

# Refresh token
curl -X POST http://localhost:3001/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<refreshToken>"}'

# Logout
curl -X POST http://localhost:3001/api/auth/logout \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<refreshToken>"}'
```
