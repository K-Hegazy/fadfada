import {
  account,
  AppwriteException,
  assertAppwriteConfigured,
  ID,
  isAppwriteConfigured,
  OAuthProvider,
  type Models,
} from '../appwrite/config';
import { disconnectRealtime, subscribeToAccountEvents } from '../appwrite/realtime';
import { getAppBaseUrl } from '../utils/formatters';

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  emailVerified: boolean;
  isAnonymous: boolean;
  labels: string[];
}

function mapAppwriteUser(user: Models.User<Models.Preferences>): AuthUser {
  const email = user.email ? String(user.email) : null;
  const phone = user.phone ? String(user.phone) : '';
  const isAnonymous = !email && phone.length === 0;
  return {
    uid: user.$id,
    email,
    displayName: user.name ? String(user.name) : null,
    emailVerified: Boolean(user.emailVerification),
    isAnonymous,
    labels: Array.isArray(user.labels) ? user.labels : [],
  };
}

let cachedUser: AuthUser | null = null;
let initialCheckPromise: Promise<AuthUser | null> | null = null;
const authListeners = new Set<(user: AuthUser | null) => void>();
let accountRealtimeUnsub: (() => void) | null = null;

function syncAccountRealtimeSubscription(user: AuthUser | null): void {
  if (user && authListeners.size > 0) {
    if (!accountRealtimeUnsub) {
      accountRealtimeUnsub = subscribeToAccountEvents(() => {
        void refreshAuthSession();
      });
    }
    return;
  }

  if (accountRealtimeUnsub) {
    const unsub = accountRealtimeUnsub;
    accountRealtimeUnsub = null;
    unsub();
  }
}

function notifyListeners(user: AuthUser | null): void {
  cachedUser = user;
  syncAccountRealtimeSubscription(user);
  for (const listener of authListeners) {
    try {
      listener(user);
    } catch {
      // Ignore subscriber errors
    }
  }
}

export async function refreshAuthSession(): Promise<AuthUser | null> {
  if (!isAppwriteConfigured) {
    notifyListeners(null);
    return null;
  }
  try {
    const raw = await account.get();
    const mapped = mapAppwriteUser(raw);
    notifyListeners(mapped);
    return mapped;
  } catch (error) {
    if (error instanceof AppwriteException && (error.code === 401 || error.code === 403)) {
      notifyListeners(null);
      return null;
    }
    notifyListeners(null);
    return null;
  }
}

export function isAnonymousAuthDisabledError(error: unknown): boolean {
  if (error instanceof AppwriteException) {
    return (
      error.type === 'user_anonymous_not_allowed' ||
      error.type === 'general_access_forbidden' ||
      error.message.toLowerCase().includes('anonymous')
    );
  }
  return false;
}

export function translateAuthError(error: unknown): string {
  if (error instanceof AppwriteException) {
    switch (error.type) {
      case 'user_already_exists':
      case 'user_email_already_exists':
        return 'هذا البريد الإلكتروني مسجل مسبقًا، جرّب تسجيل الدخول بدلاً من ذلك.';
      case 'user_invalid_credentials':
        return 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
      case 'user_blocked':
        return 'تم تقييد هذا الحساب من مزود المصادقة.';
      case 'user_unauthorized':
      case 'general_unauthorized_scope':
        return 'انتهت الجلسة أو ليس لديك صلاحية كافية، أعد تسجيل الدخول.';
      case 'user_anonymous_not_allowed':
        return 'الدخول كضيف غير مفعّل حاليًا في إعدادات Appwrite Auth. يمكنك المتابعة بحساب Google أو البريد الإلكتروني.';
      case 'general_rate_limit_exceeded':
        return 'محاولات متكررة كثيرة، يرجى الانتظار قليلاً ثم المحاولة مرة أخرى.';
      case 'general_argument_invalid':
        return 'يرجى التأكد من صحة البريد الإلكتروني وأن كلمة المرور لا تقل عن 8 أحرف.';
      default:
        return error.message || 'حدث خطأ أثناء المصادقة مع Appwrite.';
    }
  }

  return error instanceof Error
    ? error.message
    : 'حدث خطأ غير متوقع أثناء المصادقة.';
}

