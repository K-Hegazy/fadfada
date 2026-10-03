import nodemailer, { Transporter } from 'nodemailer';
import crypto from 'crypto';
import { Database as SqlDatabase } from 'sql.js';
import { queryOne, queryAll, saveDb } from './db.js';

export interface SendEmailOptions {
  to: string;
  username: string;
  token: string;
  code: string;
  baseUrl: string;
}

// Helper to check if production SMTP is configured
export function isSmtpConfigured(): boolean {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  return Boolean(host && user && pass);
}

// Create Nodemailer Transporter (Provider-Agnostic, 100% Real SMTP)
export function getTransporter(): Transporter | null {
  if (!isSmtpConfigured()) {
    return null;
  }

  const host = process.env.SMTP_HOST!.trim();
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER!.trim();
  const pass = process.env.SMTP_PASS!.trim();
  const isSecure = process.env.SMTP_SECURE === 'true' || port === 465;

  return nodemailer.createTransport({
    host,
    port,
    secure: isSecure,
    auth: { user, pass },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
    tls: {
      rejectUnauthorized: process.env.SMTP_IGNORE_TLS !== 'true'
    }
  });
}

export function buildVerificationHtml(options: SendEmailOptions): string {
  const { username, token, code, baseUrl } = options;
  const verifyLink = `${baseUrl.replace(/\/$/, '')}/verify-email?token=${token}`;

  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>تأكيد بريدك الإلكتروني - فضفضه</title>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background-color: #0a0a0a;
      color: #e5e5e5;
      margin: 0;
      padding: 24px;
      direction: rtl;
      text-align: right;
    }
    .card {
      max-width: 580px;
      margin: 0 auto;
      background: linear-gradient(145deg, #141414, #1a1a1a);
      border: 1px solid #2e2e2e;
      border-radius: 24px;
      padding: 36px 28px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
    }
    .logo-container {
      text-align: center;
      margin-bottom: 28px;
    }
    .logo {
      font-size: 32px;
      font-weight: 900;
      color: #10b981;
      letter-spacing: -0.5px;
      text-shadow: 0 2px 10px rgba(16, 185, 129, 0.3);
    }
    .subtitle {
      color: #9ca3af;
      font-size: 13px;
      margin-top: 4px;
    }
    h2 {
      color: #ffffff;
      font-size: 22px;
      margin-bottom: 12px;
    }
    p {
      color: #d1d5db;
      font-size: 14px;
      line-height: 1.8;
      margin: 12px 0;
    }
    .btn-container {
      text-align: center;
      margin: 32px 0 24px 0;
    }
    .verify-btn {
      display: inline-block;
      background: linear-gradient(135deg, #059669, #10b981);
      color: #ffffff !important;
      text-decoration: none;
      font-weight: bold;
      font-size: 15px;
      padding: 14px 36px;
      border-radius: 14px;
      box-shadow: 0 10px 25px rgba(16, 185, 129, 0.3);
    }
    .code-box {
      background: #0f0f0f;
      border: 1px dashed #10b981;
      border-radius: 14px;
      padding: 16px;
      text-align: center;
      margin: 24px 0;
    }
    .code-text {
      font-size: 28px;
      font-weight: bold;
      letter-spacing: 6px;
      color: #34d399;
      font-family: monospace;
    }
    .link-fallback {
      word-break: break-all;
      background: #111;
      padding: 12px;
      border-radius: 10px;
      font-size: 11px;
      color: #9ca3af;
      direction: ltr;
      text-align: left;
    }
    .footer {
      border-top: 1px solid #262626;
      margin-top: 32px;
      padding-top: 18px;
      text-align: center;
      font-size: 12px;
      color: #6b7280;
      line-height: 1.6;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo-container">
      <div class="logo">فضفضه ✨</div>
      <div class="subtitle">منصة التواصل الاجتماعي والدردشة الراقية</div>
    </div>

    <h2>مرحباً بك يا ${username}،</h2>
    <p>
      شكراً لانضمامك إلى مجتمع <strong>فضفضه</strong>. لإتمام تفعيل حسابك وحمايته بالكامل، يرجى تأكيد ملكيتك لهذا البريد الإلكتروني.
    </p>

    <div class="btn-container">
      <a href="${verifyLink}" class="verify-btn" target="_blank" rel="noopener noreferrer">
        تأكيد البريد الإلكتروني الآن
      </a>
    </div>

    <div class="code-box">
      <p style="margin: 0 0 8px 0; font-size: 12px; color: #9ca3af;">أو يمكنك إدخال رمز التحقق المباشر في المنصة:</p>
      <div class="code-text">${code}</div>
    </div>

    <p style="font-size: 12px; color: #9ca3af;">
      إذا لم يعمل الزر معك، يمكنك نسخ الرابط التالي وفتحه في المتصفح:
    </p>
    <div class="link-fallback">${verifyLink}</div>

    <div class="footer">
      تنتهي صلاحية هذا الرابط بعد 24 ساعة.<br>
      إذا لم تكن قد طلبت إنشاء أو ربط حساب في منصة فضفضه، يمكنك تجاهل هذه الرسالة بأمان.
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Creates an email verification record and dispatches the verification email.
 */
export async function createAndSendVerification(
  db: SqlDatabase,
  userId: string,
  email: string,
  username: string,
  baseUrl: string
): Promise<{ success: boolean; token: string; code: string; error?: string }> {
  try {
    const cleanEmail = email.trim().toLowerCase();

    // Invalidate prior pending verifications for this user
    db.run("DELETE FROM email_verifications WHERE user_id = ? AND verified_at IS NULL", [userId]);

    const id = 'vfy_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const token = crypto.randomBytes(32).toString('hex');
    const code = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digits
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours

    db.run(
      `INSERT INTO email_verifications (id, user_id, email, token, code, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, userId, cleanEmail, token, code, expiresAt]
    );
    saveDb();

    // Dispatch email
    const transporter = getTransporter();
    if (!transporter) {
      console.warn('[Email Verification] Real SMTP is not configured. Missing SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM.');
      return {
        success: false,
        token: '',
        code: '',
        error: 'خدمة إرسال البريد الإلكتروني غير مهيأة على الخادم حالياً. يرجى مراجعة إدارة المنصة.'
      };
    }

    const fromAddress = process.env.SMTP_FROM?.trim() || 'فضفضه <no-reply@fadfada.app>';
    const html = buildVerificationHtml({ to: cleanEmail, username, token, code, baseUrl });

    await transporter.sendMail({
      from: fromAddress,
      to: cleanEmail,
      subject: 'تأكيد بريدك الإلكتروني - منصة فضفضه 🌹',
      text: `مرحباً ${username}، رمز التحقق الخاص بك في فضفضه هو: ${code}\nأو اضغط على الرابط: ${baseUrl}/verify-email?token=${token}`,
      html
    });

    console.log(`[Email Verification] Verification email dispatched to: ${cleanEmail}`);

    return { success: true, token, code };
  } catch (err: any) {
    console.error('[Email Verification] Failed to send verification email:', err?.message || 'SMTP error');
    return {
      success: false,
      token: '',
      code: '',
      error: 'تعذر إرسال رسالة التحقق إلى بريدك الإلكتروني حالياً. يرجى التأكد من صحة البريد والمحاولة لاحقاً.'
    };
  }
}

/**
 * Verifies email using either token or 6-digit code server-side.
 */
export function verifyTokenOrCode(
  db: SqlDatabase,
  tokenOrCode: string
): { success: boolean; user?: any; error?: string } {
  const cleanInput = (tokenOrCode || '').trim();
  if (!cleanInput) {
    return { success: false, error: 'رمز التحقق أو الرابط غير صالح' };
  }

  // Find verification record matching token or code
  const record = queryOne(
    db,
    `SELECT v.*, u.username, u.role
     FROM email_verifications v
     JOIN users u ON v.user_id = u.id
     WHERE (v.token = ? OR v.code = ?)
       AND v.verified_at IS NULL
       AND v.expires_at > CURRENT_TIMESTAMP
     ORDER BY v.created_at DESC LIMIT 1`,
    [cleanInput, cleanInput]
  );

  if (!record) {
    return {
      success: false,
      error: 'رمز التحقق غير صالح أو انتهت صلاحيته (24 ساعة). يرجى طلب رمز جديد.'
    };
  }

  const now = new Date().toISOString();

  // Mark verification record as verified
  db.run("UPDATE email_verifications SET verified_at = ? WHERE id = ?", [now, record.id]);

  // Update user in users table
  db.run(
    "UPDATE users SET email = ?, email_verified = 1, email_verified_at = ? WHERE id = ?",
    [record.email, now, record.user_id]
  );

  saveDb();

  console.log(`[Email Verification] Successfully verified email for user: ${record.username} (${record.email})`);

  return {
    success: true,
    user: {
      id: record.user_id,
      username: record.username,
      email: record.email,
      emailVerified: true,
      emailVerifiedAt: now,
      role: record.role
    }
  };
}

/**
 * Builds HTML for password reset email
 */
export function buildPasswordResetHtml(options: { username: string; token: string; baseUrl: string }): string {
  const { username, token, baseUrl } = options;
  const resetLink = `${baseUrl.replace(/\/$/, '')}/reset-password?token=${token}`;

  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>إعادة تعيين كلمة المرور - فضفضه</title>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background-color: #0a0a0a;
      color: #e5e5e5;
      margin: 0;
      padding: 24px;
      direction: rtl;
      text-align: right;
    }
    .card {
      max-width: 580px;
      margin: 0 auto;
      background: linear-gradient(145deg, #141414, #1a1a1a);
      border: 1px solid #2e2e2e;
      border-radius: 24px;
      padding: 36px 28px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
    }
    .logo-container {
      text-align: center;
      margin-bottom: 28px;
    }
    .logo {
      font-size: 32px;
      font-weight: 900;
      color: #10b981;
      letter-spacing: -0.5px;
      text-shadow: 0 2px 10px rgba(16, 185, 129, 0.3);
    }
    .subtitle {
      color: #9ca3af;
      font-size: 13px;
      margin-top: 4px;
    }
    h2 {
      color: #ffffff;
      font-size: 22px;
      margin-bottom: 12px;
    }
    p {
      color: #d1d5db;
      font-size: 14px;
      line-height: 1.8;
      margin: 12px 0;
    }
    .btn-container {
      text-align: center;
      margin: 32px 0 24px 0;
    }
    .reset-btn {
      display: inline-block;
      background: linear-gradient(135deg, #059669, #10b981);
      color: #ffffff !important;
      text-decoration: none;
      font-weight: bold;
      font-size: 15px;
      padding: 14px 36px;
      border-radius: 14px;
      box-shadow: 0 10px 25px rgba(16, 185, 129, 0.3);
    }
    .link-fallback {
      word-break: break-all;
      background: #111;
      padding: 12px;
      border-radius: 10px;
      font-size: 11px;
      color: #9ca3af;
      direction: ltr;
      text-align: left;
    }
    .warning-box {
      background: #1a1608;
      border: 1px solid #78350f;
      border-radius: 12px;
      padding: 12px 16px;
      margin: 20px 0;
      font-size: 12px;
      color: #fde68a;
    }
    .footer {
      border-top: 1px solid #262626;
      margin-top: 32px;
      padding-top: 18px;
      text-align: center;
      font-size: 12px;
      color: #6b7280;
      line-height: 1.6;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo-container">
      <div class="logo">فضفضه 🔐</div>
      <div class="subtitle">إعادة تعيين كلمة المرور الآمنة</div>
    </div>

    <h2>مرحباً يا ${username}،</h2>
    <p>
      تلقينا طلباً لإعادة تعيين كلمة المرور الخاصة بحسابك في منصة <strong>فضفضه</strong>.
    </p>

    <div class="btn-container">
      <a href="${resetLink}" class="reset-btn" target="_blank" rel="noopener noreferrer">
        إعادة تعيين كلمة المرور الآن
      </a>
    </div>

    <div class="warning-box">
      ⚠️ <strong>ملاحظة أمنية:</strong> هذا الرابط صالح للاستخدام مرة واحدة فقط، وتنتهي صلاحيته تلقائياً خلال 60 دقيقة.
    </div>

    <p style="font-size: 12px; color: #9ca3af;">
      إذا لم يعمل الزر معك، يمكنك نسخ الرابط التالي ولصقه في متصفحك:
    </p>
    <div class="link-fallback">${resetLink}</div>

    <div class="footer">
      إذا لم تكن قد طلبت إعادة تعيين كلمة المرور، يمكنك تجاهل هذه الرسالة بأمان، وستظل كلمة المرور الحالية لحسابك كما هي دون أي تغيير.
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Creates and dispatches password reset email.
 * Prevents Email Enumeration by returning consistent message regardless of whether email exists.
 */
export async function createAndSendPasswordReset(
  db: SqlDatabase,
  email: string,
  baseUrl: string
): Promise<{ success: boolean; message: string }> {
  const genericSuccessMsg = 'إذا كان هذا البريد مسجلاً لدينا، فستصلك رسالة تحتوي على تعليمات ورابط إعادة تعيين كلمة المرور.';
  const cleanEmail = (email || '').trim().toLowerCase();

  if (!cleanEmail) {
    return { success: false, message: 'يرجى إدخال البريد الإلكتروني' };
  }

  // Find user by email
  const user = queryOne(
    db,
    "SELECT id, username, email FROM users WHERE LOWER(email) = LOWER(?)",
    [cleanEmail]
  );

  if (!user) {
    // Return generic message to prevent email enumeration attacks
    return { success: true, message: genericSuccessMsg };
  }

  try {
    // Invalidate previous pending resets for this user
    db.run(
      "UPDATE password_resets SET used_at = CURRENT_TIMESTAMP WHERE user_id = ? AND used_at IS NULL",
      [user.id]
    );

    const resetId = 'rst_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 60 minutes

    db.run(
      `INSERT INTO password_resets (id, user_id, email, token, expires_at)
       VALUES (?, ?, ?, ?, ?)`,
      [resetId, user.id, cleanEmail, token, expiresAt]
    );
    saveDb();

    // Dispatch email
    const transporter = getTransporter();
    if (!transporter) {
      console.warn('[Password Reset] Real SMTP is not configured. Missing SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM.');
      // Maintain anti-enumeration
      return { success: true, message: genericSuccessMsg };
    }

    const fromAddress = process.env.SMTP_FROM?.trim() || 'فضفضه <no-reply@fadfada.app>';
    const html = buildPasswordResetHtml({ username: user.username, token, baseUrl });

    await transporter.sendMail({
      from: fromAddress,
      to: cleanEmail,
      subject: 'طلب إعادة تعيين كلمة المرور - منصة فضفضه 🔐',
      text: `مرحباً ${user.username}، يمكنك إعادة تعيين كلمة المرور الخاصة بك عبر الرابط التالي: ${baseUrl}/reset-password?token=${token}`,
      html
    });

    console.log(`[Password Reset] Reset email sent to: ${cleanEmail}`);

    return { success: true, message: genericSuccessMsg };
  } catch (err: any) {
    console.error('[Password Reset] Error dispatching email:', err?.message || 'SMTP error');
    // Still return the generic message so we don't leak failure details
    return { success: true, message: genericSuccessMsg };
  }
}

/**
 * Verifies a password reset token
 */
export function verifyPasswordResetToken(
  db: SqlDatabase,
  token: string
): { valid: boolean; userId?: string; email?: string; username?: string; error?: string } {
  const cleanToken = (token || '').trim();
  if (!cleanToken) {
    return { valid: false, error: 'رمز إعادة التعيين مفقود' };
  }

  const record = queryOne(
    db,
    `SELECT r.*, u.username, u.password_hash, u.salt, u.role
     FROM password_resets r
     JOIN users u ON r.user_id = u.id
     WHERE r.token = ?
       AND r.used_at IS NULL
       AND r.expires_at > CURRENT_TIMESTAMP
     ORDER BY r.created_at DESC LIMIT 1`,
    [cleanToken]
  );

  if (!record) {
    return {
      valid: false,
      error: 'رابط إعادة التعيين غير صالح، أو انتهت صلاحيته (60 دقيقة)، أو تم استخدامه مسبقاً.'
    };
  }

  return {
    valid: true,
    userId: record.user_id,
    email: record.email,
    username: record.username
  };
}
