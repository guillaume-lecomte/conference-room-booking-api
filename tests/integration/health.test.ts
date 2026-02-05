import request from 'supertest';
import { Application } from 'express';
import { createApp } from '../../src/app';
import { database } from '../../src/infrastructure/database/connection';

describe('Health Check Integration Tests', () => {
  let app: Application;

  beforeAll(async () => {
    app = await createApp();
  });

  afterAll(async () => {
    await database.close();
  });

  describe('GET /api/health', () => {
    it('should return healthy status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body.status).toBe('healthy');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body.checks.database).toBe('healthy');
      expect(response.body.checks.cache).toBe('healthy');
    });
  });

  describe('GET /api/health/ready', () => {
    it('should return ready status', async () => {
      const response = await request(app)
        .get('/api/health/ready')
        .expect(200);

      expect(response.body.status).toBe('ready');
    });
  });

  describe('GET /api/health/live', () => {
    it('should return alive status', async () => {
      const response = await request(app)
        .get('/api/health/live')
        .expect(200);

      expect(response.body.status).toBe('alive');
    });
  });

  describe('GET /api/metrics', () => {
    it('should return application metrics', async () => {
      const response = await request(app)
        .get('/api/health/metrics')
        .expect(200);

      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('memory');
      expect(response.body.memory).toHaveProperty('heapUsed');
      expect(response.body).toHaveProperty('cache');
    });
  });
});
