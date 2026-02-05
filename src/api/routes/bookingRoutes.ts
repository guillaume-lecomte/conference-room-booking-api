import { Router, Request, Response, NextFunction } from 'express';
import { BookingService } from '../../domain/services/BookingService';
import { validate } from '../middlewares/validationMiddleware';
import {
  createBookingSchema,
  getBookingSchema,
  cancelBookingSchema,
  listBookingsSchema,
} from '../validators/bookingValidator';
import { BookingStatus } from '../../domain/entities/Booking';

/**
 * Booking Routes Factory
 * Creates booking routes with injected service
 */
export function createBookingRoutes(bookingService: BookingService): Router {
  const router = Router();

  /**
   * POST /api/bookings
   * Create a new booking (idempotent via Idempotency-Key header)
   */
  router.post(
    '/',
    validate(createBookingSchema),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const idempotencyKey = req.headers['idempotency-key'] as string | undefined;
        
        const booking = await bookingService.createBooking({
          roomId: req.body.roomId,
          userId: req.body.userId,
          title: req.body.title,
          description: req.body.description,
          startTime: req.body.startTime,
          endTime: req.body.endTime,
          idempotencyKey,
        });

        res.status(201).json({
          status: 'success',
          data: booking,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /api/bookings
   * List all bookings with optional filters
   */
  router.get(
    '/',
    validate(listBookingsSchema),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const filter = {
          roomId: req.query.roomId as string | undefined,
          userId: req.query.userId as string | undefined,
          status: req.query.status as BookingStatus | undefined,
          startTimeFrom: req.query.startTimeFrom 
            ? new Date(req.query.startTimeFrom as string) 
            : undefined,
          startTimeTo: req.query.startTimeTo 
            ? new Date(req.query.startTimeTo as string) 
            : undefined,
        };

        const bookings = await bookingService.getBookings(filter);

        res.json({
          status: 'success',
          data: bookings,
          count: bookings.length,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /api/bookings/:id
   * Get a single booking by ID (with cache)
   */
  router.get(
    '/:id',
    validate(getBookingSchema),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const booking = await bookingService.getBooking(req.params.id);

        res.json({
          status: 'success',
          data: booking,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * PUT /api/bookings/:id/cancel
   * Cancel a booking
   */
  router.put(
    '/:id/cancel',
    validate(cancelBookingSchema),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const reason = req.body?.reason as string | undefined;
        const booking = await bookingService.cancelBooking(req.params.id, reason);

        res.json({
          status: 'success',
          data: booking,
          message: 'Booking cancelled successfully',
        });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
