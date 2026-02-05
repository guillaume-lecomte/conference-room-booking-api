import { Router, Request, Response, NextFunction } from 'express';
import { RoomService } from '../../domain/services/RoomService';
import { validate } from '../middlewares/validationMiddleware';
import {
  getRoomSchema,
  getRoomAvailabilitySchema,
  createRoomSchema,
} from '../validators/roomValidator';

/**
 * Room Routes Factory
 * Creates room routes with injected service
 */
export function createRoomRoutes(roomService: RoomService): Router {
  const router = Router();

  /**
   * GET /api/rooms
   * List all rooms
   */
  router.get(
    '/',
    async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const rooms = await roomService.getAllRooms();

        res.json({
          status: 'success',
          data: rooms,
          count: rooms.length,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /api/rooms
   * Create a new room
   */
  router.post(
    '/',
    validate(createRoomSchema),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const room = await roomService.createRoom({
          name: req.body.name,
          capacity: req.body.capacity,
          location: req.body.location,
          amenities: req.body.amenities,
        });

        res.status(201).json({
          status: 'success',
          data: room,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /api/rooms/:id
   * Get a single room by ID
   */
  router.get(
    '/:id',
    validate(getRoomSchema),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const room = await roomService.getRoom(req.params.id);

        res.json({
          status: 'success',
          data: room,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /api/rooms/:id/availability
   * Get room availability for a specific date (with cache)
   */
  router.get(
    '/:id/availability',
    validate(getRoomAvailabilitySchema),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const date = req.query.date as unknown as Date;
        const availability = await roomService.getRoomAvailability(req.params.id, date);

        res.json({
          status: 'success',
          data: availability,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
