import request from 'supertest';
import { Application } from 'express';
import { createApp } from '../../src/app';
import { database } from '../../src/infrastructure/database/connection';
import { cache } from '../../src/infrastructure/cache/InMemoryCache';

describe('Room API Integration Tests', () => {
  let app: Application;
  const roomId = '550e8400-e29b-41d4-a716-446655440001'; // Pre-seeded room

  beforeAll(async () => {
    app = await createApp();
  });

  afterAll(async () => {
    await cache.clear();
    await database.close();
  });

  describe('GET /api/rooms', () => {
    it('should list all rooms', async () => {
      const response = await request(app)
        .get('/api/rooms')
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.count).toBeGreaterThanOrEqual(3); // Pre-seeded rooms
    });
  });

  describe('GET /api/rooms/:id', () => {
    it('should get room by id', async () => {
      const response = await request(app)
        .get(`/api/rooms/${roomId}`)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.id).toBe(roomId);
      expect(response.body.data.name).toBe('Salle Einstein');
    });

    it('should return 404 for non-existent room', async () => {
      const response = await request(app)
        .get('/api/rooms/550e8400-e29b-41d4-a716-000000000000')
        .expect(404);

      expect(response.body.code).toBe('ROOM_NOT_FOUND');
    });

    it('should return 400 for invalid uuid format', async () => {
      const response = await request(app)
        .get('/api/rooms/invalid-uuid')
        .expect(400);

      expect(response.body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/rooms/:id/availability', () => {
    it('should get room availability', async () => {
      const today = new Date().toISOString().split('T')[0];
      
      const response = await request(app)
        .get(`/api/rooms/${roomId}/availability?date=${today}`)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.roomId).toBe(roomId);
      expect(response.body.data).toHaveProperty('availableSlots');
      expect(response.body.data).toHaveProperty('bookedSlots');
    });

    it('should return cached availability on second request', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split('T')[0];

      // First request
      await request(app)
        .get(`/api/rooms/${roomId}/availability?date=${dateStr}`)
        .expect(200);

      // Second request (should use cache)
      const response = await request(app)
        .get(`/api/rooms/${roomId}/availability?date=${dateStr}`)
        .expect(200);

      expect(response.body.data.roomId).toBe(roomId);
    });

    it('should return 400 for invalid date format', async () => {
      const response = await request(app)
        .get(`/api/rooms/${roomId}/availability?date=invalid-date`)
        .expect(400);

      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('should return 404 for non-existent room', async () => {
      const today = new Date().toISOString().split('T')[0];
      
      const response = await request(app)
        .get(`/api/rooms/550e8400-e29b-41d4-a716-000000000000/availability?date=${today}`)
        .expect(404);

      expect(response.body.code).toBe('ROOM_NOT_FOUND');
    });
  });

  describe('POST /api/rooms', () => {
    it('should create a new room', async () => {
      const response = await request(app)
        .post('/api/rooms')
        .send({
          name: 'New Test Room',
          capacity: 15,
          location: 'Building C - Floor 3',
          amenities: ['projector', 'video_conference'],
        })
        .expect(201);

      expect(response.body.status).toBe('success');
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.name).toBe('New Test Room');
      expect(response.body.data.capacity).toBe(15);
    });

    it('should return 400 for invalid room data', async () => {
      const response = await request(app)
        .post('/api/rooms')
        .send({
          name: '',
          capacity: -5,
        })
        .expect(400);

      expect(response.body.code).toBe('VALIDATION_ERROR');
    });
  });
});
