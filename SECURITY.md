# Security Policy

## Reporting a vulnerability

Report security issues via either channel (prefer the first if available):

1. **GitHub Private Vulnerability Reporting:** [github.com/elleskay/mobile-platform/security/advisories/new](https://github.com/elleskay/mobile-platform/security/advisories/new). Encrypted, tracked, and lets us coordinate a fix and CVE if needed.
2. **Email:** lskpes10@gmail.com

Do not open public GitHub issues for security problems.

Expected response time: 72 hours.

## Supported versions

Latest `main` only.

## Scope

This template provides platform-layer security defaults for a mobile app plus its API:

- Dependency scanning via Dependabot
- Code scanning via GitHub CodeQL
- Secret scanning via GitHub native
- Input validation via Zod / class-validator at every NestJS controller boundary
- JWT auth on the API, short-lived access tokens issued to the mobile client
- Rate limiting on sensitive API routes
- Secrets managed via AWS Secrets Manager and EAS secrets (not env files in prod)
- App Transport Security (iOS) and cleartext-traffic disabled (Android); TLS only
- No secrets baked into the mobile bundle (anything shipped to the device is public)

Apps built on this template are expected to maintain these defaults and add app-specific controls as needed.

See `docs/SSDLC.md` for the secure development lifecycle this template assumes.
