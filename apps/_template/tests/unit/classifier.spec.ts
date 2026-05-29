import { localHeuristic } from "../../lib/classifier";

// Unit (data) layer on jest-expo. Test names carry the spec [ID]; the jest
// recorder (tests/jest.setup.unit.ts) records pass/fail. The spec-test ESLint
// rule fails lint if an [ID] test has no expect().
test("[EX-CLASSIFY-001] link plus lure scores as scam", () => {
  const result = localHeuristic("URGENT: verify your bank account http://evil.example");
  expect(result.verdict).toBe("scam");
  expect(result.score).toBeGreaterThanOrEqual(0.8);
});

test("[EX-CHECK-002] ordinary message is clean", () => {
  const result = localHeuristic("hey are we still on for lunch tomorrow");
  expect(result.verdict).toBe("clean");
});
