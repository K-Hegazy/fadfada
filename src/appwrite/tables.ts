import {
  APPWRITE_CONFIG,
  assertAppwriteConfigured,
  ExecutionMethod,
  functions,
  tablesDB,
  type Models,
} from './config';
import { parseAppwriteError } from './errors';

export type AppwriteRow = Models.DefaultRow & Record<string, unknown>;

export function parseJsonField<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  if (typeof value === 'object') {
    return value as T;
  }
  return fallback;
}

export function serializeJsonField(value: unknown): string {
  return JSON.stringify(value ?? null);
}

export function normalizeAppDate(row: Partial<AppwriteRow>, key: 'createdAt' | 'updatedAt' | 'lastSeen' | 'visitedAt' | 'editedAt' | 'seenAt' | 'lastMessageAt'): string | null {
  const direct = row[key];
  if (typeof direct === 'string' && direct.trim().length > 0) return direct;
  if (typeof direct === 'number' && Number.isFinite(direct)) return new Date(direct).toISOString();
  if (key === 'createdAt' && typeof row.$createdAt === 'string') return row.$createdAt;
  if (key === 'updatedAt' && typeof row.$updatedAt === 'string') return row.$updatedAt;
  return null;
}

export async function listTableRows(
  tableId: string,
  queries: string[] = []
): Promise<AppwriteRow[]> {
  assertAppwriteConfigured();
  try {
    const res = await tablesDB.listRows<AppwriteRow>({
      databaseId: APPWRITE_CONFIG.databaseId,
      tableId,
      queries,
    });
    return res.rows;
  } catch (error) {
    throw parseAppwriteError(error);
  }
}

export async function getTableRow(
  tableId: string,
  rowId: string
): Promise<AppwriteRow | null> {
  assertAppwriteConfigured();
  try {
    return await tablesDB.getRow<AppwriteRow>({
      databaseId: APPWRITE_CONFIG.databaseId,
      tableId,
      rowId,
    });
  } catch (error) {
    const err = error as { code?: number };
    if (err?.code === 404) return null;
    throw parseAppwriteError(error);
  }
}

export async function createTableRow(
  tableId: string,
  rowId: string,
  data: Record<string, unknown>,
  permissions?: string[]
): Promise<AppwriteRow> {
  assertAppwriteConfigured();
  try {
    return await tablesDB.createRow<AppwriteRow>({
      databaseId: APPWRITE_CONFIG.databaseId,
      tableId,
      rowId,
      data,
      permissions,
    });
  } catch (error) {
    throw parseAppwriteError(error);
  }
}

export async function updateTableRow(
  tableId: string,
  rowId: string,
  data: Record<string, unknown>,
  permissions?: string[]
): Promise<AppwriteRow> {
  assertAppwriteConfigured();
  try {
    return await tablesDB.updateRow<AppwriteRow>({
      databaseId: APPWRITE_CONFIG.databaseId,
      tableId,
      rowId,
      data,
      permissions,
    });
  } catch (error) {
    throw parseAppwriteError(error);
  }
}

export async function upsertTableRow(
  tableId: string,
  rowId: string,
  data: Record<string, unknown>,
  permissions?: string[]
): Promise<AppwriteRow> {
  assertAppwriteConfigured();
  try {
    return await tablesDB.upsertRow<AppwriteRow>({
      databaseId: APPWRITE_CONFIG.databaseId,
      tableId,
      rowId,
      data,
      permissions,
    });
  } catch (error) {
    throw parseAppwriteError(error);
  }
}

export async function deleteTableRow(
  tableId: string,
  rowId: string
): Promise<void> {
  assertAppwriteConfigured();
  try {
    await tablesDB.deleteRow({
      databaseId: APPWRITE_CONFIG.databaseId,
      tableId,
      rowId,
    });
  } catch (error) {
    throw parseAppwriteError(error);
  }
}

interface FunctionApiResponse<T> {
  ok?: boolean;
  data?: T;
  error?: string;
}

export async function executeAppwriteFunction<T = unknown>(
  functionId: string,
  action: string,
  payload: Record<string, unknown> = {}
): Promise<T> {
  assertAppwriteConfigured();
  try {
    const execution = await functions.createExecution({
      functionId,
      body: JSON.stringify({ action, ...payload }),
      async: false,
      xpath: '/',
      method: ExecutionMethod.POST,
      headers: { 'content-type': 'application/json' },
    });

    const rawBody = execution.responseBody || '{}';
    let parsed: FunctionApiResponse<T> = {};
    try {
      parsed = JSON.parse(rawBody) as FunctionApiResponse<T>;
    } catch {
      if (execution.responseStatusCode >= 400 || execution.status === 'failed') {
        throw new Error(rawBody || 'فشل تنفيذ العملية على خادم Appwrite.');
      }
    }

    if (
      execution.status === 'failed' ||
      execution.responseStatusCode >= 400 ||
      parsed.ok === false
    ) {
      throw new Error(parsed.error || execution.errors || 'تعذر إتمام العملية.');
    }

    return (parsed.data ?? parsed) as T;
  } catch (error) {
    throw parseAppwriteError(error);
  }
}
