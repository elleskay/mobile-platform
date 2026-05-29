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

console.log(JSON.stringify(results, null, 2));
process.exit(results.some((r) => r.severity === 2) ? 1 : 0);
