# YATRA — Phase 0 Requirements Lock & Repository Baseline

Status: PHASE 0 BASELINE CREATED

This repository is the implementation baseline for the YATRA tour-and-travel platform.

## Product surfaces
1. Public SEO website
2. Car search and booking
3. Tour/package discovery and booking
4. Customer booking lookup/self-service
5. Admin/CMS/operations portal

## Baseline architecture
- Web: Next.js + TypeScript
- Styling: Tailwind CSS + accessible component primitives
- Database: PostgreSQL
- ORM: Prisma or Drizzle (choose one at repository bootstrap and keep it consistent)
- Object storage: S3-compatible abstraction
- Payments: Razorpay-compatible provider abstraction
- Notifications: provider abstractions for email/SMS/WhatsApp
- Architecture style: modular monolith
- Deployment: managed frontend + managed PostgreSQL + object storage
- Cache/queue: add only when measured need exists

## Phase 0 hard gates
- Requirements locked
- Roles and permissions locked
- Booking/payment lifecycle locked
- Public vs private data boundaries locked
- SEO routing policy locked
- Environment separation locked
- Secret handling rules locked
- Migration policy locked
- Repository conventions locked
- Definition of Done locked

No feature phase should change these without an explicit ADR.
