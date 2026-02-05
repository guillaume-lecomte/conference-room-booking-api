import { Router, Request, Response } from 'express';
import { database } from '../../infrastructure/database/connection';
import { cache } from '../../infrastructure/cache/RedisCache';
import { eventBus } from '../../infrastructure/events/EventBus';

/**
 * Health Check Routes
 * Provides system health and metrics endpoints
 */
export function createHealthRoutes(): Router {
  const router = Router();
  const startTime = Date.now();

  /**
   * GET /api/health
   * Basic health check
   */
  router.get('/', async (_req: Request, res: Response): Promise<void> => {
    const dbHealthy = await database.healthCheck();
    const cacheHealthy = await cache.healthCheck();
    const eventBusHealthy = await eventBus.healthCheck();
    
    const allHealthy = dbHealthy && cacheHealthy && eventBusHealthy;
    const status = allHealthy ? 'healthy' : 'degraded';

    res.status(allHealthy ? 200 : 503).json({
      status,
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - startTime) / 1000),
      checks: {
        database: dbHealthy ? 'healthy' : 'unhealthy',
        cache: cacheHealthy ? 'healthy' : 'unhealthy',
        eventBus: eventBusHealthy ? 'healthy' : 'unhealthy',
      },
    });
  });

  /**
   * GET /api/health/ready
   * Readiness probe for Kubernetes
   */
  router.get('/ready', async (_req: Request, res: Response): Promise<void> => {
    const dbHealthy = await database.healthCheck();
    const cacheHealthy = await cache.healthCheck();
    const eventBusHealthy = await eventBus.healthCheck();

    if (dbHealthy && cacheHealthy && eventBusHealthy) {
      res.status(200).json({ status: 'ready' });
    } else {
      res.status(503).json({ 
        status: 'not ready', 
        details: {
          database: dbHealthy,
          cache: cacheHealthy,
          eventBus: eventBusHealthy,
        }
      });
    }
  });

  /**
   * GET /api/health/live
   * Liveness probe for Kubernetes
   */
  router.get('/live', (_req: Request, res: Response): void => {
    res.status(200).json({ status: 'alive' });
  });

  /**
   * GET /api/metrics
   * Basic application metrics
   */
  router.get('/metrics', async (_req: Request, res: Response): Promise<void> => {
    const cacheStats = await cache.getStats();
    const memoryUsage = process.memoryUsage();

    res.json({
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - startTime) / 1000),
      memory: {
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + 'MB',
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + 'MB',
        rss: Math.round(memoryUsage.rss / 1024 / 1024) + 'MB',
      },
      cache: {
        size: cacheStats.size,
      },
    });
  });

  return router;
}
