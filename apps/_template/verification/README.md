# verification/

Signed, real-device verification artifacts for `verify: native | manual`
requirements. These stand in for automated tests, which cannot exist for OS-level
behavior (call/SMS interception runs out of process). See
`docs/adr/0001-testing-architecture.md` and `docs/TESTING.md`.

## Files

- `os-baseline.yml` - the current iOS/Android versions you claim to handle. The
  gate marks an artifact stale if its `os_tested` is behind this, which catches an
  OS point release changing CallKit/SMS behavior with no app bump. Keep it current.
- `<REQ-ID>.<platform>.yml` - one per native/manual requirement per platform
  (omit `.<platform>` for a platform-agnostic requirement).
- `allowed-signers` - who may attest. SSH allowed-signers format. CODEOWNERS-protected.

## Two-layer protection

- **A, integrity (in-file checksum):** `signature` holds `sha256:<hex>` over the
  canonical body minus the signature, stamped by `spec-attest`. The gate
  recomputes and compares, so editing the body after stamping (e.g. bumping
  `date` to dodge the TTL) is caught as `tampered`. Run `spec-attest --artifact
  <file>` to stamp, `--check` to verify.
- **B, accountability (signed commit):** the binding attestation is the GPG/SSH
  signature on the commit that last touched the artifact, by a signer in
  `allowed-signers`. Enforced in CI by `scripts/verify-attestations.sh`, which
  checks the LAST commit per file and fails closed (a signed commit further back
  does not vouch for a later unsigned edit). Skips while `allowed-signers` is
  empty (template default); populate it to activate.

A is integrity, B is accountability. Neither proves a human truly ran the device
test, that is what the signer attests to and is accountable for.

## os-baseline.yml bump convention

The baseline is the real freshness control; the 90-day TTL is only the backstop.
It is CODEOWNERS-owned by the release/security reviewer. A PR that bumps it MUST:

1. cite the OS release (e.g. iOS 18.4, Android 15), and
2. name the specific behavior of concern, the API whose behavior could have
   changed: CallKit / Call Directory / IdentityLookup (Message Filter) /
   CallScreening.

Bumping the baseline invalidates (marks stale) every native artifact tested on an
older OS for that platform, forcing real-device re-verification. That is the point.
Do not bump it reflexively on every OS release, only when a relevant subsystem
could have changed. (A scheduled job that opens a reminder issue when the baseline
lags shipping OS versions is planned: automate the prompt, never the judgment.)

## The example artifacts here are intentionally unsigned

The `EX-*.yml` files are placeholders with no `signature`. While they are
unsigned, the attestation check skips (no real claims to attest) and the spec
gate reports those requirements unverified, which is honest: no device test has
run. When you do the real verification, fill in the values, `spec-attest` to
stamp the checksum, and commit with a signed commit by an allowlisted signer.
The moment any artifact carries a signature, an empty `allowed-signers` becomes a
hard error (exit 2), so accountability cannot be left off by forgetting.

## Artifact format

```yaml
requirement: EX-SMS-001
platform: ios
app_version: 1.4.0
os_tested: "18.3.1"
device: iPhone 13
date: 2026-05-20
tester: <your name>
evidence: https://.../screen-recording.mp4
signature: <non-empty; commit-signed or a checksum you stand behind>
```

## When the gate fails one

Missing, unsigned, invalid, or stale. Stale = app version moved, OR `os_tested`
behind `os-baseline.yml`, OR older than the 90-day TTL. Re-run the real-device
check, update the artifact, commit. "Re-verify once per release or every 90 days,
whichever comes first."

These example artifacts will eventually go stale by design. Replace them with your
own when you build the real app.
