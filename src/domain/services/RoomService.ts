import { IRoomRepository } from '../repositories/IRoomRepository';
import { Room, CreateRoomData, RoomAvailability } from '../entities/Room';
import { cache } from '../../infrastructure/cache/RedisCache';
import { config } from '../../config';
import { logger } from '../../infrastructure/logging/logger';

/**
 * Custom Error Classes
 */
export class RoomNotFoundError extends Error {
  constructor(id: string) {
    super(`Room not found: ${id}`);
    this.name = 'RoomNotFoundError';
  }
}

/**
 * Room Service - Core business logic for room operations
 */
export class RoomService {
  constructor(private roomRepository: IRoomRepository) {}

  /**
   * Create a new room
   */
  async createRoom(data: CreateRoomData): Promise<Room> {
    const room = await this.roomRepository.create(data);
    logger.info('Room created', { roomId: room.id, name: room.name });
    return room;
  }

  /**
   * Get room by ID
   */
  async getRoom(id: string): Promise<Room> {
    const room = await this.roomRepository.findById(id);
    if (!room) {
      throw new RoomNotFoundError(id);
    }
    return room;
  }

  /**
   * Get all rooms
   */
  async getAllRooms(): Promise<Room[]> {
    return this.roomRepository.findAll();
  }

  /**
   * Get room availability with cache-aside pattern
   */
  async getRoomAvailability(roomId: string, date: Date): Promise<RoomAvailability> {
    const dateKey = date.toISOString().split('T')[0];
    const cacheKey = `availability:${roomId}:${dateKey}`;

    // Check cache first
    const cached = await cache.get<RoomAvailability>(cacheKey);
    if (cached) {
      logger.debug('Room availability retrieved from cache', { roomId, date: dateKey });
      return cached;
    }

    // Fetch from database
    const availability = await this.roomRepository.getAvailability(roomId, date);
    if (!availability) {
      throw new RoomNotFoundError(roomId);
    }

    // Store in cache
    await cache.set(cacheKey, availability, config.cache.ttl);

    logger.debug('Room availability fetched from database', { roomId, date: dateKey });
    return availability;
  }

  /**
   * Update room
   */
  async updateRoom(id: string, data: Partial<Room>): Promise<Room> {
    const room = await this.roomRepository.update(id, data);
    if (!room) {
      throw new RoomNotFoundError(id);
    }
    logger.info('Room updated', { roomId: id });
    return room;
  }

  /**
   * Delete room
   */
  async deleteRoom(id: string): Promise<void> {
    const deleted = await this.roomRepository.delete(id);
    if (!deleted) {
      throw new RoomNotFoundError(id);
    }
    logger.info('Room deleted', { roomId: id });
  }
}
