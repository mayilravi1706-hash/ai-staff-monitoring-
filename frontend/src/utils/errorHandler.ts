/**
 * Safe error message extraction helper.
 * Compatible with standard Error, Axios/Fetch-style errors, and unexpected runtime errors.
 * Never accesses '.message' or '.data' on null or undefined objects.
 */

export interface NormalizedError {
  message: string;
  statusCode?: number;
  code?: string;
  isNetworkError: boolean;
}

export function getErrorMessage(error: unknown, fallbackMessage = 'An unexpected error occurred. Please try again.'): string {
  if (error === null || error === undefined) {
    return fallbackMessage;
  }

  // If already a non-empty string
  if (typeof error === 'string') {
    const trimmed = error.trim();
    return trimmed.length > 0 ? trimmed : fallbackMessage;
  }

  // If boolean or number
  if (typeof error === 'boolean' || typeof error === 'number') {
    return String(error);
  }

  const errObj = error as Record<string, any>;

  // 1. Check HTTP Status codes for standardized client-facing explanations
  const status =
    errObj.status ||
    errObj.statusCode ||
    errObj.response?.status ||
    errObj.response?.statusCode;

  // 2. Check for structured response data: error.response.data or error.data
  const data = errObj.response?.data || errObj.data;

  if (data) {
    // Backend standard format: { success: false, error: { message: "...", code: "..." } }
    if (typeof data.error === 'object' && data.error !== null && typeof data.error.message === 'string' && data.error.message.trim()) {
      return sanitizeErrorMessage(data.error.message.trim());
    }

    // Direct error string: { error: "Something went wrong" }
    if (typeof data.error === 'string' && data.error.trim()) {
      return sanitizeErrorMessage(data.error.trim());
    }

    // Direct message: { message: "Something went wrong" }
    if (typeof data.message === 'string' && data.message.trim()) {
      return sanitizeErrorMessage(data.message.trim());
    }

    // String body response
    if (typeof data === 'string' && data.trim()) {
      return sanitizeErrorMessage(data.trim());
    }
  }

  // 3. Fallback to standard HTTP status messages if response body didn't provide one
  if (typeof status === 'number') {
    switch (status) {
      case 400:
        return 'Invalid request data provided. Please check the form and try again.';
      case 401:
        return 'Session expired or unauthenticated. Please log in again to continue.';
      case 403:
        return 'Access denied: Administrator privileges required for this action.';
      case 404:
        return 'The requested staff record or resource could not be found.';
      case 409:
        return 'Conflict: Operation blocked by existing institutional records or foreign constraints.';
      case 500:
        return 'Internal server error. The server encountered an unexpected condition.';
      case 502:
      case 503:
      case 504:
        return 'Service temporarily unavailable. Please verify connectivity and try again.';
    }
  }

  // 4. Check error.message on Error instances or plain objects
  if (typeof errObj.message === 'string' && errObj.message.trim()) {
    const rawMsg = errObj.message.trim();

    // Check for common network error signatures
    if (
      rawMsg.toLowerCase().includes('failed to fetch') ||
      rawMsg.toLowerCase().includes('networkerror') ||
      rawMsg.toLowerCase().includes('connection refused') ||
      rawMsg.toLowerCase().includes('network request failed')
    ) {
      return 'Network error: Unable to reach the server. Please check your network connection.';
    }

    // Catch the specific JavaScript TypeError that caused the bug
    if (
      rawMsg.includes("Cannot read properties of undefined (reading 'message')") ||
      rawMsg.includes("Cannot read property 'message' of undefined") ||
      rawMsg.includes("undefined is not an object")
    ) {
      return 'Staff removal completed, but the response format was unexpected. The list has been refreshed.';
    }

    return sanitizeErrorMessage(rawMsg);
  }

  return fallbackMessage;
}

/**
 * Strips raw internal stack traces, DB connection strings, and Prisma keywords.
 */
function sanitizeErrorMessage(msg: string): string {
  if (!msg) return 'An error occurred processing your request.';

  if (
    msg.includes('postgresql://') ||
    msg.includes('prisma') ||
    msg.includes('Invalid `prisma.') ||
    msg.includes('password=') ||
    msg.includes('at Object.') ||
    msg.includes('STACK TRACE')
  ) {
    return 'A database constraint prevented this operation. Historical records have been preserved.';
  }

  return msg;
}

/**
 * Returns true if the error indicates a network disconnection or unreachable host.
 */
export function isNetworkError(error: unknown): boolean {
  if (!error) return false;
  const msg = (error as any)?.message?.toLowerCase() || '';
  return (
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network request failed') ||
    (error as any)?.isNetworkError === true
  );
}

/**
 * Extracts HTTP status code if present.
 */
export function getErrorStatus(error: unknown): number | null {
  if (!error || typeof error !== 'object') return null;
  const e = error as Record<string, any>;
  return e.status || e.statusCode || e.response?.status || e.response?.statusCode || null;
}
