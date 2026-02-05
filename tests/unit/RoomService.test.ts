import { RoomService, RoomNotFoundError } from '../../src/domain/services/RoomService';
import { IRoomRepository } from '../../src/domain/repositories/IRoomRepository';
import { Room, RoomAvailability, CreateRoomData } from '../../src/domain/entities/Room';

// Mock the cache
jest.mock('../../src/infrastructure/cache/RedisCache', () => ({
  cache: {
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
  },
}));

import { cache } from '../../src/infrastructure/cache/RedisCache';

describe('RoomService', () => {
  let roomService: RoomService;
  let mockRoomRepository: jest.Mocked<IRoomRepository>;

  const mockRoom: Room = {
    id: '550e8400-e29b-41d4-a716-446655440001',
    name: 'Salle Einstein',
    capacity: 10,
    location: 'Bâtiment A - 2ème étage',
    amenities: ['projector', 'whiteboard'],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockAvailability: RoomAvailability = {
    roomId: mockRoom.id,
    date: new Date(),
    availableSlots: [
      { startTime: new Date('2024-01-15T08:00:00Z'), endTime: new Date('2024-01-15T10:00:00Z') },
      { startTime: new Date('2024-01-15T14:00:00Z'), endTime: new Date('2024-01-15T18:00:00Z') },
    ],
    bookedSlots: [
      { startTime: new Date('2024-01-15T10:00:00Z'), endTime: new Date('2024-01-15T14:00:00Z') },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockRoomRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      getAvailability: jest.fn(),
    };

    roomService = new RoomService(mockRoomRepository);

    (cache.get as jest.Mock).mockResolvedValue(null);
    (cache.set as jest.Mock).mockResolvedValue(undefined);
  });

  describe('createRoom', () => {
    it('should create a room successfully', async () => {
      const createData: CreateRoomData = {
        name: 'New Room',
        capacity: 8,
        location: 'Building B',
        amenities: ['tv_screen'],
      };
      const newRoom = { ...mockRoom, ...createData };
      mockRoomRepository.create.mockResolvedValue(newRoom);

      const result = await roomService.createRoom(createData);

      expect(result).toEqual(newRoom);
      expect(mockRoomRepository.create).toHaveBeenCalledWith(createData);
    });
  });

  describe('getRoom', () => {
    it('should return room when found', async () => {
      mockRoomRepository.findById.mockResolvedValue(mockRoom);

      const result = await roomService.getRoom(mockRoom.id);

      expect(result).toEqual(mockRoom);
    });

    it('should throw RoomNotFoundError when room does not exist', async () => {
      mockRoomRepository.findById.mockResolvedValue(null);

      await expect(roomService.getRoom('non-existent-id'))
        .rejects.toThrow(RoomNotFoundError);
    });
  });

  describe('getAllRooms', () => {
    it('should return all rooms', async () => {
      mockRoomRepository.findAll.mockResolvedValue([mockRoom]);

      const result = await roomService.getAllRooms();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockRoom);
    });
  });

  describe('getRoomAvailability', () => {
    it('should return availability from cache if available', async () => {
      (cache.get as jest.Mock).mockResolvedValue(mockAvailability);

      const result = await roomService.getRoomAvailability(mockRoom.id, new Date());

      expect(result).toEqual(mockAvailability);
      expect(mockRoomRepository.getAvailability).not.toHaveBeenCalled();
    });

    it('should fetch from database when not in cache', async () => {
      (cache.get as jest.Mock).mockResolvedValue(null);
      mockRoomRepository.getAvailability.mockResolvedValue(mockAvailability);

      const result = await roomService.getRoomAvailability(mockRoom.id, new Date());

      expect(result).toEqual(mockAvailability);
      expect(mockRoomRepository.getAvailability).toHaveBeenCalled();
      expect(cache.set).toHaveBeenCalled();
    });

    it('should throw RoomNotFoundError when room does not exist', async () => {
      (cache.get as jest.Mock).mockResolvedValue(null);
      mockRoomRepository.getAvailability.mockResolvedValue(null);

      await expect(roomService.getRoomAvailability('non-existent-id', new Date()))
        .rejects.toThrow(RoomNotFoundError);
    });
  });

  describe('updateRoom', () => {
    it('should update room successfully', async () => {
      const updatedRoom = { ...mockRoom, name: 'Updated Name' };
      mockRoomRepository.update.mockResolvedValue(updatedRoom);

      const result = await roomService.updateRoom(mockRoom.id, { name: 'Updated Name' });

      expect(result.name).toBe('Updated Name');
    });

    it('should throw RoomNotFoundError when room does not exist', async () => {
      mockRoomRepository.update.mockResolvedValue(null);

      await expect(roomService.updateRoom('non-existent-id', { name: 'Test' }))
        .rejects.toThrow(RoomNotFoundError);
    });
  });

  describe('deleteRoom', () => {
    it('should delete room successfully', async () => {
      mockRoomRepository.delete.mockResolvedValue(true);

      await expect(roomService.deleteRoom(mockRoom.id)).resolves.not.toThrow();
    });

    it('should throw RoomNotFoundError when room does not exist', async () => {
      mockRoomRepository.delete.mockResolvedValue(false);

      await expect(roomService.deleteRoom('non-existent-id'))
        .rejects.toThrow(RoomNotFoundError);
    });
  });
});
