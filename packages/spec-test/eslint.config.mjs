import base from "../../eslint.config.base.mjs";

export default [
  ...base,
  {
    // CLI entry points: console IS the output channel.
    files: ["src/cli.ts", "src/attest.ts", "src/maestro.ts"],
    rules: { "no-console": "off" },
  },
  {
    // Playwright fixtures with no dependencies destructure an empty object by
    // convention: test.extend({ fixture: [async ({}, use) => ...] }).
    files: ["src/playwright.ts"],
    rules: { "no-empty-pattern": ["error", { allowObjectPatternsAsParameters: true }] },
  },
  {
    // samples/ are fixtures (bad.test.ts intentionally violates the rule this
    // package ships); they are exercised by CI, not linted.
    ignores: ["dist/**", "samples/**"],
  },
];