export async function signInWithGoogle(): Promise<void> {
  assertAppwriteConfigured();
  const baseUrl = getAppBaseUrl();
  account.createOAuth2Session({
    provider: OAuthProvider.Google,
    success: baseUrl,
    failure: `${baseUrl}?auth_error=google`,
  });
}

export async function signInWithEmail(email: string, password: string): Promise<AuthUser> {
  assertAppwriteConfigured();
  await account.createEmailPasswordSession({
    email: email.trim(),
    password,
  });
  const user = await refreshAuthSession();
  if (!user) throw new Error('تعذر تحميل جلسة المستخدم بعد تسجيل الدخول.');
  return user;
}

export async function signUpWithEmail(
  email: string,
  password: string,
  displayName: string
): Promise<AuthUser> {
  assertAppwriteConfigured();
  const cleanEmail = email.trim();
  const cleanName = displayName.trim();
  await account.create({
    userId: ID.unique(),
    email: cleanEmail,
    password,
    name: cleanName || undefined,
  });
  await account.createEmailPasswordSession({
    email: cleanEmail,
    password,
  });
  try {
    await account.createVerification({
      url: `${getAppBaseUrl()}?verify=1`,
    });
  } catch {
    // Non-blocking if SMTP/verification URL is still being configured
  }
  const user = await refreshAuthSession();
  if (!user) throw new Error('تم إنشاء الحساب ولكن تعذر تفعيل الجلسة.');
  return user;
}

export async function signInAsGuest(): Promise<AuthUser> {
  assertAppwriteConfigured();
  await account.createAnonymousSession();
  const user = await refreshAuthSession();
  if (!user) throw new Error('تعذر بدء جلسة الضيف.');
  return user;
}

export async function upgradeGuestToMember(
  email: string,
  password: string,
  displayName?: string
): Promise<AuthUser> {
  assertAppwriteConfigured();
  await account.updateEmail({
    email: email.trim(),
    password,
  });
  if (displayName && displayName.trim()) {
    await account.updateName({ name: displayName.trim() });
  }
  try {
    await account.createVerification({
      url: `${getAppBaseUrl()}?verify=1`,
    });
  } catch {
    // Non-blocking
  }
  const user = await refreshAuthSession();
  if (!user) throw new Error('تمت الترقية ولكن تعذر تحديث الجلسة.');
  return user;
}

export async function resetPassword(email: string): Promise<void> {
  assertAppwriteConfigured();
  await account.createRecovery({
    email: email.trim(),
    url: `${getAppBaseUrl()}?recovery=1`,
  });
}

export async function completePasswordReset(
  userId: string,
  secret: string,
  password: string
): Promise<void> {
  assertAppwriteConfigured();
  await account.updateRecovery({
    userId,
    secret,
    password,
  });
}

export async function resendVerificationEmail(): Promise<void> {
  assertAppwriteConfigured();
  await account.createVerification({
    url: `${getAppBaseUrl()}?verify=1`,
  });
}

export async function completeEmailVerification(userId: string, secret: string): Promise<AuthUser | null> {
  assertAppwriteConfigured();
  await account.updateVerification({ userId, secret });
  return await refreshAuthSession();
}

export async function reloadAuthUser(): Promise<AuthUser | null> {
  return await refreshAuthSession();
}

export async function signOutUser(beforeSignOut?: () => Promise<void>): Promise<void> {
  if (beforeSignOut) {
    try {
      await beforeSignOut();
    } catch (error) {
      console.warn('Cleanup before sign-out encountered an error:', error);
    }
  }
  if (isAppwriteConfigured) {
    try {
      await account.deleteSession({ sessionId: 'current' });
    } catch {
      // Ignore already expired sessions
    }
    await disconnectRealtime();
  }
  notifyListeners(null);
}

export function subscribeToAuthChanges(callback: (user: AuthUser | null) => void): () => void {
  authListeners.add(callback);

  if (!initialCheckPromise) {
    initialCheckPromise = refreshAuthSession().finally(() => {
      initialCheckPromise = null;
    });
  } else {
    callback(cachedUser);
  }

  syncAccountRealtimeSubscription(cachedUser);

  return () => {
    authListeners.delete(callback);
    if (authListeners.size === 0) {
      syncAccountRealtimeSubscription(null);
    }
  };
}
