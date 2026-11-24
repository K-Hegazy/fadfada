import { AppwriteException } from './config';

export function getAppwriteErrorType(error: unknown): string {
  if (error instanceof AppwriteException) return error.type || '';
  if (typeof error === 'object' && error !== null && 'type' in error) {
    return String((error as { type?: unknown }).type ?? '');
  }
  return '';
}

export function getAppwriteErrorCode(error: unknown): number {
  if (error instanceof AppwriteException) return error.code || 0;
  if (typeof error === 'object' && error !== null && 'code' in error) {
    return Number((error as { code?: unknown }).code ?? 0);
  }
  return 0;
}

export function parseAppwriteError(
  error: unknown,
  fallback = 'تعذر إتمام العملية عبر الخادم.'
): Error {
  if (error instanceof Error && !(error instanceof AppwriteException)) {
    return error;
  }

  const type = getAppwriteErrorType(error);
  const code = getAppwriteErrorCode(error);
  const rawMessage = error instanceof Error ? error.message : '';

  if (type === 'user_already_exists') {
    return new Error('هذا البريد الإلكتروني مسجل مسبقًا، جرّب تسجيل الدخول بدلاً من ذلك.');
  }
  if (type === 'user_invalid_credentials') {
    return new Error('البريد الإلكتروني أو كلمة المرور غير صحيحة.');
  }
  if (type === 'user_blocked' || code === 403) {
    return new Error('لا تملك صلاحية تنفيذ هذا الإجراء أو الحساب مقيد حاليًا.');
  }
  if (type === 'user_unauthorized' || type === 'general_unauthorized_scope' || code === 401) {
    return new Error('يجب تسجيل الدخول أولاً أو أن الجلسة الحالية منتهية.');
  }
  if (type === 'general_rate_limit_exceeded' || code === 429) {
    return new Error('محاولات متكررة كثيرة، يرجى الانتظار قليلاً ثم المحاولة مرة أخرى.');
  }
  if (type === 'storage_invalid_file_size') {
    return new Error('حجم الملف يتجاوز الحد المسموح به.');
  }
  if (type === 'storage_file_type_unsupported') {
    return new Error('نوع الملف غير مدعوم.');
  }
  if (type === 'user_password_mismatch') {
    return new Error('كلمة المرور غير متطابقة أو لا تستوفي الطول المطلوب (8 أحرف على الأقل).');
  }
  if (type === 'document_not_found' || type === 'row_not_found' || code === 404) {
    return new Error('العنصر المطلوب غير موجود أو تم حذفه.');
  }
  if (type === 'document_already_exists' || type === 'row_already_exists' || code === 409) {
    return new Error('هذا السجل موجود بالفعل.');
  }
  if (rawMessage) {
    return new Error(rawMessage);
  }
  return new Error(fallback);
}
