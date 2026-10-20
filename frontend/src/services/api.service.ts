import { HealthApiResponse } from '../types/api';

class ApiService {
  private baseUrl = '/api';

  async getHealth(): Promise<HealthApiResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to reach health service`);
      }

      const data: HealthApiResponse = await response.json();
      return data;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Network error or backend unreachable';
      throw new Error(message);
    }
  }
}

export const apiService = new ApiService();
