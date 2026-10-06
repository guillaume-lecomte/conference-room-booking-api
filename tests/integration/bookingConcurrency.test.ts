/**
 * Concurrency tests against a real PostgreSQL.
 *
 * They need only PostgreSQL (the cache and the event bus are mocked) and run
 * when DATABASE_URL is set:
 *
 *   DATABASE_URL=postgres://appuser:apppassword@localhost:5432/conference_booking \
 *     npx jest tests/integration/bookingConcurrency.test.ts
 */
import { database } from '../../src/infrastructure/database/connection';
import { PostgresBookingRepository } from '../../src/infrastructure/database/PostgresBookingRepository';
import { PostgresRoomRepository } from '../../src/infrastructure/database/PostgresRoomRepository';
import {
  BookingService,
  IdempotencyKeyReusedError,
  RoomUnavailableError,
} from '../../src/domain/services/BookingService';

jest.mock('../../src/infrastructure/cache/RedisCache', () => ({
  cache: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(true),
    deletePattern: jest.fn().mockResolvedValue(0),
  },
}));

jest.mock('../../src/infrastructure/events/EventBus', () => ({
  eventBus: { emit: jest.fn().mockReturnValue(false) },
  EventType: {
    BOOKING_CREATED: 'booking.created',
    BOOKING_CANCELLED: 'booking.cancelled',
    ROOM_UNAVAILABLE: 'room.unavailable',
  },
}));

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

describeWithDb('Booking concurrency (PostgreSQL)', () => {
  const roomId = '550e8400-e29b-41d4-a716-446655440003';
  const tag = `concurrency-${Date.now()}`;
  let service: BookingService;
  let dayOffset = 500;

  const nextSlot = (): { startTime: Date; endTime: Date } => {
    const startTime = new Date(Date.now() + dayOffset++ * 86400000);
    startTime.setUTCHours(10, 0, 0, 0);
    return { startTime, endTime: new Date(startTime.getTime() + 3600000) };
  };

  beforeAll(async () => {
    await database.initialize();
    await database.initializeTables();
    const pool = database.getPool();
    service = new BookingService(
      new PostgresBookingRepository(pool),
      new PostgresRoomRepository(pool)
    );
  });

  afterAll(async () => {
    await database.getPool().query('DELETE FROM bookings WHERE title LIKE $1', [`${tag}%`]);
    await database.close();
  });

  it('accepts exactly one of 20 simultaneous requests for the same slot', async () => {
    const slot = nextSlot();
    const results = await Promise.allSettled(
      Array.from({ length: 20 }, (_, i) =>
        service.createBooking({ roomId, userId: `user-${i}`, title: `${tag}-${i}`, ...slot })
      )
    );

    const accepted = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter(
      (r): r is PromiseRejectedResult => r.status === 'rejected'
    );

    expect(accepted).toHaveLength(1);
    expect(rejected).toHaveLength(19);
    rejected.forEach((r) => expect(r.reason).toBeInstanceOf(RoomUnavailableError));
  });

  it('allows back-to-back bookings of the same room', async () => {
    const first = nextSlot();
    const second = {
      startTime: first.endTime,
      endTime: new Date(first.endTime.getTime() + 3600000),
    };

    await service.createBooking({ roomId, userId: 'u', title: `${tag}-a`, ...first });
    await expect(
      service.createBooking({ roomId, userId: 'u', title: `${tag}-b`, ...second })
    ).resolves.toBeDefined();
  });

  it('frees the slot when a booking is cancelled', async () => {
    const slot = nextSlot();
    const booking = await service.createBooking({
      roomId,
      userId: 'u',
      title: `${tag}-cancel`,
      ...slot,
    });
    await service.cancelBooking(booking.id);

    await expect(
      service.createBooking({ roomId, userId: 'u', title: `${tag}-again`, ...slot })
    ).resolves.toBeDefined();
  });

  it('returns the same booking for 5 simultaneous requests with the same key', async () => {
    const slot = nextSlot();
    const request = {
      roomId,
      userId: 'u',
      title: `${tag}-idem`,
      idempotencyKey: `${tag}-key`,
      ...slot,
    };

    const results = await Promise.all(
      Array.from({ length: 5 }, () => service.createBooking(request))
    );

    expect(new Set(results.map((b) => b.id)).size).toBe(1);
  });

  it('rejects the same key sent with a different request', async () => {
    const slot = nextSlot();
    const key = `${tag}-reuse`;
    await service.createBooking({
      roomId,
      userId: 'u',
      title: `${tag}-first`,
      idempotencyKey: key,
      ...slot,
    });

    await expect(
      service.createBooking({
        roomId,
        userId: 'u',
        title: `${tag}-other`,
        idempotencyKey: key,
        ...slot,
      })
    ).rejects.toThrow(IdempotencyKeyReusedError);
  });
});
