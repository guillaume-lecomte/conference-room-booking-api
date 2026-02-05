import { eventBus, EventType, BookingCreatedEvent, BookingCancelledEvent } from './EventBus';
import { cache } from '../cache/RedisCache';
import { logger } from '../logging/logger';

/**
 * Event Handlers - Asynchronous side-effects
 * Demonstrates decoupled event-driven architecture with RabbitMQ
 */

/**
 * Handle booking created event
 * - Sends notification (simulated)
 * - Updates analytics (simulated)
 * - Invalidates relevant caches
 */
async function handleBookingCreated(event: BookingCreatedEvent): Promise<void> {
  const { booking, timestamp } = event;
  
  logger.info('Handling booking.created event', { 
    bookingId: booking.id, 
    roomId: booking.roomId,
    timestamp 
  });

  try {
    // Simulate notification sending
    await simulateNotification({
      type: 'booking_confirmation',
      userId: booking.userId,
      message: `Your booking "${booking.title}" has been confirmed for room ${booking.roomId}`,
    });

    // Simulate analytics tracking
    await simulateAnalytics({
      event: 'booking_created',
      properties: {
        bookingId: booking.id,
        roomId: booking.roomId,
        duration: (new Date(booking.endTime).getTime() - new Date(booking.startTime).getTime()) / 60000,
      },
    });

    // Invalidate room availability cache
    const dateKey = new Date(booking.startTime).toISOString().split('T')[0];
    await cache.deletePattern(`availability:${booking.roomId}:${dateKey}*`);
    
    logger.info('booking.created event handled successfully', { bookingId: booking.id });
  } catch (error) {
    logger.error('Error handling booking.created event', { error, bookingId: booking.id });
  }
}

/**
 * Handle booking cancelled event
 * - Sends cancellation notification
 * - Updates analytics
 * - Invalidates caches
 */
async function handleBookingCancelled(event: BookingCancelledEvent): Promise<void> {
  const { booking, reason, timestamp } = event;
  
  logger.info('Handling booking.cancelled event', { 
    bookingId: booking.id, 
    reason,
    timestamp 
  });

  try {
    // Simulate notification
    await simulateNotification({
      type: 'booking_cancellation',
      userId: booking.userId,
      message: `Your booking "${booking.title}" has been cancelled${reason ? `: ${reason}` : ''}`,
    });

    // Simulate analytics
    await simulateAnalytics({
      event: 'booking_cancelled',
      properties: {
        bookingId: booking.id,
        roomId: booking.roomId,
        reason,
      },
    });

    // Invalidate caches
    await cache.delete(`booking:${booking.id}`);
    const dateKey = new Date(booking.startTime).toISOString().split('T')[0];
    await cache.deletePattern(`availability:${booking.roomId}:${dateKey}*`);
    
    logger.info('booking.cancelled event handled successfully', { bookingId: booking.id });
  } catch (error) {
    logger.error('Error handling booking.cancelled event', { error, bookingId: booking.id });
  }
}

/**
 * Simulated notification service
 */
async function simulateNotification(notification: {
  type: string;
  userId: string;
  message: string;
}): Promise<void> {
  // Simulate async operation
  await new Promise(resolve => setTimeout(resolve, 10));
  logger.debug('Notification sent', notification);
}

/**
 * Simulated analytics service
 */
async function simulateAnalytics(data: {
  event: string;
  properties: Record<string, unknown>;
}): Promise<void> {
  // Simulate async operation
  await new Promise(resolve => setTimeout(resolve, 10));
  logger.debug('Analytics tracked', data);
}

/**
 * Register all event handlers
 */
export async function registerEventHandlers(): Promise<void> {
  await eventBus.on<BookingCreatedEvent>(EventType.BOOKING_CREATED, handleBookingCreated);
  await eventBus.on<BookingCancelledEvent>(EventType.BOOKING_CANCELLED, handleBookingCancelled);
  
  logger.info('Event handlers registered');
}
