# Environment Variables

## Backend (`/backend/.env`)

Copy `.env.example` to `.env` and fill in the values:

```bash
cd backend
cp .env.example .env
```

---

### DATABASE_URL

**Required** | Type: `string` (PostgreSQL connection URL)

PostgreSQL connection string for Prisma.

```
DATABASE_URL="postgresql://neurofic:neurofic_dev@localhost:5432/neurofic_db"
```

For production, use a connection pooler (e.g., PgBouncer or Supabase connection pooling):
```
DATABASE_URL="postgresql://user:pass@host:5432/dbname?sslmode=require&connection_limit=10"
```

---

### JWT_SECRET

**Required** | Type: `string` (minimum 32 characters)

Secret key used to sign and verify JWT access tokens. Must be a long, random string. **Never commit this value.**

Generate a secure secret:
```bash
# Method 1: openssl
openssl rand -hex 32

# Method 2: Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Method 3: Python
python3 -c "import secrets; print(secrets.token_hex(32))"
```

The server will fail to start if this value is shorter than 32 characters.

---

### JWT_EXPIRES_IN

**Optional** | Type: `string` | Default: `"15m"`

Expiry duration for JWT access tokens. Uses the format accepted by the `@fastify/jwt` plugin.

Examples:
- `"15m"` — 15 minutes (recommended for production)
- `"1h"` — 1 hour
- `"7d"` — 7 days (not recommended; use refresh tokens instead)

---

### REFRESH_TOKEN_EXPIRES_IN

**Optional** | Type: `string` | Default: `"7d"`

Expiry duration for refresh tokens stored in the database.

Supported units: `m` (minutes), `h` (hours), `d` (days).

Examples: `"7d"`, `"30d"`, `"24h"`

---

### PORT

**Optional** | Type: `number` (1–65535) | Default: `3001`

Port on which the HTTP server listens.

```
PORT=3001
```

---

### NODE_ENV

**Optional** | Type: `"development" | "production" | "test"` | Default: `"development"`

Controls:
- Log format (pretty in dev, JSON in production)
- Whether stack traces are included in error responses (never in production)
- Prisma query logging (disabled in production)

---

### CORS_ORIGIN

**Required** | Type: `string` (valid URL)

The origin allowed to make cross-origin requests to the API.

```
# Local development
CORS_ORIGIN="http://localhost:5173"

# Production
CORS_ORIGIN="https://admin.neurofic.com"
```

---

### LOG_LEVEL

**Optional** | Type: `"error" | "warn" | "info" | "http" | "verbose" | "debug" | "silly"` | Default: `"info"`

Winston log level.

Recommended values:
- `"debug"` — local development
- `"info"` — staging / production
- `"warn"` — production (reduce noise)

---

## Frontend (`/frontend/.env`)

```bash
cd frontend
cp .env.example .env
```

### VITE_API_BASE_URL

**Optional** | Type: `string` | Default: `""` (empty — uses Vite proxy)

Base URL for the API. In development, leave empty and let the Vite dev server proxy `/api` to `localhost:3001`.

In production, set to the full API URL:
```
VITE_API_BASE_URL="https://api.neurofic.com"
```

### VITE_APP_TITLE

**Optional** | Type: `string` | Default: `"Neurofic Admin"`

Browser tab title.

---

## How to generate JWT_SECRET for production

```bash
# Generates a 64-character hex string (256 bits of entropy)
openssl rand -hex 32
# Example output: a3f2c1d4e5b6789012345678901234567890abcdef1234567890abcdef123456
```

Store this value in your production secrets manager (AWS Secrets Manager, HashiCorp Vault, GitHub Actions secrets, etc.). Never hardcode it in code or commit it to version control.

---

## Security checklist

- [ ] `JWT_SECRET` is at least 32 characters and randomly generated
- [ ] `.env` is in `.gitignore` (it is — check the project root)
- [ ] `NODE_ENV=production` in production deployments
- [ ] `CORS_ORIGIN` points to your actual frontend domain in production
- [ ] `DATABASE_URL` uses SSL in production (`?sslmode=require`)
- [ ] Secrets rotated if ever committed to version control
