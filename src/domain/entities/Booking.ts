/**
 * Booking Entity - Pure domain object without external dependencies
 * Represents a conference room booking
 */
export enum BookingStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
}

export interface Booking {
  id: string;
  roomId: string;
  userId: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  status: BookingStatus;
  createdAt: Date;
  updatedAt: Date;
  cancelledAt?: Date;
  idempotencyKey?: string;
}

export interface CreateBookingData {
  roomId: string;
  userId: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  idempotencyKey?: string;
}

export interface BookingFilter {
  roomId?: string;
  userId?: string;
  status?: BookingStatus;
  startTimeFrom?: Date;
  startTimeTo?: Date;
}
