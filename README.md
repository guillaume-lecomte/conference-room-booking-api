# conference-room-booking-api

A REST API to book conference rooms, built to show idempotent requests, caching and asynchronous events on Node.js, PostgreSQL, Redis and RabbitMQ.

## The problem

Two people try to book the same room at the same time. A client retries a `POST` after a network timeout and must not end up with two bookings. Availability is read far more often than it is written. Notifications and cache invalidation should not slow down the write path.

The naive version fails in each case: a retried `POST` creates a duplicate, "check availability then insert" lets two requests take the same slot (this repository still has that flaw, see Known issues), and doing every side effect inside the request makes it as slow as its slowest dependency.

## The approach

The code is split into routes, services and repositories. Repositories are interfaces with PostgreSQL implementations, and services receive them by constructor.

- A booking request can carry an `Idempotency-Key` header. The service looks the key up in Redis, then in the database, and returns the existing booking if it finds one. The key is also a `UNIQUE` column.
- Reads of a booking and of a room's availability go through a Redis cache-aside layer with a TTL.
- Creating or cancelling a booking publishes an event to a RabbitMQ topic exchange. Consumers in the same process handle it: simulated notification and analytics calls, and cache invalidation.

Trade-offs: the availability cache is invalidated by an event, so it is eventually consistent. The slot conflict check is not atomic, see Known issues.

## Engineering highlights

- **Idempotency key.** Cache then database lookup before any write, 24 hour TTL for the cached key, `UNIQUE` constraint on the column. See [`BookingService.ts`](src/domain/services/BookingService.ts) (`createBooking`, `checkIdempotency`), [`connection.ts`](src/infrastructure/database/connection.ts) and [`config/index.ts`](src/config/index.ts).
- **Cache-aside with Redis.** `booking:{id}` and `availability:{roomId}:{date}` keys with a TTL. See [`BookingService.ts`](src/domain/services/BookingService.ts), [`RoomService.ts`](src/domain/services/RoomService.ts) and [`RedisCache.ts`](src/infrastructure/cache/RedisCache.ts).
- **Events on a durable topic exchange.** Persistent messages, one durable queue per event type, `ack` on success, `nack` with requeue on failure. See [`EventBus.ts`](src/infrastructure/events/EventBus.ts) and [`handlers.ts`](src/infrastructure/events/handlers.ts).
- **Typed domain errors mapped to HTTP.** `ROOM_UNAVAILABLE` is a 409, `BOOKING_NOT_FOUND` a 404, and so on. See [`BookingService.ts`](src/domain/services/BookingService.ts) and [`errorMiddleware.ts`](src/api/middlewares/errorMiddleware.ts).
- **Sliding-window rate limit** with `X-RateLimit-*` headers, in memory. See [`rateLimitMiddleware.ts`](src/api/middlewares/rateLimitMiddleware.ts).
- **Operations.** Health, readiness and liveness endpoints, graceful shutdown on `SIGTERM` and `SIGINT`, and a multi-stage Docker image that runs as a non-root user with a `HEALTHCHECK`. See [`healthRoutes.ts`](src/api/routes/healthRoutes.ts), [`app.ts`](src/app.ts) and [`Dockerfile`](Dockerfile).

## Architecture

```mermaid
flowchart LR
  client[Client] --> api[Express: routes, validation, rate limit]
  api --> svc[BookingService, RoomService]
  svc --> pg[(PostgreSQL)]
  svc --> redis[(Redis cache)]
  svc -- publish --> mq[[RabbitMQ topic exchange]]
  mq --> handlers[Event handlers, same process]
  handlers --> redis
```

