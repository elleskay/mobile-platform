// Fixture for the require-expect-in-spec-test rule (see eslint.test.mjs).
// Current convention: plain test()/it() whose title starts with the spec [ID].
import { test, expect } from "@platform/spec-test/playwright";

// MUST be flagged: carries a spec ID but records no assertion.
test("[EX-AUTH-001] unauthed users are redirected", async ({ page }) => {
  await page.goto("/admin");
});

// Must NOT be flagged: has an expect().
test("[EX-AUTH-002] officers are blocked from admin", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/login/);
});

// Must NOT be flagged: no spec ID in the title, so the rule does not apply.
test("smoke: admin route responds", async ({ page }) => {
  await page.goto("/admin");
});
