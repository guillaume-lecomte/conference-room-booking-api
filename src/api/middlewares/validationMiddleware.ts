import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { logger } from '../../infrastructure/logging/logger';

/**
 * Validation Error Response
 */
interface ValidationErrorResponse {
  status: 'error';
  code: 'VALIDATION_ERROR';
  message: string;
  errors: Array<{
    path: string;
    message: string;
  }>;
}

/**
 * Validation Middleware Factory
 * Creates middleware that validates request against Zod schema
 */
export function validate(schema: ZodSchema) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
        headers: req.headers,
      });

      // Attach validated data to request
      req.body = validated.body ?? req.body;
      req.query = validated.query ?? req.query;
      req.params = validated.params ?? req.params;

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const response: ValidationErrorResponse = {
          status: 'error',
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          errors: error.errors.map(err => ({
            path: err.path.join('.'),
            message: err.message,
          })),
        };

        logger.warn('Validation error', { errors: response.errors });
        res.status(400).json(response);
        return;
      }

      next(error);
    }
  };
}
