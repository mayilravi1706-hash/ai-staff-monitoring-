import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

let prismaClient: PrismaClient | null = null;
let keepaliveInterval: NodeJS.Timeout | null = null;

/**
 * Configure database URL with optimal connection pooling parameters if not already present.
 */
function getTunedDatabaseUrl(): string | undefined {
  const originalUrl = process.env.DATABASE_URL;
  if (!originalUrl) return originalUrl;

  try {
    if (originalUrl.startsWith('postgresql://') || originalUrl.startsWith('postgres://')) {
      const url = new URL(originalUrl);
      // Ensure pool limits and timeouts are tuned for serverless/cloud Postgres (Neon)
      if (!url.searchParams.has('connection_limit')) {
        url.searchParams.set('connection_limit', '10');
      }
      if (!url.searchParams.has('pool_timeout')) {
        url.searchParams.set('pool_timeout', '20');
      }
      if (!url.searchParams.has('connect_timeout')) {
        url.searchParams.set('connect_timeout', '15');
      }
      return url.toString();
    }
  } catch {
    // If URL parsing fails, fallback safely to original
    return originalUrl;
  }
  return originalUrl;
}

export function getPrismaClient(): PrismaClient {
  if (!prismaClient) {
    const dbUrl = getTunedDatabaseUrl();

    prismaClient = new PrismaClient({
      datasources: {
        db: {
          url: dbUrl,
        },
      },
      log: [
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'warn' },
      ],
    });

    // @ts-ignore prisma events
    prismaClient.$on('error', (e: unknown) => {
      const errObj = e as { message?: string; target?: string };
      const msg = typeof errObj?.message === 'string' ? errObj.message : String(e);

      // Cloud PostgreSQL (e.g. Neon, AWS RDS, PgBouncer) terminates idle sockets after timeout.
      // Quaint reports this as: "Error in PostgreSQL connection: Error { kind: Closed, cause: None }"
      // This is expected connection pool lifecycle behavior. Prisma automatically discards
      // the dead socket and re-establishes a fresh connection on subsequent queries.
      const isClosedOrRecycled =
        msg.includes('kind: Closed') ||
        msg.includes('connection closed') ||
        msg.includes('Connection reset') ||
        msg.includes('broken pipe') ||
        (errObj?.target === 'quaint::connector::postgres::native' && msg.includes('Closed'));

      if (isClosedOrRecycled) {
        logger.warn(
          'PostgreSQL connection closed by server pool (Prisma will automatically reconnect on next query)',
          'PRISMA_CONN_RECYCLED',
          { target: errObj?.target }
        );
      } else {
        logger.error('Prisma internal error', e, 'PRISMA_ERROR');
      }
    });

    // @ts-ignore prisma events
    prismaClient.$on('warn', (e: unknown) => {
      logger.warn('Prisma warning', 'PRISMA_WARN', { event: e });
    });
  }
  return prismaClient;
}

export const prisma = getPrismaClient();

/**
 * Lightweight periodic keepalive ping to prevent cloud PostgreSQL (Neon) from dropping idle sockets.
 */
export function startDatabaseKeepalive(intervalMs = 45000): void {
  if (keepaliveInterval) return;

  keepaliveInterval = setInterval(async () => {
    try {
      if (prismaClient) {
        await prismaClient.$queryRaw`SELECT 1`;
      }
    } catch {
      // Benign: Prisma will reconnect on subsequent queries
    }
  }, intervalMs);

  // Unref so this background keepalive does not block process exit or test runners
  if (keepaliveInterval.unref) {
    keepaliveInterval.unref();
  }
}

export function stopDatabaseKeepalive(): void {
  if (keepaliveInterval) {
    clearInterval(keepaliveInterval);
    keepaliveInterval = null;
  }
}

/**
 * Execute a database query with automatic retry on transient connection resets.
 */
export async function withDbRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 2,
  delayMs = 150
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await operation();
    } catch (err: unknown) {
      attempt++;
      const msg = err instanceof Error ? err.message : String(err);
      const isTransient =
        msg.includes('kind: Closed') ||
        msg.includes('connection closed') ||
        msg.includes('Connection reset') ||
        msg.includes('Can\'t reach database server');

      if (isTransient && attempt <= maxRetries) {
        logger.warn(`Transient PostgreSQL disconnect on attempt ${attempt}. Retrying query...`, 'DB_RETRY', { attempt });
        await new Promise((res) => setTimeout(res, delayMs));
        continue;
      }
      throw err;
    }
  }
}

export interface DatabaseHealthStatus {
  connected: boolean;
  latencyMs?: number;
  error?: string;
}

function sanitizeErrorMessage(msg: string): string {
  // Strip credentials from any postgresql:// URLs
  return msg
    .replace(/(postgres(?:ql)?:\/\/[^:]+:)([^@]+)(@)/gi, '$1*****$3')
    .trim();
}

export async function checkDatabaseHealth(): Promise<DatabaseHealthStatus> {
  const startTime = Date.now();
  try {
    // $queryRaw with retry is the standard and fastest way to verify database connection
    await withDbRetry(() => prisma.$queryRaw`SELECT 1`, 1, 100);
    const latencyMs = Date.now() - startTime;
    logger.logDbConnection('connected', { latencyMs });
    return { connected: true, latencyMs };
  } catch (err: unknown) {
    const rawMsg = err instanceof Error ? err.message : String(err);
    const sanitizedMsg = sanitizeErrorMessage(rawMsg);
    logger.logDbConnection('disconnected', { error: sanitizedMsg });
    return {
      connected: false,
      error: sanitizedMsg,
    };
  }
}
