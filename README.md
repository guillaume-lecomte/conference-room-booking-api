# Conference Room Booking API 🏢

A RESTful conference room booking API demonstrating modern architectural best practices in Node.js/TypeScript.

## 🚀 Quick Start

### Option 1: Docker Compose (Recommended)

```bash
# Clone and start
git clone <repository-url>
cd conference-room-booking-api

# Start all services (PostgreSQL + Redis + RabbitMQ + API)
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f api

# Access RabbitMQ Management UI
open http://localhost:15672  # guest/guest

# Stop services
docker-compose down
```

The API will be available at `http://localhost:8001`

### Option 2: Local Development

**Prerequisites:**

- Node.js 20+
- PostgreSQL 15+
- Redis 7+
- RabbitMQ 3+

```bash
# Start Redis and RabbitMQ with Docker (if you don't have them locally)
docker run -d --name redis -p 6379:6379 redis:7-alpine
docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3-management-alpine

# Setup PostgreSQL database
psql -U postgres -c "CREATE USER appuser WITH PASSWORD 'apppassword' CREATEDB;"
psql -U postgres -c "CREATE DATABASE conference_booking OWNER appuser;"

# Install dependencies
npm install

# Create .env file
cat > .env << EOF
NODE_ENV=development
PORT=8001
HOST=0.0.0.0
DATABASE_URL=postgres://appuser:apppassword@localhost:5432/conference_booking
REDIS_URL=redis://localhost:6379
RABBITMQ_URL=amqp://guest:guest@localhost:5672
CACHE_TTL=300
IDEMPOTENCY_TTL=86400
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
LOG_LEVEL=info
EOF

# Build and run
npm run build
npm start

# Or run in development mode (with hot reload)
npm run dev
```

### Verify Installation

```bash
# Health check (should show all services healthy)
curl http://localhost:8001/api/health

# List rooms
curl http://localhost:8001/api/rooms

# Create a booking
curl -X POST http://localhost:8001/api/bookings \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: my-unique-key-123" \
  -d '{
    "roomId": "550e8400-e29b-41d4-a716-446655440001",
    "userId": "user-123",
    "title": "Team Meeting",
    "startTime": "2026-02-20T10:00:00Z",
    "endTime": "2026-02-20T11:00:00Z"
  }'
```

---

## 🎯 Project Goals

Demonstration of modern architectural patterns for production-ready Node.js APIs.

## 🏗️ Architecture Highlights

- [x] **Idempotency** via Idempotency Keys (`Idempotency-Key` header)
- [x] **Clean Architecture** (separated layers: API → Domain → Infrastructure)
- [x] **Event-Driven Design** with RabbitMQ
- [x] **Caching Strategy** with Redis (cache-aside pattern)
- [x] **Rate Limiting** (Sliding Window Algorithm)
- [x] **Centralized Error Handling** with custom error classes
- [x] **Request Validation** with Zod schemas
- [x] **Structured Logging** with Pino
- [x] **Graceful Shutdown**
- [x] **Health Check** endpoints
- [x] **Docker Support**

## 📁 Project Structure

```
src/
├── api/
│   ├── routes/           # Express routes
│   ├── middlewares/      # Validation, rate limiting, error handling
│   └── validators/       # Zod schemas
├── domain/
│   ├── entities/         # Booking, Room (pure domain objects)
│   ├── repositories/     # Repository interfaces
│   └── services/         # Business logic (BookingService, RoomService)
├── infrastructure/
│   ├── database/         # PostgreSQL connection & repositories
│   ├── cache/            # Redis cache implementation
│   └── events/           # RabbitMQ EventBus & handlers
├── config/               # Environment configuration
└── tests/
    ├── unit/             # Unit tests with mocks
    └── integration/      # E2E tests with supertest
```

## 🐰 RabbitMQ Event-Driven Architecture

### Events Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Booking    │────▶│  RabbitMQ   │────▶│  Handlers   │
│  Service    │     │  Exchange   │     │  (Workers)  │
└─────────────┘     └─────────────┘     └─────────────┘
     emit()              │                    │
                         │                    ├── Notifications
                         │                    ├── Analytics
                         │                    └── Cache Invalidation
```

### Event Types

| Event               | Description           | Payload                                                |
| ------------------- | --------------------- | ------------------------------------------------------ |
| `booking.created`   | New booking confirmed | `{ booking, timestamp }`                               |
| `booking.cancelled` | Booking cancelled     | `{ booking, reason, timestamp }`                       |
| `room.unavailable`  | Conflict detected     | `{ roomId, startTime, endTime, conflictingBookingId }` |

### RabbitMQ Management

- **Management UI**: http://localhost:15672
- **Credentials**: guest / guest
- **Exchange**: `booking_events` (topic)
- **Queues**: Auto-created per event type

## 🔴 Redis Caching Strategy

### Cache-Aside Pattern

```
GET /api/bookings/:id
    │
    ▼
┌─────────────┐     ┌─────────────┐
│   Redis     │────▶│   Return    │  (Cache Hit)
│   Cache     │     └─────────────┘
└─────────────┘
    │ Miss
    ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ PostgreSQL  │────▶│ Store Redis │────▶│   Return    │
└─────────────┘     └─────────────┘     └─────────────┘
```

### Cache Keys

| Pattern                        | TTL      | Description        |
| ------------------------------ | -------- | ------------------ |
| `booking:{id}`                 | 5 min    | Individual booking |
| `availability:{roomId}:{date}` | 5 min    | Room availability  |
| `idempotency:{key}`            | 24 hours | Idempotency keys   |

### Automatic Invalidation

Cache is automatically invalidated on:

- Booking creation → Invalidates room availability
- Booking cancellation → Invalidates booking + availability

## 📊 Demonstrated Patterns

### 1. Idempotency

```bash
# First request - creates booking
curl -X POST http://localhost:8001/api/bookings \
  -H "Idempotency-Key: unique-key-123" \
  -H "Content-Type: application/json" \
  -d '{"roomId": "...", "userId": "...", "title": "Meeting", ...}'

