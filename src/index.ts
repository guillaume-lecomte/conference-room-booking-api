import { createApp, gracefulShutdown } from './app';
import { config } from './config';
import { logger } from './infrastructure/logging/logger';

/**
 * Application Entry Point
 * Starts the server and sets up graceful shutdown
 */
async function main(): Promise<void> {
  try {
    const app = await createApp();

    const server = app.listen(config.port, config.host, () => {
      logger.info(`🚀 Server started`, {
        host: config.host,
        port: config.port,
        environment: config.env,
        url: `http://${config.host}:${config.port}`,
      });

      logger.info('Available endpoints:', {
        health: `http://${config.host}:${config.port}/api/health`,
        bookings: `http://${config.host}:${config.port}/api/bookings`,
        rooms: `http://${config.host}:${config.port}/api/rooms`,
      });
    });

    // Graceful shutdown handlers
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', { error: error.message, stack: error.stack });
      console.error('UNCAUGHT:', error);
      gracefulShutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled rejection', { reason });
    });

    // Keep server reference for graceful shutdown
    server.on('close', () => {
      logger.info('Server closed');
    });

  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

// Start the application
main();
