import { useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/api.service';
import { HealthApiResponse } from '../types/api';

export function useHealth(pollIntervalMs = 15000) {
  const [data, setData] = useState<HealthApiResponse['data'] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiService.getHealth();
      setData(response.data);
      setLastChecked(new Date());
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unable to connect to backend server';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    if (pollIntervalMs > 0) {
      const interval = setInterval(fetchHealth, pollIntervalMs);
      return () => clearInterval(interval);
    }
  }, [fetchHealth, pollIntervalMs]);

  return { data, loading, error, lastChecked, refetch: fetchHealth };
}
