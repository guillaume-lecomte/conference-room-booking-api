import amqp, { ChannelModel, Channel, ConsumeMessage } from 'amqplib';
import { Booking } from '../../domain/entities/Booking';
import { config } from '../../config';
import { logger } from '../logging/logger';

/**
 * Event Types for the application
 */
export enum EventType {
  BOOKING_CREATED = 'booking.created',
  BOOKING_CANCELLED = 'booking.cancelled',
  ROOM_UNAVAILABLE = 'room.unavailable',
  CACHE_INVALIDATED = 'cache.invalidated',
}

/**
 * Event Payloads
 */
export interface BookingCreatedEvent {
  booking: Booking;
  timestamp: Date;
}

export interface BookingCancelledEvent {
  booking: Booking;
  reason?: string;
  timestamp: Date;
}

export interface RoomUnavailableEvent {
  roomId: string;
  startTime: Date;
  endTime: Date;
  conflictingBookingId: string;
  timestamp: Date;
}

export interface CacheInvalidatedEvent {
  keys: string[];
  reason: string;
  timestamp: Date;
}

type EventPayload = BookingCreatedEvent | BookingCancelledEvent | RoomUnavailableEvent | CacheInvalidatedEvent;
type EventHandler<T> = (payload: T) => void | Promise<void>;

/**
 * RabbitMQ Event Bus Implementation
 * Provides reliable message passing with persistence
 */
class RabbitMQEventBus {
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;
  private isConnected = false;
  private handlers: Map<string, EventHandler<EventPayload>[]> = new Map();
  private readonly exchangeName = 'booking_events';
  private readonly exchangeType = 'topic';

  async connect(): Promise<void> {
    if (this.isConnected) return;

    try {
      this.connection = await amqp.connect(config.rabbitmq.url);
      this.channel = await this.connection.createChannel();

      // Declare exchange
      await this.channel.assertExchange(this.exchangeName, this.exchangeType, {
        durable: true,
      });

      // Handle connection errors
      this.connection.on('error', (err: Error) => {
        logger.error('RabbitMQ connection error', { error: err.message });
        this.isConnected = false;
      });

      this.connection.on('close', () => {
        logger.info('RabbitMQ connection closed');
        this.isConnected = false;
      });

      this.isConnected = true;
      logger.info('RabbitMQ connected', { exchange: this.exchangeName });

      // Re-register handlers after connection
      await this.setupConsumers();
    } catch (error) {
      logger.error('Failed to connect to RabbitMQ', { error });
      throw error;
    }
  }

  /**
   * Setup consumers for registered handlers
   */
  private async setupConsumers(): Promise<void> {
    if (!this.channel) return;

    for (const [event, handlers] of this.handlers.entries()) {
      if (handlers.length > 0) {
        await this.createConsumer(event);
      }
    }
  }

  /**
   * Create a consumer for a specific event type
   */
  private async createConsumer(event: string): Promise<void> {
    if (!this.channel) return;

    const queueName = `booking_api_${event.replace(/\./g, '_')}`;
    
    // Declare queue
    await this.channel.assertQueue(queueName, {
      durable: true,
      autoDelete: false,
    });

    // Bind queue to exchange with routing key
    await this.channel.bindQueue(queueName, this.exchangeName, event);

    // Start consuming
    await this.channel.consume(queueName, async (msg: ConsumeMessage | null) => {
      if (!msg) return;

      try {
        const payload = JSON.parse(msg.content.toString()) as EventPayload;
        const handlers = this.handlers.get(event) || [];

        logger.debug('Event received from RabbitMQ', { event, payload });

        // Execute all handlers
        for (const handler of handlers) {
          try {
            await handler(payload);
          } catch (err) {
            logger.error('Event handler error', { event, error: err });
          }
        }

        // Acknowledge message
        this.channel?.ack(msg);
      } catch (error) {
        logger.error('Failed to process message', { event, error });
        // Reject and requeue on error
        this.channel?.nack(msg, false, true);
      }
    });

    logger.debug('Consumer created', { queue: queueName, event });
  }

  /**
   * Emit an event
   */
  emit<T extends EventPayload>(event: EventType, payload: T): boolean {
    if (!this.channel || !this.isConnected) {
      logger.warn('RabbitMQ not connected, event not published', { event });
      return false;
    }

    try {
      const message = JSON.stringify(payload);
      
      this.channel.publish(
        this.exchangeName,
        event,
        Buffer.from(message),
        {
          persistent: true, // Message survives broker restart
          contentType: 'application/json',
          timestamp: Date.now(),
        }
      );

      logger.debug('Event published to RabbitMQ', { event });
      return true;
    } catch (error) {
      logger.error('Failed to publish event', { event, error });
      return false;
    }
  }

  /**
   * Subscribe to an event
   */
  async on<T extends EventPayload>(event: EventType | string, handler: EventHandler<T>): Promise<void> {
    const handlers = this.handlers.get(event) || [];
    handlers.push(handler as EventHandler<EventPayload>);
    this.handlers.set(event, handlers);

    // If already connected, create consumer
    if (this.isConnected && this.channel) {
      await this.createConsumer(event);
    }

    logger.info('Event handler registered', { event });
  }

  /**
   * Subscribe to an event once
   */
  async once<T extends EventPayload>(event: EventType | string, handler: EventHandler<T>): Promise<void> {
    const wrappedHandler: EventHandler<T> = async (payload: T) => {
      this.off(event, wrappedHandler as EventHandler<EventPayload>);
      await handler(payload);
    };
    await this.on(event, wrappedHandler);
  }

  /**
   * Remove event handler
   */
  off(event: EventType | string, handler: EventHandler<EventPayload>): void {
    const handlers = this.handlers.get(event) || [];
    const index = handlers.indexOf(handler);
    if (index > -1) {
      handlers.splice(index, 1);
      this.handlers.set(event, handlers);
    }
  }

  /**
   * Remove all handlers for an event
   */
  removeAllListeners(event?: EventType | string): void {
    if (event) {
      this.handlers.delete(event);
    } else {
      this.handlers.clear();
    }
  }

  /**
   * Get listener count for an event
   */
  listenerCount(event: EventType | string): number {
    return (this.handlers.get(event) || []).length;
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    return this.isConnected && this.channel !== null;
  }

  /**
   * Close connection
   */
  async close(): Promise<void> {
    try {
      if (this.channel) {
        await this.channel.close();
        this.channel = null;
      }
      if (this.connection) {
        await this.connection.close();
        this.connection = null;
      }
      this.isConnected = false;
      logger.info('RabbitMQ connection closed');
    } catch (error) {
      logger.error('Error closing RabbitMQ connection', { error });
    }
  }
}

// Singleton instance
export const eventBus = new RabbitMQEventBus();
