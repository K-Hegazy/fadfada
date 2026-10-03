import crypto from 'crypto';
import { Database as SqlDatabase } from 'sql.js';
import { queryAll, queryOne, saveDb } from './db.js';

export interface UserSession {
  token: string;
  userId: string;
  username: string;
  email?: string;
  emailVerified?: boolean;
  emailVerifiedAt?: string | null;
  role: 'user' | 'moderator' | 'admin' | 'owner';
  gender: 'female' | 'male';
  country: string;
  vipLevel: string;
  isGuest: boolean;
  guestMessagesRemaining: number;
}

export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const actualSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, actualSalt, 64).toString('hex');
  return { hash, salt: actualSalt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const calculated = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(calculated), Buffer.from(hash));
}

export function calculateAge(dobString: string): number {
  const dob = new Date(dobString);
  if (isNaN(dob.getTime())) return 0;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

export function validate18Plus(dobString: string): boolean {
  const age = calculateAge(dobString);
  return age >= 18;
}

// Check session from Bearer or cookie
export function authenticateToken(db: SqlDatabase, token: string): UserSession | null {
  if (!token) return null;
  const row = queryOne(
    db,
    `SELECT s.token, s.user_id, u.username, u.email, u.email_verified, u.email_verified_at,
            u.role, u.gender, u.country, u.vip_level, u.is_guest,
            u.guest_messages_remaining, u.is_banned, u.is_muted
     FROM sessions s
     JOIN users u ON s.user_id = u.id
     WHERE s.token = ? AND s.expires_at > CURRENT_TIMESTAMP`,
    [token]
  );

  if (!row) return null;
  if (row.is_banned === 1) return null;

  // Touch session
  db.run("UPDATE sessions SET last_active_at = CURRENT_TIMESTAMP, is_online = 1 WHERE token = ?", [token]);
  saveDb();

  return {
    token: row.token,
    userId: row.user_id,
    username: row.username,
    email: row.email || '',
    emailVerified: row.email_verified === 1,
    emailVerifiedAt: row.email_verified_at || null,
    role: row.role,
    gender: row.gender,
    country: row.country,
    vipLevel: row.vip_level,
    isGuest: row.is_guest === 1,
    guestMessagesRemaining: row.guest_messages_remaining ?? 500
  };
}

export function createSession(db: SqlDatabase, userId: string): string {
  const token = crypto.randomBytes(32).toString('hex');
  // 30 days expiration
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  db.run(
    "INSERT INTO sessions (token, user_id, expires_at, is_online) VALUES (?, ?, ?, 1)",
    [token, userId, expiresAt]
  );
  saveDb();
  return token;
}
