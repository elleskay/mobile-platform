#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { VerificationArtifact, computeArtifactChecksum } from "./verification.js";

// Stamp (or check) the integrity checksum (layer A) on a verification artifact.
// Workflow: a tester fills in the artifact after a real-device run, runs
// `spec-attest --artifact <file>` to write the checksum, then commits it with a
// SIGNED commit (layer B). The signed commit is the binding attestation; this
// checksum just makes the in-file `signature` meaningful and tamper-evident.
//
//   spec-attest --artifact verification/SCAM-SMS-001.ios.yml          # write
//   spec-attest --artifact verification/SCAM-SMS-001.ios.yml --check  # verify only

interface Args {
  artifact: string;
  check: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { artifact: "", check: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--artifact") args.artifact = argv[++i] ?? "";
    else if (a === "--check") args.check = true;
    else if (a === "--help" || a === "-h") {
      console.log("spec-attest --artifact <path> [--check]");
      process.exit(0);
    }
  }
  if (!args.artifact) {
    console.error("error: --artifact <path> is required");
    process.exit(2);
  }
  return args;
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const path = resolve(args.artifact);
  const doc = parseYaml(readFileSync(path, "utf8")) as unknown;

  // Validate everything except the signature, which we are about to (re)compute.
  const parsed = VerificationArtifact.safeParse(doc);
  if (!parsed.success) {
    console.error(`spec-attest: ${path} is not a valid artifact`);
    console.error(JSON.stringify(parsed.error.issues, null, 2));
    process.exit(2);
  }

  const expected = computeArtifactChecksum(parsed.data);

  if (args.check) {
    const current = parsed.data.signature?.trim();
    if (current === expected) {
      console.log(`ok: ${args.artifact} checksum matches`);
      process.exit(0);
    }
    console.error(
      `tampered: ${args.artifact} checksum mismatch\n  in-file:  ${current ?? "(none)"}\n  expected: ${expected}`,
    );
    process.exit(1);
  }

  const updated = { ...parsed.data, signature: expected };
  writeFileSync(path, stringifyYaml(updated), "utf8");
  console.log(`stamped ${args.artifact}\n  ${expected}`);
}

main();
