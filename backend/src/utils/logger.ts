type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

interface StructuredLogPayload {
  level: LogLevel;
  timestamp: string;
  message: string;
  event?: string;
  context?: Record<string, unknown>;
  error?: {
    name?: string;
    message?: string;
    code?: string | number;
  };
}

class Logger {
  private formatLog(
    level: LogLevel,
    message: string,
    event?: string,
    context?: Record<string, unknown>,
    errorObj?: unknown
  ): string {
    // Sanitize any potential sensitive fields in context
    const sanitizedContext = context ? this.sanitize(context) : undefined;

    const payload: StructuredLogPayload = {
      level,
      timestamp: new Date().toISOString(),
      message,
      event,
      context: sanitizedContext,
    };

    if (errorObj instanceof Error) {
      payload.error = {
        name: errorObj.name,
        message: errorObj.message,
        code: (errorObj as { code?: string | number }).code,
      };
    } else if (errorObj && typeof errorObj === 'object') {
      payload.error = this.sanitize(errorObj as Record<string, unknown>);
    }

    return JSON.stringify(payload);
  }

  private sanitize(obj: Record<string, unknown>): Record<string, unknown> {
    const sensitiveKeys = ['password', 'password_hash', 'secret', 'key', 'token', 'authorization'];
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (sensitiveKeys.some((s) => key.toLowerCase().includes(s))) {
        result[key] = '[REDACTED]';
      } else if (value && typeof value === 'object' && !Array.isArray(value)) {
        result[key] = this.sanitize(value as Record<string, unknown>);
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  info(message: string, event?: string, context?: Record<string, unknown>) {
    console.log(this.formatLog('INFO', message, event, context));
  }

  warn(message: string, event?: string, context?: Record<string, unknown>) {
    console.warn(this.formatLog('WARN', message, event, context));
  }

  error(message: string, error?: unknown, event?: string, context?: Record<string, unknown>) {
    console.error(this.formatLog('ERROR', message, event, context, error));
  }

  debug(message: string, context?: Record<string, unknown>) {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(this.formatLog('DEBUG', message, undefined, context));
    }
  }

  // Specialized logging events
  logStartup(port: number, env: string, version: string) {
    this.info('Server started successfully', 'STARTUP', { port, env, version });
  }

  logDbConnection(status: 'connected' | 'disconnected' | 'error', details?: Record<string, unknown>) {
    if (status === 'connected') {
      this.info('Database connection established', 'DB_CONNECTION', details);
    } else {
      this.warn(`Database connection status: ${status}`, 'DB_CONNECTION', details);
    }
  }

  logApiError(reqPath: string, method: string, statusCode: number, error: unknown) {
    if (statusCode >= 500) {
      this.error(`API Error on ${method} ${reqPath} [${statusCode}]`, error, 'API_ERROR', {
        path: reqPath,
        method,
        statusCode,
      });
    } else if (statusCode === 401 && reqPath.includes('/auth/me')) {
      this.debug(`Session check on ${method} ${reqPath} [${statusCode}]`, {
        path: reqPath,
        method,
        statusCode,
      });
    } else {
      this.warn(`API Client Response on ${method} ${reqPath} [${statusCode}]`, 'CLIENT_RESPONSE', {
        path: reqPath,
        method,
        statusCode,
      });
    }
  }

  logShutdown(signal: string) {
    this.info(`Graceful shutdown initiated by signal ${signal}`, 'SHUTDOWN', { signal });
  }
}

export const logger = new Logger();
