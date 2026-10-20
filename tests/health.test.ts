import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../backend/src/app';

describe('GET /api/health', () => {
  it('should return 200 with status ok and valid response structure', async () => {
    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('data');
    expect(response.body.data).toHaveProperty('status', 'ok');
    expect(response.body.data).toHaveProperty('database');
    expect(response.body.data).toHaveProperty('version');
    expect(response.body.data).toHaveProperty('environment');
    expect(response.body.data).toHaveProperty('timestamp');
  });

  it('should return 404 for unknown endpoint with safe error response', async () => {
    const response = await request(app).get('/api/non-existent-endpoint');

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('success', false);
    expect(response.body.error).toHaveProperty('code', 'NOT_FOUND');
    expect(response.body.error).not.toHaveProperty('stack');
  });
});