## API

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/bookings` | Create a booking. Optional `Idempotency-Key` header |
| GET | `/api/bookings` | List bookings, filterable, not paginated |
| GET | `/api/bookings/:id` | Get a booking (cached) |
| PUT | `/api/bookings/:id/cancel` | Cancel a booking |
| GET | `/api/rooms` | List rooms |
| POST | `/api/rooms` | Create a room |
| GET | `/api/rooms/:id` | Get a room |
| GET | `/api/rooms/:id/availability?date=` | Availability for a day (cached) |
| GET | `/api/health`, `/api/health/ready`, `/api/health/live`, `/api/health/metrics` | Health and metrics |

Successful responses look like `{ "status": "success", "data": ... }` and errors like `{ "status": "error", "code": "ROOM_UNAVAILABLE", "message": "..." }`. Three rooms are inserted at startup (see [`connection.ts`](src/infrastructure/database/connection.ts)).

## Tech stack

From [`package.json`](package.json), [`Dockerfile`](Dockerfile) and [`docker-compose.yml`](docker-compose.yml):

- Node.js 20, TypeScript 5, Express 4
- PostgreSQL 15 (`pg`), Redis 7 (`ioredis`), RabbitMQ 3 (`amqplib`)
- Zod for validation, Pino for logging, Helmet and CORS
- Jest 29 and supertest, ESLint, Prettier
- Docker and Docker Compose

## Getting started

```bash
git clone https://github.com/guillaume-lecomte/conference-room-booking-api
cd conference-room-booking-api
npm ci
npm run build
npm run test:unit
```

To run the API you need PostgreSQL, Redis and RabbitMQ. With Docker:

```bash
docker compose up -d --build
curl http://localhost:8001/api/health
```

Then create a booking for tomorrow (the API rejects start times in the past):

```bash
curl -X POST http://localhost:8001/api/bookings \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: demo-1" \
  -d "{\"roomId\":\"550e8400-e29b-41d4-a716-446655440001\",\"userId\":\"user-1\",\"title\":\"Team meeting\",\"startTime\":\"$(date -u -d '+1 day' +%Y-%m-%dT10:00:00Z)\",\"endTime\":\"$(date -u -d '+1 day' +%Y-%m-%dT11:00:00Z)\"}"
```

Sending the same request again returns the same booking. The `date -d` syntax is GNU `date`.

Verified on 2026-10-06 with Node.js 22: `npm ci`, `npm run build` and `npm run test:unit` succeed (52 tests, 92.64 % of lines covered). Not run: `docker compose up`, the API as a whole and the 28 integration tests in `tests/integration`, because the environment had no Docker and no RabbitMQ. The booking service was run against a real PostgreSQL 16 without Redis and RabbitMQ to check the points under Known issues.

## Status

Demonstration project, not maintained. Last activity 2026-02-05.

The repository has a single commit, authored by `emergent-agent-e1`, and contains working files from an AI coding agent: `test_result.md`, `memory/PRD.md`, `test_reports/` and `backend_test.py`.

## Known issues

- **Two requests can book the same slot.** The service reads the conflicting bookings and then inserts, with no transaction, lock or exclusion constraint in between (`createBooking` in [`BookingService.ts`](src/domain/services/BookingService.ts), `findConflictingBookings` in [`PostgresBookingRepository.ts`](src/infrastructure/database/PostgresBookingRepository.ts)). Reproduced on 2026-10-06 against PostgreSQL 16: with 20 simultaneous requests for the same room and slot, more than one was accepted in almost every attempt.
- **Concurrent requests with the same idempotency key are not handled cleanly.** The `UNIQUE` constraint prevents a duplicate row, but the violation is not translated: parallel requests got a mix of `409 ROOM_UNAVAILABLE` and an internal error. The key is not tied to the request body, so the same key with a different body returns the first booking without an error.
- **The rate limiter is in memory and per process**, so it does not hold across several instances.
- **Notifications and analytics are simulated.** The handlers only wait and log.
- **Events can be lost or loop.** When RabbitMQ is not connected, `emit` returns `false` and the event is dropped. A message whose handler throws is requeued without limit and there is no dead-letter queue.
- **Cache invalidation uses `KEYS`**, which is expensive on a large Redis database, and the availability cache is only invalidated once the event is consumed.
- **The domain layer imports infrastructure directly** (`BookingService.ts` imports the concrete `eventBus` and `cache`), so the layers are not independent.
- **Tests.** The 28 integration tests need PostgreSQL, Redis and RabbitMQ and were not run. `InMemoryCache` is only used by the tests, not by the application. `eventemitter2` is a dependency that nothing imports.
- **Lint.** `npm run lint` reports 72 errors and 2 warnings (2026-10-06).
- **Dependencies.** `npm audit --omit=dev` on 2026-10-06 reports 8 advisories (1 critical, 2 high).
- **Default credentials.** `apppassword` and `guest` appear in `docker-compose.yml` and as fallbacks in [`config/index.ts`](src/config/index.ts). They are for local use only.

## License

`package.json` declares MIT. There is no `LICENSE` file in the repository.
