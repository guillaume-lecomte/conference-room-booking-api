# Conference Room Booking API - PRD

## Date: 2026-02-05

## Problem Statement Original
API Node.js/Express démontrant les meilleures pratiques architecturales à travers un système de réservation de salles de conférence avec:
- Clean Architecture (séparation des couches)
- Idempotence via Idempotency-Key header
- Event-Driven Design avec EventEmitter2
- Caching Strategy (In-Memory avec TTL, cache-aside pattern)
- Rate Limiting (Sliding Window)
- PostgreSQL database
- Couverture tests minimum 80%

## User Personas
1. **Développeur Backend** - Veut apprendre les patterns architecturaux modernes
2. **Tech Lead** - Veut une référence pour code production-ready
3. **API Consumer** - Veut une API REST fiable avec idempotence

## Core Requirements (Static)
- [x] POST /api/bookings - Créer réservation (idempotent)
- [x] GET /api/bookings/:id - Récupérer réservation (cached)
- [x] PUT /api/bookings/:id/cancel - Annuler réservation
- [x] GET /api/rooms/:id/availability - Vérifier disponibilité (cached)
- [x] Health check endpoint
- [x] Rate limiting
- [x] Structured logging (Pino)
- [x] Error handling centralisé
- [x] Validation avec Zod

## What's Been Implemented

### 2026-02-05 - MVP Complete
- **Architecture Clean** complète:
  - `src/api/` - Routes, middlewares, validators
  - `src/domain/` - Entities, repositories, services
  - `src/infrastructure/` - Database, cache, events

- **Patterns implémentés**:
  - Idempotence via header Idempotency-Key avec TTL 24h
  - Event-Driven avec EventEmitter2 (booking.created, booking.cancelled)
  - Cache In-Memory avec TTL et cache-aside pattern
  - Rate Limiting Sliding Window (100 req/min)
  - Repository Pattern avec interfaces
  - Dependency Injection explicite

- **Database**: PostgreSQL avec 3 salles pré-seedées
- **Tests**: Unit tests (92.7% coverage), Integration tests
- **Error Handling**: Classes custom, mapping HTTP status codes

## Prioritized Backlog

### P0 - Done
- [x] API REST complète
- [x] PostgreSQL integration
- [x] Tests unitaires (92.7%)
- [x] Error handling complet

### P1 - Future
- [ ] Redis pour cache distribué
- [ ] Tests d'intégration complets
- [ ] OpenAPI/Swagger documentation
- [ ] Docker Compose setup

### P2 - Nice to Have
- [ ] Performance benchmarks
- [ ] GitHub Actions CI/CD
- [ ] Métriques Prometheus
- [ ] Architecture Decision Records (ADRs)

## Tech Stack
- Node.js 20 + TypeScript 5.x (strict mode)
- Express.js 4.x
- PostgreSQL 15
- Zod (validation)
- EventEmitter2 (events)
- Pino (logging)
- Jest + Supertest (testing)

## Next Tasks
1. Ajouter documentation Swagger/OpenAPI
2. Améliorer couverture tests d'intégration
3. Setup Docker Compose pour dev environment
