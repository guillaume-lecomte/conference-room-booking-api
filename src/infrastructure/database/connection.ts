import { Pool, PoolConfig } from 'pg';
import { config } from '../../config';
import { logger } from '../logging/logger';

/**
 * PostgreSQL Database Connection Manager
 * Handles connection pooling and database operations
 */
class Database {
  private pool: Pool | null = null;
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    const poolConfig: PoolConfig = {
      connectionString: config.database.url,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    };

    this.pool = new Pool(poolConfig);

    // Test connection
    try {
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      logger.info('Database connection established');
      this.initialized = true;
    } catch (error) {
      logger.error('Failed to connect to database', { error });
      throw error;
    }

    // Handle pool errors
    this.pool.on('error', (err) => {
      logger.error('Unexpected database pool error', { error: err });
    });
  }

  async initializeTables(): Promise<void> {
    if (!this.pool) throw new Error('Database not initialized');

    const createTablesSQL = `
      -- Rooms table
      CREATE TABLE IF NOT EXISTS rooms (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        capacity INTEGER NOT NULL,
        location VARCHAR(255) NOT NULL,
        amenities TEXT[] DEFAULT '{}',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- Bookings table
      CREATE TABLE IF NOT EXISTS bookings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        room_id UUID NOT NULL REFERENCES rooms(id),
        user_id VARCHAR(255) NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        start_time TIMESTAMP WITH TIME ZONE NOT NULL,
        end_time TIMESTAMP WITH TIME ZONE NOT NULL,
        status VARCHAR(50) DEFAULT 'CONFIRMED',
        idempotency_key VARCHAR(255) UNIQUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        cancelled_at TIMESTAMP WITH TIME ZONE
      );

      -- Index for availability queries
      CREATE INDEX IF NOT EXISTS idx_bookings_room_time 
        ON bookings(room_id, start_time, end_time) 
        WHERE status != 'CANCELLED';

      -- Index for idempotency key lookups
      CREATE INDEX IF NOT EXISTS idx_bookings_idempotency 
        ON bookings(idempotency_key) 
        WHERE idempotency_key IS NOT NULL;

      -- Insert sample rooms if none exist
      INSERT INTO rooms (id, name, capacity, location, amenities)
      SELECT 
        '550e8400-e29b-41d4-a716-446655440001'::UUID,
        'Salle Einstein',
        10,
        'Bâtiment A - 2ème étage',
        ARRAY['projector', 'whiteboard', 'video_conference']
      WHERE NOT EXISTS (SELECT 1 FROM rooms WHERE id = '550e8400-e29b-41d4-a716-446655440001');

      INSERT INTO rooms (id, name, capacity, location, amenities)
      SELECT 
        '550e8400-e29b-41d4-a716-446655440002'::UUID,
        'Salle Curie',
        6,
        'Bâtiment A - 1er étage',
        ARRAY['whiteboard', 'tv_screen']
      WHERE NOT EXISTS (SELECT 1 FROM rooms WHERE id = '550e8400-e29b-41d4-a716-446655440002');

      INSERT INTO rooms (id, name, capacity, location, amenities)
      SELECT 
        '550e8400-e29b-41d4-a716-446655440003'::UUID,
        'Salle Newton',
        20,
        'Bâtiment B - RDC',
        ARRAY['projector', 'whiteboard', 'video_conference', 'sound_system']
      WHERE NOT EXISTS (SELECT 1 FROM rooms WHERE id = '550e8400-e29b-41d4-a716-446655440003');
    `;

    await this.pool.query(createTablesSQL);
    logger.info('Database tables initialized');
  }

  getPool(): Pool {
    if (!this.pool) throw new Error('Database not initialized');
    return this.pool;
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      this.initialized = false;
      logger.info('Database connection closed');
    }
  }

  async healthCheck(): Promise<boolean> {
    if (!this.pool) return false;
    try {
      const result = await this.pool.query('SELECT 1');
      return result.rowCount === 1;
    } catch {
      return false;
    }
  }
}

export const database = new Database();
