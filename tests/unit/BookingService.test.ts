import { BookingService, BookingNotFoundError, RoomUnavailableError, InvalidBookingTimeError } from '../../src/domain/services/BookingService';
import { IBookingRepository } from '../../src/domain/repositories/IBookingRepository';
import { IRoomRepository } from '../../src/domain/repositories/IRoomRepository';
import { Booking, BookingStatus, CreateBookingData } from '../../src/domain/entities/Booking';
import { Room } from '../../src/domain/entities/Room';

// Mock the cache
jest.mock('../../src/infrastructure/cache/RedisCache', () => ({
  cache: {
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
    deletePattern: jest.fn(),
  },
}));

// Mock the event bus
jest.mock('../../src/infrastructure/events/EventBus', () => ({
  eventBus: {
    emit: jest.fn(),
    on: jest.fn(),
    connect: jest.fn(),
  },
  EventType: {
    BOOKING_CREATED: 'booking.created',
    BOOKING_CANCELLED: 'booking.cancelled',
    ROOM_UNAVAILABLE: 'room.unavailable',
  },
}));

import { cache } from '../../src/infrastructure/cache/RedisCache';

describe('BookingService', () => {
  let bookingService: BookingService;
  let mockBookingRepository: jest.Mocked<IBookingRepository>;
  let mockRoomRepository: jest.Mocked<IRoomRepository>;

  const mockRoom: Room = {
    id: '550e8400-e29b-41d4-a716-446655440001',
    name: 'Test Room',
    capacity: 10,
    location: 'Building A',
    amenities: ['projector'],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockBooking: Booking = {
    id: '550e8400-e29b-41d4-a716-446655440010',
    roomId: mockRoom.id,
    userId: 'user-123',
    title: 'Test Meeting',
    startTime: new Date(Date.now() + 3600000), // 1 hour from now
    endTime: new Date(Date.now() + 7200000), // 2 hours from now
    status: BookingStatus.CONFIRMED,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock repositories
    mockBookingRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findByIdempotencyKey: jest.fn(),
      findAll: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findConflictingBookings: jest.fn(),
    };

    mockRoomRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      getAvailability: jest.fn(),
    };

    // Create service with mocked dependencies
    bookingService = new BookingService(mockBookingRepository, mockRoomRepository);

    // Reset cache mocks
    (cache.get as jest.Mock).mockResolvedValue(null);
    (cache.set as jest.Mock).mockResolvedValue(undefined);
    (cache.delete as jest.Mock).mockResolvedValue(true);
  });

  describe('createBooking', () => {
    const createBookingData: CreateBookingData = {
      roomId: mockRoom.id,
      userId: 'user-123',
      title: 'Test Meeting',
      startTime: new Date(Date.now() + 3600000),
      endTime: new Date(Date.now() + 7200000),
    };

    it('should create a booking successfully', async () => {
      mockRoomRepository.findById.mockResolvedValue(mockRoom);
      mockBookingRepository.findConflictingBookings.mockResolvedValue([]);
      mockBookingRepository.create.mockResolvedValue(mockBooking);

      const result = await bookingService.createBooking(createBookingData);

      expect(result).toEqual(mockBooking);
      expect(mockRoomRepository.findById).toHaveBeenCalledWith(createBookingData.roomId);
      expect(mockBookingRepository.findConflictingBookings).toHaveBeenCalled();
      expect(mockBookingRepository.create).toHaveBeenCalled();
    });

    it('should return existing booking for duplicate idempotency key', async () => {
      const idempotencyKey = 'unique-key-123';
      mockBookingRepository.findByIdempotencyKey.mockResolvedValue(mockBooking);

      const result = await bookingService.createBooking({
        ...createBookingData,
        idempotencyKey,
      });

      expect(result).toEqual(mockBooking);
      expect(mockBookingRepository.create).not.toHaveBeenCalled();
    });

    it('should throw RoomNotFoundError when room does not exist', async () => {
      mockRoomRepository.findById.mockResolvedValue(null);

      await expect(bookingService.createBooking(createBookingData))
        .rejects.toThrow('Room not found');
    });

    it('should throw RoomUnavailableError when there are conflicts', async () => {
      mockRoomRepository.findById.mockResolvedValue(mockRoom);
      mockBookingRepository.findConflictingBookings.mockResolvedValue([mockBooking]);

      await expect(bookingService.createBooking(createBookingData))
        .rejects.toThrow(RoomUnavailableError);
    });

    it('should throw InvalidBookingTimeError for past start time', async () => {
      const pastData = {
        ...createBookingData,
        startTime: new Date(Date.now() - 3600000), // 1 hour ago
      };

      mockRoomRepository.findById.mockResolvedValue(mockRoom);

      await expect(bookingService.createBooking(pastData))
        .rejects.toThrow(InvalidBookingTimeError);
    });

    it('should throw InvalidBookingTimeError when end time is before start time', async () => {
      const invalidData = {
        ...createBookingData,
        startTime: new Date(Date.now() + 7200000),
        endTime: new Date(Date.now() + 3600000),
      };

      mockRoomRepository.findById.mockResolvedValue(mockRoom);

      await expect(bookingService.createBooking(invalidData))
        .rejects.toThrow(InvalidBookingTimeError);
    });
  });

  describe('getBooking', () => {
    it('should return booking from cache if available', async () => {
      (cache.get as jest.Mock).mockResolvedValue(mockBooking);

      const result = await bookingService.getBooking(mockBooking.id);

      expect(result).toEqual(mockBooking);
      expect(mockBookingRepository.findById).not.toHaveBeenCalled();
    });

    it('should fetch from database and cache when not in cache', async () => {
      (cache.get as jest.Mock).mockResolvedValue(null);
      mockBookingRepository.findById.mockResolvedValue(mockBooking);

      const result = await bookingService.getBooking(mockBooking.id);

      expect(result).toEqual(mockBooking);
      expect(mockBookingRepository.findById).toHaveBeenCalledWith(mockBooking.id);
      expect(cache.set).toHaveBeenCalled();
    });

    it('should throw BookingNotFoundError when booking does not exist', async () => {
      (cache.get as jest.Mock).mockResolvedValue(null);
      mockBookingRepository.findById.mockResolvedValue(null);

      await expect(bookingService.getBooking('non-existent-id'))
        .rejects.toThrow(BookingNotFoundError);
    });
  });

  describe('cancelBooking', () => {
    it('should cancel booking successfully', async () => {
      const cancelledBooking = { ...mockBooking, status: BookingStatus.CANCELLED };
      mockBookingRepository.findById.mockResolvedValue(mockBooking);
      mockBookingRepository.update.mockResolvedValue(cancelledBooking);

      const result = await bookingService.cancelBooking(mockBooking.id, 'User request');

      expect(result.status).toBe(BookingStatus.CANCELLED);
      expect(cache.delete).toHaveBeenCalledWith(`booking:${mockBooking.id}`);
    });

    it('should throw BookingNotFoundError when booking does not exist', async () => {
      mockBookingRepository.findById.mockResolvedValue(null);

      await expect(bookingService.cancelBooking('non-existent-id'))
        .rejects.toThrow(BookingNotFoundError);
    });

    it('should throw error when booking is already cancelled', async () => {
      const cancelledBooking = { ...mockBooking, status: BookingStatus.CANCELLED };
      mockBookingRepository.findById.mockResolvedValue(cancelledBooking);

      await expect(bookingService.cancelBooking(mockBooking.id))
        .rejects.toThrow('already cancelled');
    });
  });

  describe('getBookings', () => {
    it('should return all bookings without filter', async () => {
      mockBookingRepository.findAll.mockResolvedValue([mockBooking]);

      const result = await bookingService.getBookings();

      expect(result).toHaveLength(1);
      expect(mockBookingRepository.findAll).toHaveBeenCalledWith(undefined);
    });

    it('should apply filter when provided', async () => {
      const filter = { roomId: mockRoom.id, status: BookingStatus.CONFIRMED };
      mockBookingRepository.findAll.mockResolvedValue([mockBooking]);

      await bookingService.getBookings(filter);

      expect(mockBookingRepository.findAll).toHaveBeenCalledWith(filter);
    });
  });
});
