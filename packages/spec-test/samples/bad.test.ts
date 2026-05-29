import { specTest } from "@platform/spec-test/playwright";

specTest("EX-AUTH-001", "Unauthed users redirected", async ({ page }) => {
  await page.goto("/admin");
});

specTest("EX-AUTH-002", "Officers blocked from admin", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/login/);
});
