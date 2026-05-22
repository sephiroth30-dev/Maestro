import bcrypt from 'bcryptjs';
import crypto from 'crypto';

// ─── Unit tests for auth logic (no DB, no HTTP) ───────────────────────────────

describe('Auth - Password hashing', () => {
  const BCRYPT_ROUNDS = 12;
  const RAW_PASSWORD = 'Neurofic2026!';

  it('should hash a password with bcrypt', async () => {
    const hash = await bcrypt.hash(RAW_PASSWORD, BCRYPT_ROUNDS);
    expect(hash).toBeTruthy();
    expect(hash).not.toEqual(RAW_PASSWORD);
  });

  it('should verify correct password against hash', async () => {
    const hash = await bcrypt.hash(RAW_PASSWORD, BCRYPT_ROUNDS);
    const isValid = await bcrypt.compare(RAW_PASSWORD, hash);
    expect(isValid).toBe(true);
  });

  it('should reject wrong password against hash', async () => {
    const hash = await bcrypt.hash(RAW_PASSWORD, BCRYPT_ROUNDS);
    const isValid = await bcrypt.compare('WrongPassword!', hash);
    expect(isValid).toBe(false);
  });
});

// ─── Token generation ──────────────────────────────────────────────────────────

describe('Auth - Refresh token generation', () => {
  function generateRefreshToken(): string {
    return crypto.randomBytes(64).toString('hex');
  }

  function hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  it('should generate a 128-char hex refresh token', () => {
    const token = generateRefreshToken();
    expect(token).toHaveLength(128);
    expect(token).toMatch(/^[a-f0-9]+$/);
  });

  it('should produce unique tokens on each call', () => {
    const token1 = generateRefreshToken();
    const token2 = generateRefreshToken();
    expect(token1).not.toEqual(token2);
  });

  it('should hash a token deterministically with SHA256', () => {
    const token = generateRefreshToken();
    const hash1 = hashToken(token);
    const hash2 = hashToken(token);
    expect(hash1).toEqual(hash2);
  });

  it('should produce 64-char hex SHA256 hash', () => {
    const token = generateRefreshToken();
    const hash = hashToken(token);
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[a-f0-9]+$/);
  });

  it('should produce different hashes for different tokens', () => {
    const token1 = generateRefreshToken();
    const token2 = generateRefreshToken();
    expect(hashToken(token1)).not.toEqual(hashToken(token2));
  });
});

// ─── Token expiry parsing ──────────────────────────────────────────────────────

describe('Auth - Expiry date parsing', () => {
  function parseExpiry(expiresIn: string): Date {
    const now = new Date();
    const unit = expiresIn.slice(-1);
    const value = parseInt(expiresIn.slice(0, -1), 10);

    switch (unit) {
      case 'm':
        now.setMinutes(now.getMinutes() + value);
        break;
      case 'h':
        now.setHours(now.getHours() + value);
        break;
      case 'd':
        now.setDate(now.getDate() + value);
        break;
      default:
        now.setSeconds(now.getSeconds() + parseInt(expiresIn, 10));
    }

    return now;
  }

  it('should add minutes correctly', () => {
    const before = Date.now();
    const expiry = parseExpiry('15m');
    const after = Date.now();

    const expectedMs = 15 * 60 * 1000;
    expect(expiry.getTime()).toBeGreaterThanOrEqual(before + expectedMs - 100);
    expect(expiry.getTime()).toBeLessThanOrEqual(after + expectedMs + 100);
  });

  it('should add hours correctly', () => {
    const before = Date.now();
    const expiry = parseExpiry('1h');
    const expectedMs = 60 * 60 * 1000;
    expect(expiry.getTime()).toBeGreaterThanOrEqual(before + expectedMs - 100);
  });

  it('should add days correctly', () => {
    const before = Date.now();
    const expiry = parseExpiry('7d');
    const expectedMs = 7 * 24 * 60 * 60 * 1000;
    expect(expiry.getTime()).toBeGreaterThanOrEqual(before + expectedMs - 100);
  });

  it('should produce a future date', () => {
    const expiry = parseExpiry('7d');
    expect(expiry.getTime()).toBeGreaterThan(Date.now());
  });
});

// ─── Input validation (Zod schemas) ───────────────────────────────────────────

describe('Auth - Input validation', () => {
  // Inline the schemas so tests don't depend on compiled app code
  const { z } = jest.requireActual<typeof import('zod')>('zod');

  const loginSchema = z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(1, 'Password is required'),
  });

  it('should accept valid login credentials', () => {
    const result = loginSchema.safeParse({
      email: 'admin@neurofic.com',
      password: 'Neurofic2026!',
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid email', () => {
    const result = loginSchema.safeParse({
      email: 'not-an-email',
      password: 'Neurofic2026!',
    });
    expect(result.success).toBe(false);
  });

  it('should reject empty password', () => {
    const result = loginSchema.safeParse({
      email: 'admin@neurofic.com',
      password: '',
    });
    expect(result.success).toBe(false);
  });

  it('should reject missing fields', () => {
    const result = loginSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
