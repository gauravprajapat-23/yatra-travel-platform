# Phase 2 — Database & Auth Foundation Status

Status: IN PROGRESS

## Implemented
- [x] PostgreSQL selected as system of record
- [x] Prisma 7 stable line selected
- [x] Database workspace created
- [x] User model
- [x] Role model
- [x] User-role assignment model
- [x] Revocable opaque session model
- [x] Privileged audit-log model
- [x] Static RBAC permission matrix
- [x] Session security policy
- [x] CI Prisma generate/schema validation
- [x] Domain typecheck gate

## Blocked until database connection is supplied
- [ ] Create and apply first real migration
- [ ] Seed canonical roles
- [ ] Run migration status against Neon
- [ ] Database integration tests

## Deliberately deferred
- Credential login endpoints
- OAuth provider integration
- Password reset
- Email verification delivery

Those are implemented after the database is connected and provider decisions/secrets exist.
