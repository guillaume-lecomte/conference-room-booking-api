import { IBookingRepository } from '../repositories/IBookingRepository';
import { IRoomRepository } from '../repositories/IRoomRepository';
import { Booking, CreateBookingData, BookingStatus, BookingFilter } from '../entities/Booking';
import { eventBus, EventType, BookingCreatedEvent, BookingCancelledEvent } from '../../infrastructure/events/EventBus';
import { cache } from '../../infrastructure/cache/RedisCache';
import { config } from '../../config';
import { logger } from '../../infrastructure/logging/logger';

/**
 * Custom Error Classes for domain-specific errors
 */
export class BookingNotFoundError extends Error {
  constructor(id: string) {
    super(`Booking not found: ${id}`);
    this.name = 'BookingNotFoundError';
  }
}

export class RoomNotFoundError extends Error {
  constructor(id: string) {
    super(`Room not found: ${id}`);
    this.name = 'RoomNotFoundError';
  }
}

export class RoomUnavailableError extends Error {
  constructor(roomId: string, startTime: Date, endTime: Date) {
    super(`Room ${roomId} is not available from ${startTime.toISOString()} to ${endTime.toISOString()}`);
    this.name = 'RoomUnavailableError';
  }
}

export class BookingAlreadyCancelledError extends Error {
  constructor(id: string) {
    super(`Booking ${id} is already cancelled`);
    this.name = 'BookingAlreadyCancelledError';
  }
}

export class InvalidBookingTimeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidBookingTimeError';
  }
}

/**
 * Booking Service - Core business logic for booking operations
 * Implements clean architecture principles with dependency injection
 */
export class BookingService {
  constructor(
    private bookingRepository: IBookingRepository,
    private roomRepository: IRoomRepository
  ) {}

  /**
   * Create a new booking with idempotency support
   * Uses cache-aside pattern for idempotency keys
   */
  async createBooking(data: CreateBookingData): Promise<Booking> {
    // Check idempotency - return existing booking if key was used
    if (data.idempotencyKey) {
      const existingBooking = await this.checkIdempotency(data.idempotencyKey);
      if (existingBooking) {
        logger.info('Idempotent request - returning existing booking', { 
          bookingId: existingBooking.id,
          idempotencyKey: data.idempotencyKey 
        });
        return existingBooking;
      }
    }

    // Validate room exists
    const room = await this.roomRepository.findById(data.roomId);
    if (!room) {
      throw new RoomNotFoundError(data.roomId);
    }

    // Validate booking times
    this.validateBookingTimes(data.startTime, data.endTime);

    // Check for conflicts
    const conflicts = await this.bookingRepository.findConflictingBookings(
      data.roomId,
      data.startTime,
      data.endTime
    );

    if (conflicts.length > 0) {
      // Emit room unavailable event
      eventBus.emit(EventType.ROOM_UNAVAILABLE, {
        roomId: data.roomId,
        startTime: data.startTime,
        endTime: data.endTime,
        conflictingBookingId: conflicts[0].id,
        timestamp: new Date(),
      });
      throw new RoomUnavailableError(data.roomId, data.startTime, data.endTime);
    }

    // Create booking
    const booking = await this.bookingRepository.create(data);

    // Store idempotency key in cache
    if (data.idempotencyKey) {
      await cache.set(
        `idempotency:${data.idempotencyKey}`,
        booking.id,
        config.cache.idempotencyTtl
      );
    }

    // Cache the booking
    await cache.set(`booking:${booking.id}`, booking, config.cache.ttl);

    // Emit booking created event
    const event: BookingCreatedEvent = {
      booking,
      timestamp: new Date(),
    };
    eventBus.emit(EventType.BOOKING_CREATED, event);

    logger.info('Booking created', { bookingId: booking.id, roomId: booking.roomId });
    return booking;
  }

  /**
   * Get booking by ID with cache-aside pattern
   */
  async getBooking(id: string): Promise<Booking> {
    // Check cache first
    const cachedBooking = await cache.get<Booking>(`booking:${id}`);
    if (cachedBooking) {
      logger.debug('Booking retrieved from cache', { bookingId: id });
      return cachedBooking;
    }

    // Fetch from database
    const booking = await this.bookingRepository.findById(id);
    if (!booking) {
      throw new BookingNotFoundError(id);
    }

    // Store in cache
    await cache.set(`booking:${id}`, booking, config.cache.ttl);

    return booking;
  }

  /**
   * Get all bookings with optional filter
   */
  async getBookings(filter?: BookingFilter): Promise<Booking[]> {
    return this.bookingRepository.findAll(filter);
  }

  /**
   * Cancel a booking
   */
  async cancelBooking(id: string, reason?: string): Promise<Booking> {
    const booking = await this.bookingRepository.findById(id);
    
    if (!booking) {
      throw new BookingNotFoundError(id);
    }

    if (booking.status === BookingStatus.CANCELLED) {
      throw new BookingAlreadyCancelledError(id);
    }

    const updatedBooking = await this.bookingRepository.update(id, {
      status: BookingStatus.CANCELLED,
      cancelledAt: new Date(),
    });

    if (!updatedBooking) {
      throw new BookingNotFoundError(id);
    }

    // Invalidate cache
    await cache.delete(`booking:${id}`);

    // Emit cancellation event
    const event: BookingCancelledEvent = {
      booking: updatedBooking,
      reason,
      timestamp: new Date(),
    };
    eventBus.emit(EventType.BOOKING_CANCELLED, event);

    logger.info('Booking cancelled', { bookingId: id, reason });
    return updatedBooking;
  }

  /**
   * Check idempotency key
   */
  private async checkIdempotency(key: string): Promise<Booking | null> {
    // Check cache first
    const cachedBookingId = await cache.get<string>(`idempotency:${key}`);
    if (cachedBookingId) {
      return this.bookingRepository.findById(cachedBookingId);
    }

    // Check database
    return this.bookingRepository.findByIdempotencyKey(key);
  }

  /**
   * Validate booking times
   */
  private validateBookingTimes(startTime: Date, endTime: Date): void {
    const now = new Date();
    
    if (startTime < now) {
      throw new InvalidBookingTimeError('Start time cannot be in the past');
    }

    if (endTime <= startTime) {
      throw new InvalidBookingTimeError('End time must be after start time');
    }

    const durationMs = endTime.getTime() - startTime.getTime();
    const maxDurationMs = 8 * 60 * 60 * 1000; // 8 hours max
    
    if (durationMs > maxDurationMs) {
      throw new InvalidBookingTimeError('Booking duration cannot exceed 8 hours');
    }

    const minDurationMs = 15 * 60 * 1000; // 15 minutes min
    if (durationMs < minDurationMs) {
      throw new InvalidBookingTimeError('Booking duration must be at least 15 minutes');
    }
  }
}
