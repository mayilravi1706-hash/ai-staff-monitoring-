import { prisma } from '../../config/database';
import { logger } from '../../utils/logger';

export interface CreateAuditLogOptions {
  userId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  beforeValue?: any;
  afterValue?: any;
  metadata?: any;
  tx?: any;
}

export interface GetAuditLogsParams {
  startDate?: string;
  endDate?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  userId?: string;
  role?: string;
  search?: string;
  page?: number;
  limit?: number;
}

/**
 * Sanitizes audit values to strictly prevent secret leakage (passwords, tokens, keys)
 */
export function sanitizeAuditValue(val: string | null): string | null {
  if (!val) return null;
  try {
    const obj = JSON.parse(val);
    if (typeof obj === 'object' && obj !== null) {
      const sanitized = { ...obj };
      const secretKeys = ['password', 'password_hash', 'token', 'sessionToken', 'secret', 'apiKey'];
      for (const k of Object.keys(sanitized)) {
        if (secretKeys.some((sk) => k.toLowerCase().includes(sk.toLowerCase()))) {
          sanitized[k] = '[REDACTED_SECRET]';
        }
      }
      return JSON.stringify(sanitized);
    }
  } catch {
    // String value
    if (/password|token|secret|key/i.test(val)) {
      return '[REDACTED_SECRET]';
    }
  }
  return val;
}

export async function getFilteredAuditLogs(params: GetAuditLogsParams) {
  const {
    startDate,
    endDate,
    action,
    entityType,
    entityId,
    userId,
    role,
    search,
    page = 1,
    limit = 50,
  } = params;

  const where: any = {};

  if (action) where.action = action;
  if (entityType) where.entity_type = entityType;
  if (entityId) where.entity_id = entityId;
  if (userId) where.user_id = userId;

  if (role) {
    where.user = { role: role as any };
  }

  if (startDate || endDate) {
    where.created_at = {};
    if (startDate) where.created_at.gte = new Date(startDate);
    if (endDate) where.created_at.lte = new Date(endDate);
  }

  if (search && search.trim()) {
    const query = search.trim();
    where.OR = [
      { action: { contains: query, mode: 'insensitive' } },
      { entity_type: { contains: query, mode: 'insensitive' } },
      { entity_id: { contains: query, mode: 'insensitive' } },
      { metadata: { contains: query, mode: 'insensitive' } },
      { user: { email: { contains: query, mode: 'insensitive' } } },
    ];
  }

  const skip = (page - 1) * limit;

  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip,
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            staff: {
              select: {
                id: true,
                staff_id: true,
                full_name: true,
                department: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    }),
  ]);

  const sanitizedLogs = logs.map((log) => ({
    ...log,
    before_value: sanitizeAuditValue(log.before_value),
    after_value: sanitizeAuditValue(log.after_value),
    metadata: sanitizeAuditValue(log.metadata),
  }));

  return {
    logs: sanitizedLogs,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

export async function createAuditLog(options: CreateAuditLogOptions) {
  try {
    const db = options.tx || prisma;
    return await db.auditLog.create({
      data: {
        user_id: options.userId || null,
        action: options.action,
        entity_type: options.entityType,
        entity_id: options.entityId,
        before_value: options.beforeValue
          ? typeof options.beforeValue === 'string'
            ? options.beforeValue
            : JSON.stringify(options.beforeValue)
          : null,
        after_value: options.afterValue
          ? typeof options.afterValue === 'string'
            ? options.afterValue
            : JSON.stringify(options.afterValue)
          : null,
        metadata: options.metadata
          ? typeof options.metadata === 'string'
            ? options.metadata
            : JSON.stringify(options.metadata)
          : null,
      },
    });
  } catch (error) {
    logger.error('Failed to create audit log', error, 'AUDIT_LOG_ERROR');
    return null;
  }
}
