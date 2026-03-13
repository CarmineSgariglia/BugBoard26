import { expect, test } from "@playwright/test";

import { loginAsDev } from "./utils/auth";

test("@smoke opens the seeded project and issue flow", async ({ page }) => {
  await loginAsDev(page);

  await page.getByText("Bruno CI Project").click();
  await expect(page).toHaveURL(/\/projects\/\d+\/issues$/);
  await expect(page.getByRole("heading", { name: /manage issues/i })).toBeVisible();

  await page.getByText(/Bruno CI Issue/).click();
  await expect(page).toHaveURL(/\/projects\/\d+\/issues\/\d+$/);
  await expect(page.getByText("Bruno CI Issue")).toBeVisible();
});
