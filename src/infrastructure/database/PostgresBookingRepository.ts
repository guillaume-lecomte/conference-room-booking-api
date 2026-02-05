import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { IBookingRepository } from '../../domain/repositories/IBookingRepository';
import { Booking, CreateBookingData, BookingFilter, BookingStatus } from '../../domain/entities/Booking';
import { logger } from '../logging/logger';

/**
 * PostgreSQL Booking Repository Implementation
 */
export class PostgresBookingRepository implements IBookingRepository {
  constructor(private pool: Pool) {}

  /**
   * Map database row to Booking entity
   */
  private mapRowToBooking(row: Record<string, unknown>): Booking {
    return {
      id: row.id as string,
      roomId: row.room_id as string,
      userId: row.user_id as string,
      title: row.title as string,
      description: row.description as string | undefined,
      startTime: new Date(row.start_time as string),
      endTime: new Date(row.end_time as string),
      status: row.status as BookingStatus,
      idempotencyKey: row.idempotency_key as string | undefined,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
      cancelledAt: row.cancelled_at ? new Date(row.cancelled_at as string) : undefined,
    };
  }

  async create(data: CreateBookingData): Promise<Booking> {
    const id = uuidv4();
    const query = `
      INSERT INTO bookings (id, room_id, user_id, title, description, start_time, end_time, status, idempotency_key)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;
    
    const values = [
      id,
      data.roomId,
      data.userId,
      data.title,
      data.description || null,
      data.startTime.toISOString(),
      data.endTime.toISOString(),
      BookingStatus.CONFIRMED,
      data.idempotencyKey || null,
    ];

    const result = await this.pool.query(query, values);
    logger.debug('Booking created', { id });
    return this.mapRowToBooking(result.rows[0]);
  }

  async findById(id: string): Promise<Booking | null> {
    const query = 'SELECT * FROM bookings WHERE id = $1';
    const result = await this.pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapRowToBooking(result.rows[0]);
  }

  async findByIdempotencyKey(key: string): Promise<Booking | null> {
    const query = 'SELECT * FROM bookings WHERE idempotency_key = $1';
    const result = await this.pool.query(query, [key]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapRowToBooking(result.rows[0]);
  }

  async findAll(filter?: BookingFilter): Promise<Booking[]> {
    let query = 'SELECT * FROM bookings WHERE 1=1';
    const values: unknown[] = [];
    let paramIndex = 1;

    if (filter?.roomId) {
      query += ` AND room_id = $${paramIndex++}`;
      values.push(filter.roomId);
    }

    if (filter?.userId) {
      query += ` AND user_id = $${paramIndex++}`;
      values.push(filter.userId);
    }

    if (filter?.status) {
      query += ` AND status = $${paramIndex++}`;
      values.push(filter.status);
    }

    if (filter?.startTimeFrom) {
      query += ` AND start_time >= $${paramIndex++}`;
      values.push(filter.startTimeFrom.toISOString());
    }

    if (filter?.startTimeTo) {
      query += ` AND start_time <= $${paramIndex++}`;
      values.push(filter.startTimeTo.toISOString());
    }

    query += ' ORDER BY start_time ASC';

    const result = await this.pool.query(query, values);
    return result.rows.map(row => this.mapRowToBooking(row));
  }

  async update(id: string, data: Partial<Booking>): Promise<Booking | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (data.title !== undefined) {
      fields.push(`title = $${paramIndex++}`);
      values.push(data.title);
    }

    if (data.description !== undefined) {
      fields.push(`description = $${paramIndex++}`);
      values.push(data.description);
    }

    if (data.status !== undefined) {
      fields.push(`status = $${paramIndex++}`);
      values.push(data.status);
    }

    if (data.cancelledAt !== undefined) {
      fields.push(`cancelled_at = $${paramIndex++}`);
      values.push(data.cancelledAt?.toISOString() || null);
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    fields.push(`updated_at = $${paramIndex++}`);
    values.push(new Date().toISOString());
    values.push(id);

    const query = `
      UPDATE bookings 
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await this.pool.query(query, values);
    
    if (result.rows.length === 0) {
      return null;
    }

    logger.debug('Booking updated', { id });
    return this.mapRowToBooking(result.rows[0]);
  }

  async delete(id: string): Promise<boolean> {
    const query = 'DELETE FROM bookings WHERE id = $1';
    const result = await this.pool.query(query, [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async findConflictingBookings(
    roomId: string,
    startTime: Date,
    endTime: Date,
    excludeBookingId?: string
  ): Promise<Booking[]> {
    let query = `
      SELECT * FROM bookings 
      WHERE room_id = $1 
        AND status != 'CANCELLED'
        AND (
          (start_time < $3 AND end_time > $2)
        )
    `;
    const values: unknown[] = [roomId, startTime.toISOString(), endTime.toISOString()];

    if (excludeBookingId) {
      query += ' AND id != $4';
      values.push(excludeBookingId);
    }

    const result = await this.pool.query(query, values);
    return result.rows.map(row => this.mapRowToBooking(row));
  }
}
