import { z } from 'zod';

/**
 * Room Validation Schemas using Zod
 */

export const getRoomSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid room ID format'),
  }),
});

export const getRoomAvailabilitySchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid room ID format'),
  }),
  query: z.object({
    date: z.string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
      .transform(val => new Date(val)),
  }),
});

export const createRoomSchema = z.object({
  body: z.object({
    name: z.string()
      .min(1, 'Name is required')
      .max(255, 'Name must be less than 255 characters'),
    capacity: z.number()
      .int('Capacity must be an integer')
      .min(1, 'Capacity must be at least 1')
      .max(1000, 'Capacity must be less than 1000'),
    location: z.string()
      .min(1, 'Location is required')
      .max(255, 'Location must be less than 255 characters'),
    amenities: z.array(z.string()).default([]),
  }),
});

export type GetRoomInput = z.infer<typeof getRoomSchema>;
export type GetRoomAvailabilityInput = z.infer<typeof getRoomAvailabilitySchema>;
export type CreateRoomInput = z.infer<typeof createRoomSchema>;
