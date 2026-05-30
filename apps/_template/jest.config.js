// jest-expo for the app's unit + component layers (ADR 0001). Two projects so
// each layer records its spec coverage under the right category: unit -> data,
// component -> ui. e2e is Maestro (see .maestro/ and docs/TESTING.md), the API
// keeps Vitest. Reset coverage once before the run via the test:spec script.
module.exports = {
  // Cap workers: CI runners are often 2-core and jest-expo workers are heavy;
  // unbounded parallel workers can be OOM-killed mid-test on small runners.
  maxWorkers: 2,
  projects: [
    {
      preset: "jest-expo",
      displayName: "unit",
      testMatch: ["**/tests/unit/**/*.spec.ts"],
      setupFilesAfterEnv: ["<rootDir>/tests/jest.setup.unit.ts"],
      moduleNameMapper: { "^@/(.*)$": "<rootDir>/$1" },
    },
    {
      preset: "jest-expo",
      displayName: "component",
      testMatch: ["**/tests/component/**/*.spec.tsx"],
      setupFilesAfterEnv: ["<rootDir>/tests/jest.setup.component.ts"],
      moduleNameMapper: { "^@/(.*)$": "<rootDir>/$1" },
    },
  ],
};
