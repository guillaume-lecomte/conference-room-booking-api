import { Request, Response, NextFunction } from 'express';
import { logger } from '../../infrastructure/logging/logger';
import {
  BookingNotFoundError,
  RoomNotFoundError,
  RoomUnavailableError,
  BookingAlreadyCancelledError,
  InvalidBookingTimeError,
} from '../../domain/services/BookingService';
import { RoomNotFoundError as RoomServiceNotFoundError } from '../../domain/services/RoomService';

/**
 * Error Response Interface
 */
interface ErrorResponse {
  status: 'error';
  code: string;
  message: string;
  details?: unknown;
  stack?: string;
}

/**
 * HTTP Error Class for API errors
 */
export class HttpError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

/**
 * Map domain errors to HTTP status codes
 */
function mapDomainError(error: Error): { statusCode: number; code: string } {
  if (error instanceof BookingNotFoundError) {
    return { statusCode: 404, code: 'BOOKING_NOT_FOUND' };
  }
  if (error instanceof RoomNotFoundError || error instanceof RoomServiceNotFoundError) {
    return { statusCode: 404, code: 'ROOM_NOT_FOUND' };
  }
  if (error instanceof RoomUnavailableError) {
    return { statusCode: 409, code: 'ROOM_UNAVAILABLE' };
  }
  if (error instanceof BookingAlreadyCancelledError) {
    return { statusCode: 409, code: 'BOOKING_ALREADY_CANCELLED' };
  }
  if (error instanceof InvalidBookingTimeError) {
    return { statusCode: 400, code: 'INVALID_BOOKING_TIME' };
  }
  // Check by error name for cross-module errors
  if (error.name === 'RoomNotFoundError') {
    return { statusCode: 404, code: 'ROOM_NOT_FOUND' };
  }
  return { statusCode: 500, code: 'INTERNAL_SERVER_ERROR' };
}

/**
 * Global Error Handler Middleware
 * Centralizes error handling and response formatting
 */
export function errorHandler(
  error: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Log the error
  logger.error('Error occurred', {
    name: error.name,
    message: error.message,
    stack: error.stack,
  });

  // Handle HTTP errors
  if (error instanceof HttpError) {
    const response: ErrorResponse = {
      status: 'error',
      code: error.code,
      message: error.message,
      details: error.details,
    };
    res.status(error.statusCode).json(response);
    return;
  }

  // Handle domain errors
  const { statusCode, code } = mapDomainError(error);
  
  const response: ErrorResponse = {
    status: 'error',
    code,
    message: error.message,
  };

  // Include stack trace in development
  if (process.env.NODE_ENV === 'development') {
    response.stack = error.stack;
  }

  res.status(statusCode).json(response);
}

/**
 * 404 Not Found Handler
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    status: 'error',
    code: 'NOT_FOUND',
    message: `Route ${req.method} ${req.path} not found`,
  });
}
