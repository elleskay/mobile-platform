# Secure Software Development Lifecycle

What this template gives you out of the box, and what each app is expected to maintain.

## What the template provides

| Control | Where |
|---|---|
| Dependency scanning | `.github/dependabot.yml` |
| Code scanning (SAST) | `.github/workflows/security.yml` (CodeQL) |
| Secret scanning | GitHub native + gitleaks workflow |
| `npm audit` on CI | `.github/workflows/security.yml` |
| Branch protection | manual GitHub setting (see SETUP.md) |
| Conventional commits | `commitlint.config.mjs` |
| PR template with security checkbox | `.github/pull_request_template.md` |
| Disclosure policy | `SECURITY.md` |

## What each app must add

| Control | How |
|---|---|
| API hardening | Helmet on the NestJS API; the client is native, so there is no web header surface |
| Input validation | class-validator on every controller DTO; Zod where a schema is shared with the app |
| Auth | JWT access tokens issued by the API; store on device in expo-secure-store, never AsyncStorage |
| Authorization | NestJS guards per route, principle of least privilege |
| Rate limiting | NestJS throttler (or AWS WAF on API Gateway) on auth and report routes |
| Transport | TLS only: iOS ATS on, Android cleartext off via the `expo-build-properties` plugin |
| Secrets in prod | GitHub Actions secrets, Lambda env, and EAS secrets. Nothing secret ships in the app bundle |
| Error tracking | Sentry (catches unhandled exceptions that may leak info) |
| Logging | Structured JSON logs, no PII, no secrets |
| Database access | Parameterized queries only (ORM enforces this) |

## Threat model basics

For every new feature, ask:

1. What inputs does it accept? Are they validated?
2. Who is allowed to call it? How is that enforced?
3. What does it read or write? Could it leak data?
4. What happens on failure? Does the error response leak info?
5. Is anything cached? Could caching cross user boundaries?

## Incident response

If a vulnerability is found:

1. Acknowledge to reporter within 72 hours
2. Patch in a private branch
3. Rotate any leaked secrets via AWS Secrets Manager
4. Deploy fix
5. Disclose publicly after patch is live

## References

- OWASP Top 10
- OWASP ASVS for verification levels
- AWS Well-Architected, Security Pillar
