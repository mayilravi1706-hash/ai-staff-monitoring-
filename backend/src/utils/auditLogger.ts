import { prisma } from '../config/database';
import { logger } from './logger';

export interface AuditLogOptions {
  userId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  beforeValue?: any;
  afterValue?: any;
  metadata?: any;
  tx?: any;
}

/**
 * Strips sensitive fields (passwords, tokens, hashes) from audit records.
 */
function sanitizeAuditPayload(data: any): any {
  if (!data || typeof data !== 'object') return data;
  const clone = Array.isArray(data) ? [...data] : { ...data };

  const sensitiveKeys = [
    'password',
    'password_hash',
    'passwordHash',
    'token',
    'token_hash',
    'tokenHash',
    'rawSessionToken',
    'sessionToken',
    'secret',
    'apiKey',
  ];

  for (const key of sensitiveKeys) {
    if (key in clone) {
      delete clone[key];
    }
  }

  return clone;
}

/**
 * Creates an immutable audit trail entry in PostgreSQL.
 */
export async function recordAuditLog(options: AuditLogOptions): Promise<void> {
  try {
    const sanitizedBefore = options.beforeValue
      ? JSON.stringify(sanitizeAuditPayload(options.beforeValue))
      : null;

    const sanitizedAfter = options.afterValue
      ? JSON.stringify(sanitizeAuditPayload(options.afterValue))
      : null;

    const sanitizedMeta = options.metadata
      ? JSON.stringify(sanitizeAuditPayload(options.metadata))
      : null;

    const db = options.tx || prisma;
    await db.auditLog.create({
      data: {
        user_id: options.userId || null,
        action: options.action,
        entity_type: options.entityType,
        entity_id: options.entityId,
        before_value: sanitizedBefore,
        after_value: sanitizedAfter,
        metadata: sanitizedMeta,
      },
    });
  } catch (error) {
    logger.error('Failed to write audit log record', error, 'AUDIT_LOG_ERROR');
  }
}
