# Phase 2 — Auth Security Baseline

## Authentication boundary
Authentication remains server-only. Browser code must never decide roles, permissions, booking ownership, payment authority or admin access.

## Session model
- Use opaque random session tokens.
- Generate at least 32 random bytes.
- Store only a cryptographic hash of the token in PostgreSQL.
- Send the raw token only in an HttpOnly cookie.
- Cookie name: `__Host-yatra_session`.
- Cookie path: `/`.
- SameSite: `Lax`.
- Secure: required in production.
- Default maximum lifetime: 7 days.
- Sessions are revocable server-side.
- Rotate/replace a session on authentication-level changes.

## Credential rules
- Never store plaintext passwords.
- Password hashing implementation will use a memory-hard/password-specific algorithm when credential login is enabled.
- Do not log passwords, password-reset tokens, OTPs or raw session tokens.
- Normalize email before lookup and maintain a unique normalized form.

## RBAC
Roles:
- SUPER_ADMIN
- OWNER_ADMIN
- BOOKING_SALES
- OPERATIONS
- CONTENT_SEO
- FINANCE
- AUDITOR
- CUSTOMER

Permissions are enforced on the server through the domain authorization layer.

## Login abuse controls
Initial policy:
- 8 attempts / 15 minutes / identity
- 30 attempts / 15 minutes / IP
- 3 password-reset requests / hour / identity

These values are configurable; enforcement will be added when login endpoints are introduced.

## Customer access
Guest booking remains supported. A customer account is optional.
Customer sessions may access only resources whose ownership has been verified server-side.

## Admin audit
Privileged mutations must record:
- actor user
- action
- entity type
- entity id where applicable
- request/correlation id where applicable
- safe metadata
- timestamp

Sensitive values must not be copied into audit metadata.
