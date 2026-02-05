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
