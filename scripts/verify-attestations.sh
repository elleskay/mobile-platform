#!/usr/bin/env bash
# Layer B: verify that every native/manual verification artifact was last
# committed by an allowlisted signer with a valid commit signature.
#
# The in-file checksum (layer A, spec-attest) proves the body was not edited
# after stamping. This proves a real, allowlisted person stands behind it.
# It checks the signature on the commit that LAST TOUCHED each file and FAILS
# CLOSED: a signed commit three commits back does not vouch for an edit made
# since, an unsigned later edit fails the gate.
#
# Usage:
#   ./scripts/verify-attestations.sh [verification-dir] [allowed-signers-file]
#
# Defaults: dir=verification, allowed-signers=<dir>/allowed-signers
#
# Skip-if-unconfigured: if the allowed-signers file is missing or contains no
# real signer lines (only comments/blank), the check prints a notice and exits 0,
# the same convention as the deploy preflight. Populate allowed-signers (and
# protect it via CODEOWNERS) to activate enforcement.

set -euo pipefail

DIR="${1:-verification}"
ALLOWED="${2:-$DIR/allowed-signers}"

note() { printf "  %s\n" "$*"; }
fail() { printf "\033[31mFAIL\033[0m %s\n" "$*"; }
ok()   { printf "\033[32m OK \033[0m %s\n" "$*"; }

if [ ! -d "$DIR" ]; then
  echo "::notice::no verification dir at '$DIR'; nothing to attest."
  exit 0
fi

# Count real (non-comment, non-blank) lines in the allow-list.
real_signers=0
if [ -f "$ALLOWED" ]; then
  real_signers=$(grep -cvE '^\s*(#|$)' "$ALLOWED" || true)
fi

# Count artifacts that carry a real (non-empty) signature. A stamped+signed
# artifact is a real native claim; an unsigned placeholder is not. This is what
# decides whether an empty allow-list is a benign template default or a
# misconfiguration that silently disables accountability.
shopt -s nullglob
signed_artifacts=0
for f in "$DIR"/*.yml; do
  [ "$(basename "$f")" = "os-baseline.yml" ] && continue
  if grep -Eq '^signature:[[:space:]]*[^[:space:]]' "$f"; then
    signed_artifacts=$((signed_artifacts + 1))
  fi
done

if [ "$real_signers" -eq 0 ]; then
  if [ "$signed_artifacts" -gt 0 ]; then
    # Mirror the --app-version guard: accountability must not be opt-in by
    # forgetting. Signed claims with no allow-list would make B a silent no-op.
    fail "$signed_artifacts signed artifact(s) in '$DIR' but allowed-signers ('$ALLOWED') is empty."
    note "B would be a silent no-op. Populate allowed-signers (CODEOWNERS-protected) with the testers' keys, or remove the unverified artifacts."
    exit 2
  fi
  echo "::notice::allowed-signers ('$ALLOWED') has no entries and no signed artifacts present; skipping attestation. Normal for the template before any real native verification."
  exit 0
fi

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  fail "not inside a git work tree; cannot attest (fail closed)."
  exit 1
fi

# Use the allow-list as the SSH allowed-signers source so %G? == G means
# "good signature from an allowlisted signer".
git config gpg.ssh.allowedSignersFile "$(pwd)/$ALLOWED"

shopt -s nullglob
artifacts=()
for f in "$DIR"/*.yml; do
  base="$(basename "$f")"
  case "$base" in
    os-baseline.yml) continue ;;
  esac
  artifacts+=("$f")
done

if [ "${#artifacts[@]}" -eq 0 ]; then
  echo "::notice::no artifacts in '$DIR'; nothing to attest."
  exit 0
fi

failures=0
for f in "${artifacts[@]}"; do
  # Quote the format strings: %G? contains '?', a glob metacharacter, and
  # nullglob is on, so an unquoted %G? expands away and git prints the whole
  # commit instead of the signature status.
  commit="$(git log -1 --format='%H' -- "$f" || true)"
  if [ -z "$commit" ]; then
    fail "$f: not tracked by git (fail closed)."
    failures=$((failures + 1))
    continue
  fi
  sigstatus="$(git show -s --format='%G?' "$commit")"
  signer="$(git show -s --format='%GS' "$commit" || true)"
  if [ "$sigstatus" = "G" ]; then
    ok "$f: signed by allowlisted signer ($signer), commit ${commit:0:8}"
  else
    fail "$f: last commit ${commit:0:8} signature status '$sigstatus' (signer: '${signer:-none}'). Need a good signature from an allowlisted signer."
    failures=$((failures + 1))
  fi
done

echo
if [ "$failures" -gt 0 ]; then
  echo "Attestation failed: $failures artifact(s) not properly signed."
  exit 1
fi
echo "All native/manual artifacts attested by allowlisted signers."
