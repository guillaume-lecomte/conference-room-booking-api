import request from 'supertest';
import { Application } from 'express';
import { createApp } from '../../src/app';
import { database } from '../../src/infrastructure/database/connection';
import { cache } from '../../src/infrastructure/cache/InMemoryCache';

describe('Booking API Integration Tests', () => {
  let app: Application;
  let createdBookingId: string;
  const roomId = '550e8400-e29b-41d4-a716-446655440001'; // Pre-seeded room

  beforeAll(async () => {
    app = await createApp();
  });

  afterAll(async () => {
    await cache.clear();
    await database.close();
  });

  describe('POST /api/bookings', () => {
    it('should create a booking successfully', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      futureDate.setHours(10, 0, 0, 0);
      
      const endDate = new Date(futureDate);
      endDate.setHours(11, 0, 0, 0);

      const response = await request(app)
        .post('/api/bookings')
        .send({
          roomId,
          userId: 'test-user-123',
          title: 'Integration Test Meeting',
          description: 'Testing the booking API',
          startTime: futureDate.toISOString(),
          endTime: endDate.toISOString(),
        })
        .expect(201);

      expect(response.body.status).toBe('success');
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.roomId).toBe(roomId);
      expect(response.body.data.status).toBe('CONFIRMED');
      
      createdBookingId = response.body.data.id;
    });

    it('should return same booking for duplicate idempotency key', async () => {
      const idempotencyKey = `idem-${Date.now()}`;
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 2);
      futureDate.setHours(14, 0, 0, 0);
      
      const endDate = new Date(futureDate);
      endDate.setHours(15, 0, 0, 0);

      const bookingData = {
        roomId,
        userId: 'test-user-456',
        title: 'Idempotent Meeting',
        startTime: futureDate.toISOString(),
        endTime: endDate.toISOString(),
      };

      // First request
      const response1 = await request(app)
        .post('/api/bookings')
        .set('Idempotency-Key', idempotencyKey)
        .send(bookingData)
        .expect(201);

      // Second request with same idempotency key
      const response2 = await request(app)
        .post('/api/bookings')
        .set('Idempotency-Key', idempotencyKey)
        .send(bookingData)
        .expect(201);

      expect(response1.body.data.id).toBe(response2.body.data.id);
    });

    it('should return 409 for conflicting booking', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 3);
      futureDate.setHours(10, 0, 0, 0);
      
      const endDate = new Date(futureDate);
      endDate.setHours(12, 0, 0, 0);

      // Create first booking
      await request(app)
        .post('/api/bookings')
        .send({
          roomId,
          userId: 'user-1',
          title: 'First Booking',
          startTime: futureDate.toISOString(),
          endTime: endDate.toISOString(),
        })
        .expect(201);

      // Try to create overlapping booking
      const response = await request(app)
        .post('/api/bookings')
        .send({
          roomId,
          userId: 'user-2',
          title: 'Conflicting Booking',
          startTime: futureDate.toISOString(),
          endTime: endDate.toISOString(),
        })
        .expect(409);

      expect(response.body.code).toBe('ROOM_UNAVAILABLE');
    });

    it('should return 400 for invalid data', async () => {
      const response = await request(app)
        .post('/api/bookings')
        .send({
          roomId: 'not-a-uuid',
          userId: '',
          title: '',
        })
        .expect(400);

      expect(response.body.code).toBe('VALIDATION_ERROR');
      expect(response.body.errors).toBeDefined();
    });

    it('should return 404 for non-existent room', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      
      const response = await request(app)
        .post('/api/bookings')
        .send({
          roomId: '550e8400-e29b-41d4-a716-000000000000',
          userId: 'test-user',
          title: 'Meeting',
          startTime: futureDate.toISOString(),
          endTime: new Date(futureDate.getTime() + 3600000).toISOString(),
        })
        .expect(404);

      expect(response.body.code).toBe('ROOM_NOT_FOUND');
    });
  });

  describe('GET /api/bookings/:id', () => {
    it('should get booking by id', async () => {
      const response = await request(app)
        .get(`/api/bookings/${createdBookingId}`)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.id).toBe(createdBookingId);
    });

    it('should return cached booking on second request', async () => {
      // First request (may hit cache or DB)
      await request(app)
        .get(`/api/bookings/${createdBookingId}`)
        .expect(200);

      // Second request (should use cache)
      const response = await request(app)
        .get(`/api/bookings/${createdBookingId}`)
        .expect(200);

      expect(response.body.data.id).toBe(createdBookingId);
    });

    it('should return 404 for non-existent booking', async () => {
      const response = await request(app)
        .get('/api/bookings/550e8400-e29b-41d4-a716-000000000000')
        .expect(404);

      expect(response.body.code).toBe('BOOKING_NOT_FOUND');
    });
  });

  describe('GET /api/bookings', () => {
    it('should list all bookings', async () => {
      const response = await request(app)
        .get('/api/bookings')
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.count).toBeGreaterThan(0);
    });

    it('should filter bookings by roomId', async () => {
      const response = await request(app)
        .get(`/api/bookings?roomId=${roomId}`)
        .expect(200);

      response.body.data.forEach((booking: { roomId: string }) => {
        expect(booking.roomId).toBe(roomId);
      });
    });

    it('should filter bookings by status', async () => {
      const response = await request(app)
        .get('/api/bookings?status=CONFIRMED')
        .expect(200);

      response.body.data.forEach((booking: { status: string }) => {
        expect(booking.status).toBe('CONFIRMED');
      });
    });
  });

  describe('PUT /api/bookings/:id/cancel', () => {
    it('should cancel a booking', async () => {
      const response = await request(app)
        .put(`/api/bookings/${createdBookingId}/cancel`)
        .send({ reason: 'Meeting cancelled' })
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.status).toBe('CANCELLED');
    });

    it('should return 409 for already cancelled booking', async () => {
      const response = await request(app)
        .put(`/api/bookings/${createdBookingId}/cancel`)
        .expect(409);

      expect(response.body.code).toBe('BOOKING_ALREADY_CANCELLED');
    });

    it('should return 404 for non-existent booking', async () => {
      const response = await request(app)
        .put('/api/bookings/550e8400-e29b-41d4-a716-000000000000/cancel')
        .expect(404);

      expect(response.body.code).toBe('BOOKING_NOT_FOUND');
    });
  });
});
