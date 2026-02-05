import {
  createBookingSchema,
  cancelBookingSchema,
  listBookingsSchema,
} from '../../src/api/validators/bookingValidator';
import {
  getRoomAvailabilitySchema,
  createRoomSchema,
} from '../../src/api/validators/roomValidator';

describe('Validation Schemas', () => {
  describe('createBookingSchema', () => {
    it('should validate correct booking data', async () => {
      const validData = {
        body: {
          roomId: '550e8400-e29b-41d4-a716-446655440001',
          userId: 'user-123',
          title: 'Team Meeting',
          description: 'Weekly sync',
          startTime: '2024-12-20T10:00:00Z',
          endTime: '2024-12-20T11:00:00Z',
        },
        headers: { 'idempotency-key': 'unique-key' },
        params: {},
        query: {},
      };

      const result = await createBookingSchema.parseAsync(validData);
      expect(result.body.startTime).toBeInstanceOf(Date);
      expect(result.body.endTime).toBeInstanceOf(Date);
    });

    it('should reject invalid room ID format', async () => {
      const invalidData = {
        body: {
          roomId: 'not-a-uuid',
          userId: 'user-123',
          title: 'Meeting',
          startTime: '2024-12-20T10:00:00Z',
          endTime: '2024-12-20T11:00:00Z',
        },
        headers: {},
        params: {},
        query: {},
      };

      await expect(createBookingSchema.parseAsync(invalidData)).rejects.toThrow();
    });

    it('should reject when end time is before start time', async () => {
      const invalidData = {
        body: {
          roomId: '550e8400-e29b-41d4-a716-446655440001',
          userId: 'user-123',
          title: 'Meeting',
          startTime: '2024-12-20T12:00:00Z',
          endTime: '2024-12-20T11:00:00Z',
        },
        headers: {},
        params: {},
        query: {},
      };

      await expect(createBookingSchema.parseAsync(invalidData)).rejects.toThrow();
    });

    it('should reject empty title', async () => {
      const invalidData = {
        body: {
          roomId: '550e8400-e29b-41d4-a716-446655440001',
          userId: 'user-123',
          title: '',
          startTime: '2024-12-20T10:00:00Z',
          endTime: '2024-12-20T11:00:00Z',
        },
        headers: {},
        params: {},
        query: {},
      };

      await expect(createBookingSchema.parseAsync(invalidData)).rejects.toThrow();
    });
  });

  describe('cancelBookingSchema', () => {
    it('should validate cancel request with reason', async () => {
      const validData = {
        params: { id: '550e8400-e29b-41d4-a716-446655440001' },
        body: { reason: 'Meeting rescheduled' },
        headers: {},
        query: {},
      };

      const result = await cancelBookingSchema.parseAsync(validData);
      expect(result.params.id).toBeDefined();
      expect(result.body?.reason).toBe('Meeting rescheduled');
    });

    it('should validate cancel request without reason', async () => {
      const validData = {
        params: { id: '550e8400-e29b-41d4-a716-446655440001' },
        headers: {},
        query: {},
      };

      await expect(cancelBookingSchema.parseAsync(validData)).resolves.toBeDefined();
    });
  });

  describe('listBookingsSchema', () => {
    it('should validate filter parameters', async () => {
      const validData = {
        query: {
          roomId: '550e8400-e29b-41d4-a716-446655440001',
          status: 'CONFIRMED',
        },
        params: {},
        body: {},
        headers: {},
      };

      const result = await listBookingsSchema.parseAsync(validData);
      expect(result.query.status).toBe('CONFIRMED');
    });

    it('should reject invalid status', async () => {
      const invalidData = {
        query: { status: 'INVALID_STATUS' },
        params: {},
        body: {},
        headers: {},
      };

      await expect(listBookingsSchema.parseAsync(invalidData)).rejects.toThrow();
    });
  });

  describe('getRoomAvailabilitySchema', () => {
    it('should validate date format', async () => {
      const validData = {
        params: { id: '550e8400-e29b-41d4-a716-446655440001' },
        query: { date: '2024-12-20' },
        body: {},
        headers: {},
      };

      const result = await getRoomAvailabilitySchema.parseAsync(validData);
      expect(result.query.date).toBeInstanceOf(Date);
    });

    it('should reject invalid date format', async () => {
      const invalidData = {
        params: { id: '550e8400-e29b-41d4-a716-446655440001' },
        query: { date: '20-12-2024' },
        body: {},
        headers: {},
      };

      await expect(getRoomAvailabilitySchema.parseAsync(invalidData)).rejects.toThrow();
    });
  });

  describe('createRoomSchema', () => {
    it('should validate room creation data', async () => {
      const validData = {
        body: {
          name: 'Conference Room A',
          capacity: 10,
          location: 'Building A, Floor 2',
          amenities: ['projector', 'whiteboard'],
        },
        params: {},
        query: {},
        headers: {},
      };

      const result = await createRoomSchema.parseAsync(validData);
      expect(result.body.capacity).toBe(10);
    });

    it('should reject negative capacity', async () => {
      const invalidData = {
        body: {
          name: 'Room',
          capacity: -5,
          location: 'Building A',
          amenities: [],
        },
        params: {},
        query: {},
        headers: {},
      };

      await expect(createRoomSchema.parseAsync(invalidData)).rejects.toThrow();
    });
  });
});
