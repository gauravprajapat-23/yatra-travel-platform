# Environments and Secrets

Required environments:
- local
- test
- staging
- production

Rules:
- Never share credentials across environments.
- Production secrets never appear in .env.example.
- Browser environment variables must never contain private secrets.
- Use runtime secret management in hosting/provider.
- Webhook secrets are server-only.
- Database URLs are server-only.
- Storage signing credentials are server-only.
- Rotate leaked credentials immediately.
