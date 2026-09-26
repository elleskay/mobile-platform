# Security Policy

## Reporting a vulnerability

Report security issues through **GitHub Private Vulnerability Reporting:** [github.com/elleskay/mobile-platform/security/advisories/new](https://github.com/elleskay/mobile-platform/security/advisories/new). Encrypted, tracked, and lets us coordinate a fix and CVE if needed.

Do not open public GitHub issues for security problems.

Expected response time: 72 hours.

## Supported versions

Latest `main` only.

## Scope

This template provides platform-layer security defaults for a mobile app plus its API:

- Dependency scanning via Dependabot
- Code scanning via GitHub CodeQL
- Secret scanning via GitHub native and gitleaks
- Keyless deploys: GitHub OIDC into a repo-scoped, least-privilege IAM role
- Input validation via class-validator DTOs behind a global `ValidationPipe` that rejects unknown fields
- Secrets in GitHub Actions secrets, the Lambda environment, and EAS secrets, never in committed env files
- App Transport Security (iOS) and cleartext-traffic disabled (Android); TLS only
- No secrets baked into the mobile bundle (anything shipped to the device is public)

Apps built on this template are expected to maintain these defaults and add app-specific controls, including JWT issuing, authorization guards, and rate limiting on sensitive routes.

See `docs/SSDLC.md` for the secure development lifecycle this template assumes.
