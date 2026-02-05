import { Room, CreateRoomData, RoomAvailability } from '../entities/Room';

/**
 * Room Repository Interface
 * Defines the contract for room data persistence
 */
export interface IRoomRepository {
  create(data: CreateRoomData): Promise<Room>;
  findById(id: string): Promise<Room | null>;
  findAll(): Promise<Room[]>;
  update(id: string, data: Partial<Room>): Promise<Room | null>;
  delete(id: string): Promise<boolean>;
  getAvailability(roomId: string, date: Date): Promise<RoomAvailability | null>;
}
