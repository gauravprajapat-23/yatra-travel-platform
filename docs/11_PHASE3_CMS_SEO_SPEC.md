# Phase 3 — CMS & SEO Content Model

## Scope
Phase 3 owns:
- CMS pages
- destination content
- temple-specific destination profiles
- blog categories/posts
- FAQs
- media metadata
- content revisions
- SEO redirects
- publication/indexing rules

Offers, package pricing, bookings and fleet operations are not part of this phase.

## Publication rule
A record is public only when:
1. status is PUBLISHED
2. publishedAt exists
3. publishedAt is not in the future

A SCHEDULED row is never treated as public merely because its scheduled time passed. Promotion to PUBLISHED is an explicit server-side operation.

## Structured content
Rich content is stored as structured JSON blocks.
Raw executable HTML/script is not an allowed CMS block type.

## SEO
Each indexable content type supports:
- SEO title
- SEO description
- canonical override
- robots index
- robots follow
- hero media

Search, private, account, admin and transactional routes remain non-indexable.

## Redirect safety
- sourcePath unique
- internal paths only
- source and destination cannot match
- only 301 or 302 allowed at database and domain layers

## Revisions
ContentRevision stores immutable snapshots by entity type/id/version.
Publishing workflows must create revisions before destructive content replacement once admin editing is implemented.

## Media
MediaAsset stores provider-neutral object metadata.
Storage credentials/SDK behavior remain outside the content schema.
