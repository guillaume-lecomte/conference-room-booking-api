import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { IRoomRepository } from '../../domain/repositories/IRoomRepository';
import { Room, CreateRoomData, RoomAvailability, TimeSlot } from '../../domain/entities/Room';
import { BookingStatus } from '../../domain/entities/Booking';
import { logger } from '../logging/logger';

/**
 * PostgreSQL Room Repository Implementation
 */
export class PostgresRoomRepository implements IRoomRepository {
  constructor(private pool: Pool) {}

  /**
   * Map database row to Room entity
   */
  private mapRowToRoom(row: Record<string, unknown>): Room {
    return {
      id: row.id as string,
      name: row.name as string,
      capacity: row.capacity as number,
      location: row.location as string,
      amenities: row.amenities as string[],
      isActive: row.is_active as boolean,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }

  async create(data: CreateRoomData): Promise<Room> {
    const id = uuidv4();
    const query = `
      INSERT INTO rooms (id, name, capacity, location, amenities)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    
    const values = [id, data.name, data.capacity, data.location, data.amenities];
    const result = await this.pool.query(query, values);
    
    logger.debug('Room created', { id });
    return this.mapRowToRoom(result.rows[0]);
  }

  async findById(id: string): Promise<Room | null> {
    const query = 'SELECT * FROM rooms WHERE id = $1';
    const result = await this.pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapRowToRoom(result.rows[0]);
  }

  async findAll(): Promise<Room[]> {
    const query = 'SELECT * FROM rooms WHERE is_active = true ORDER BY name';
    const result = await this.pool.query(query);
    return result.rows.map(row => this.mapRowToRoom(row));
  }

  async update(id: string, data: Partial<Room>): Promise<Room | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (data.name !== undefined) {
      fields.push(`name = $${paramIndex++}`);
      values.push(data.name);
    }

    if (data.capacity !== undefined) {
      fields.push(`capacity = $${paramIndex++}`);
      values.push(data.capacity);
    }

    if (data.location !== undefined) {
      fields.push(`location = $${paramIndex++}`);
      values.push(data.location);
    }

    if (data.amenities !== undefined) {
      fields.push(`amenities = $${paramIndex++}`);
      values.push(data.amenities);
    }

    if (data.isActive !== undefined) {
      fields.push(`is_active = $${paramIndex++}`);
      values.push(data.isActive);
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    fields.push(`updated_at = $${paramIndex++}`);
    values.push(new Date().toISOString());
    values.push(id);

    const query = `
      UPDATE rooms 
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await this.pool.query(query, values);
    
    if (result.rows.length === 0) {
      return null;
    }

    logger.debug('Room updated', { id });
    return this.mapRowToRoom(result.rows[0]);
  }

  async delete(id: string): Promise<boolean> {
    const query = 'DELETE FROM rooms WHERE id = $1';
    const result = await this.pool.query(query, [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async getAvailability(roomId: string, date: Date): Promise<RoomAvailability | null> {
    // Check if room exists
    const room = await this.findById(roomId);
    if (!room) {
      return null;
    }

    // Get start and end of day
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Get bookings for this room on this date
    const query = `
      SELECT start_time, end_time 
      FROM bookings 
      WHERE room_id = $1 
        AND status != $2
        AND start_time >= $3
        AND start_time < $4
      ORDER BY start_time
    `;

    const result = await this.pool.query(query, [
      roomId,
      BookingStatus.CANCELLED,
      startOfDay.toISOString(),
      endOfDay.toISOString(),
    ]);

    const bookedSlots: TimeSlot[] = result.rows.map(row => ({
      startTime: new Date(row.start_time as string),
      endTime: new Date(row.end_time as string),
    }));

    // Calculate available slots (business hours 8:00-18:00)
    const businessStart = new Date(date);
    businessStart.setHours(8, 0, 0, 0);
    
    const businessEnd = new Date(date);
    businessEnd.setHours(18, 0, 0, 0);

    const availableSlots = this.calculateAvailableSlots(
      businessStart,
      businessEnd,
      bookedSlots
    );

    return {
      roomId,
      date,
      availableSlots,
      bookedSlots,
    };
  }

  /**
   * Calculate available time slots given booked slots
   */
  private calculateAvailableSlots(
    dayStart: Date,
    dayEnd: Date,
    bookedSlots: TimeSlot[]
  ): TimeSlot[] {
    if (bookedSlots.length === 0) {
      return [{ startTime: dayStart, endTime: dayEnd }];
    }

    const availableSlots: TimeSlot[] = [];
    let currentStart = dayStart;

    for (const booked of bookedSlots) {
      if (currentStart < booked.startTime) {
        availableSlots.push({
          startTime: new Date(currentStart),
          endTime: new Date(booked.startTime),
        });
      }
      currentStart = new Date(Math.max(currentStart.getTime(), booked.endTime.getTime()));
    }

    if (currentStart < dayEnd) {
      availableSlots.push({
        startTime: new Date(currentStart),
        endTime: dayEnd,
      });
    }

    return availableSlots;
  }
}
