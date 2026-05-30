// Self-test for the require-expect-in-spec-test rule. Lints bad.test.ts and
// asserts the rule fires on exactly the assertion-less [ID] test and nothing
// else. Exit 0 = rule behaves; exit 1 = rule regressed. Run from packages/spec-test
// after a build:
//   node samples/eslint.test.mjs
import { Linter } from "eslint";
import { readFileSync } from "node:fs";
import { plugin } from "../dist/eslint-rule.js";

const linter = new Linter();
const code = readFileSync(new URL("./bad.test.ts", import.meta.url), "utf8");

const results = linter.verify(
  code,
  {
    files: ["**/*.ts"],
    plugins: { "spec-test": plugin },
    rules: { "spec-test/require-expect-in-spec-test": "error" },
    languageOptions: {
      parserOptions: { ecmaVersion: 2022, sourceType: "module" },
    },
  },
  { filename: "bad.test.ts" },
);

const errors = results.filter((r) => r.severity === 2);
console.log(JSON.stringify(errors, null, 2));

if (errors.length !== 1 || !errors[0].message.includes("EX-AUTH-001")) {
  console.error(
    `expected exactly 1 error on EX-AUTH-001 (assertion-less spec test), got ${errors.length}`,
  );
  process.exit(1);
}
console.log("rule correctly flags only the assertion-less [ID] test");
