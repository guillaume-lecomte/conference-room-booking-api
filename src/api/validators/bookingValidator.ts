import { z } from 'zod';

/**
 * Booking Validation Schemas using Zod
 */

export const createBookingSchema = z.object({
  body: z.object({
    roomId: z.string().uuid('Invalid room ID format'),
    userId: z.string().min(1, 'User ID is required'),
    title: z.string()
      .min(1, 'Title is required')
      .max(255, 'Title must be less than 255 characters'),
    description: z.string()
      .max(1000, 'Description must be less than 1000 characters')
      .optional(),
    startTime: z.string()
      .datetime('Invalid start time format')
      .transform(val => new Date(val)),
    endTime: z.string()
      .datetime('Invalid end time format')
      .transform(val => new Date(val)),
  }).refine(data => data.endTime > data.startTime, {
    message: 'End time must be after start time',
    path: ['endTime'],
  }),
  headers: z.object({
    'idempotency-key': z.string().optional(),
  }).passthrough(),
});

export const getBookingSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid booking ID format'),
  }),
});

export const cancelBookingSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid booking ID format'),
  }),
  body: z.object({
    reason: z.string().max(500, 'Reason must be less than 500 characters').optional(),
  }).optional(),
});

export const listBookingsSchema = z.object({
  query: z.object({
    roomId: z.string().uuid().optional(),
    userId: z.string().optional(),
    status: z.enum(['PENDING', 'CONFIRMED', 'CANCELLED']).optional(),
    startTimeFrom: z.string().datetime().optional(),
    startTimeTo: z.string().datetime().optional(),
  }),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type GetBookingInput = z.infer<typeof getBookingSchema>;
export type CancelBookingInput = z.infer<typeof cancelBookingSchema>;
export type ListBookingsInput = z.infer<typeof listBookingsSchema>;
