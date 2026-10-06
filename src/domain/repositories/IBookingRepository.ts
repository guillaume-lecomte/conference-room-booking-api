import { Booking, CreateBookingData, BookingFilter } from '../entities/Booking';

/**
 * Booking Repository Interface
 * Defines the contract for booking data persistence
 */
export interface IBookingRepository {
  create(data: CreateBookingData): Promise<Booking>;
  findById(id: string): Promise<Booking | null>;
  findByIdempotencyKey(key: string): Promise<Booking | null>;
  findAll(filter?: BookingFilter): Promise<Booking[]>;
  update(id: string, data: Partial<Booking>): Promise<Booking | null>;
  delete(id: string): Promise<boolean>;
  findConflictingBookings(
    roomId: string,
    startTime: Date,
    endTime: Date,
    excludeBookingId?: string
  ): Promise<Booking[]>;
}

/**
 * Raised by `create` when the database refuses the booking because it overlaps
 * an active booking of the same room.
 */
export class SlotConflictError extends Error {
  constructor() {
    super('The requested slot overlaps an existing booking');
    this.name = 'SlotConflictError';
  }
}

/**
 * Raised by `create` when another booking already uses the same idempotency key.
 */
export class DuplicateIdempotencyKeyError extends Error {
  constructor(public readonly idempotencyKey: string) {
    super(`Idempotency key already used: ${idempotencyKey}`);
    this.name = 'DuplicateIdempotencyKeyError';
  }
}
