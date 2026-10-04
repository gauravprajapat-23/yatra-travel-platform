# Repository Conventions

Recommended monorepo-style structure even if deployed as one application:

apps/
  web/
packages/
  db/
  domain/
  ui/
  config/
  validation/
  providers/
docs/
scripts/

Inside apps/web:
app/
  (public)/
  (customer)/
  admin/
  api/
src/
  modules/
    auth/
    booking/
    fleet/
    drivers/
    packages/
    destinations/
    offers/
    payments/
    customers/
    leads/
    cms/
    seo/
    media/
    reports/
  lib/
  components/

Rules:
- Domain logic does not live in page components.
- Route handlers stay thin.
- Validation schemas are reusable.
- Database access goes through repositories/data services.
- Provider SDK usage stays behind adapters.
- Avoid circular imports.
- No cross-domain direct DB mutation without service boundary.
