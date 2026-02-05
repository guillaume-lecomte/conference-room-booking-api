/**
 * Room Entity - Pure domain object
 * Represents a conference room
 */
export interface Room {
  id: string;
  name: string;
  capacity: number;
  location: string;
  amenities: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TimeSlot {
  startTime: Date;
  endTime: Date;
}

export interface RoomAvailability {
  roomId: string;
  date: Date;
  availableSlots: TimeSlot[];
  bookedSlots: TimeSlot[];
}

export interface CreateRoomData {
  name: string;
  capacity: number;
  location: string;
  amenities: string[];
}
