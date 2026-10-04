# Definition of Done

A phase is not complete until applicable checks pass:

1. Formatting
2. Lint
3. Typecheck
4. Unit tests
5. Integration tests for critical paths
6. Production build
7. Security boundary review
8. Authorization review
9. Error/loading/empty state review
10. Mobile responsive review
11. Accessibility review
12. SEO behavior review for public pages
13. Database migration verification
14. No secrets committed
15. Evidence recorded in phase report

Critical flows additionally require:
- booking idempotency
- payment webhook verification
- payment duplicate-delivery test
- booking state transition tests
- price tampering tests
- permission tests
