export interface HealthApiResponse {
  success: boolean;
  data: {
    status: string;
    database: {
      status: 'connected' | 'disconnected';
      latencyMs?: number;
      error?: string;
    };
    version: string;
    environment: string;
    timestamp: string;
    uptimeSeconds: number;
  };
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