# Second request with same key - returns same booking (no duplicate)
curl -X POST http://localhost:8001/api/bookings \
  -H "Idempotency-Key: unique-key-123" \
  -H "Content-Type: application/json" \
  -d '{"roomId": "...", "userId": "...", "title": "Meeting", ...}'
```

### 2. Health Check with All Services

```bash
curl http://localhost:8001/api/health
# Response:
{
  "status": "healthy",
  "checks": {
    "database": "healthy",
    "cache": "healthy",      # Redis
    "eventBus": "healthy"    # RabbitMQ
  }
}
```

## 🧪 Testing

```bash
# Run all tests with coverage
npm test

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration
```

**Coverage:** 92.7% (56 tests passing)

## 📚 API Documentation

### Endpoints

| Method | Endpoint                      | Description                      |
| ------ | ----------------------------- | -------------------------------- |
| `POST` | `/api/bookings`               | Create a booking (idempotent)    |
| `GET`  | `/api/bookings`               | List all bookings                |
| `GET`  | `/api/bookings/:id`           | Get a booking by ID (cached)     |
| `PUT`  | `/api/bookings/:id/cancel`    | Cancel a booking                 |
| `GET`  | `/api/rooms`                  | List all rooms                   |
| `GET`  | `/api/rooms/:id`              | Get a room by ID                 |
| `GET`  | `/api/rooms/:id/availability` | Check room availability (cached) |
| `GET`  | `/api/health`                 | Health check                     |
| `GET`  | `/api/health/metrics`         | Application metrics              |

### Example Requests

```bash
# Create booking with idempotency
curl -X POST http://localhost:8001/api/bookings \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: unique-key-$(date +%s)" \
  -d '{
    "roomId": "550e8400-e29b-41d4-a716-446655440001",
    "userId": "user-123",
    "title": "Team Meeting",
    "description": "Weekly sync",
    "startTime": "2026-02-20T10:00:00Z",
    "endTime": "2026-02-20T11:00:00Z"
  }'

# Get booking by ID
curl http://localhost:8001/api/bookings/{booking-id}

# Cancel booking
curl -X PUT http://localhost:8001/api/bookings/{booking-id}/cancel \
  -H "Content-Type: application/json" \
  -d '{"reason": "Meeting rescheduled"}'

# Check room availability
curl "http://localhost:8001/api/rooms/550e8400-e29b-41d4-a716-446655440001/availability?date=2026-02-20"

# Health check
curl http://localhost:8001/api/health
```

### Response Format

```json
// Success
{
  "status": "success",
  "data": { ... }
}

// Error
{
  "status": "error",
  "code": "ROOM_UNAVAILABLE",
  "message": "Room is not available for the requested time slot"
}
```

### Error Codes

| Code                        | HTTP Status | Description                   |
| --------------------------- | ----------- | ----------------------------- |
| `VALIDATION_ERROR`          | 400         | Invalid request data          |
| `INVALID_BOOKING_TIME`      | 400         | Invalid time range            |
| `BOOKING_NOT_FOUND`         | 404         | Booking doesn't exist         |
| `ROOM_NOT_FOUND`            | 404         | Room doesn't exist            |
| `ROOM_UNAVAILABLE`          | 409         | Time slot already booked      |
| `BOOKING_ALREADY_CANCELLED` | 409         | Booking was already cancelled |
| `RATE_LIMIT_EXCEEDED`       | 429         | Too many requests             |

### Pre-seeded Rooms

| ID                                     | Name          | Capacity | Location                  |
| -------------------------------------- | ------------- | -------- | ------------------------- |
| `550e8400-e29b-41d4-a716-446655440001` | Einstein Room | 10       | Building A - 2nd Floor    |
| `550e8400-e29b-41d4-a716-446655440002` | Curie Room    | 6        | Building A - 1st Floor    |
| `550e8400-e29b-41d4-a716-446655440003` | Newton Room   | 20       | Building B - Ground Floor |

## 🔧 Configuration

### Environment Variables

| Variable                  | Default     | Description                  |
| ------------------------- | ----------- | ---------------------------- |
| `NODE_ENV`                | development | Environment mode             |
| `PORT`                    | 8001        | Server port                  |
| `HOST`                    | 0.0.0.0     | Server host                  |
| `DATABASE_URL`            | -           | PostgreSQL connection string |
| `REDIS_URL`               | -           | Redis connection string      |
| `RABBITMQ_URL`            | -           | RabbitMQ connection string   |
| `CACHE_TTL`               | 300         | Cache TTL in seconds         |
| `IDEMPOTENCY_TTL`         | 86400       | Idempotency key TTL (24h)    |
| `RATE_LIMIT_WINDOW_MS`    | 60000       | Rate limit window (1 min)    |
| `RATE_LIMIT_MAX_REQUESTS` | 100         | Max requests per window      |
| `LOG_LEVEL`               | info        | Logging level                |

## 🛠️ Technology Stack

- **Runtime**: Node.js 20
- **Language**: TypeScript 5.x (strict mode)
- **Framework**: Express.js 4.x
- **Database**: PostgreSQL 15
- **Cache**: Redis 7
- **Message Broker**: RabbitMQ 3
- **Validation**: Zod
- **Logging**: Pino
- **Testing**: Jest + Supertest
- **Security**: Helmet, CORS, Rate Limiting
- **Containerization**: Docker + Docker Compose

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT
