import express, { Application, RequestHandler } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';

import { database } from './infrastructure/database/connection';
import { cache } from './infrastructure/cache/RedisCache';
import { eventBus } from './infrastructure/events/EventBus';
import { PostgresBookingRepository } from './infrastructure/database/PostgresBookingRepository';
import { PostgresRoomRepository } from './infrastructure/database/PostgresRoomRepository';
import { BookingService } from './domain/services/BookingService';
import { RoomService } from './domain/services/RoomService';
import { createBookingRoutes, createRoomRoutes, createHealthRoutes } from './api/routes';
import { errorHandler, notFoundHandler } from './api/middlewares/errorMiddleware';
import { rateLimit } from './api/middlewares/rateLimitMiddleware';
import { requestLogger } from './api/middlewares/requestLogger';
import { registerEventHandlers } from './infrastructure/events/handlers';
import { logger } from './infrastructure/logging/logger';

/**
 * Application Factory
 * Creates and configures the Express application
 */
export async function createApp(): Promise<Application> {
  const app = express();

  // Security middlewares
  app.use(helmet());
  app.use(cors());
  app.use(compression() as unknown as RequestHandler);

  // Body parsing
  app.use(express.json({ limit: '10kb' }));
  app.use(express.urlencoded({ extended: true }));

  // Request logging
  app.use(requestLogger);

  // Rate limiting (cast to fix type)
  app.use(rateLimit as unknown as RequestHandler);

  // Initialize infrastructure
  await database.initialize();
  await database.initializeTables();
  await cache.connect();
  await eventBus.connect();

  // Create repositories
  const pool = database.getPool();
  const bookingRepository = new PostgresBookingRepository(pool);
  const roomRepository = new PostgresRoomRepository(pool);

  // Create services with dependency injection
  const bookingService = new BookingService(bookingRepository, roomRepository);
  const roomService = new RoomService(roomRepository);

  // Register event handlers
  await registerEventHandlers();

  // API Routes
  app.use('/api/health', createHealthRoutes());
  app.use('/api/bookings', createBookingRoutes(bookingService));
  app.use('/api/rooms', createRoomRoutes(roomService));

  // Root endpoint
  app.get('/api', (_req, res) => {
    res.json({
      name: 'Conference Room Booking API',
      version: '1.0.0',
      documentation: '/api/docs',
      health: '/api/health',
      endpoints: {
        bookings: '/api/bookings',
        rooms: '/api/rooms',
      },
    });
  });

  // 404 handler
  app.use(notFoundHandler);

  // Global error handler
  app.use(errorHandler);

  return app;
}

/**
 * Graceful Shutdown Handler
 */
export async function gracefulShutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  try {
    // Close connections in order
    await eventBus.close();
    await cache.close();
    await database.close();

    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown', { error });
    process.exit(1);
  }
}
