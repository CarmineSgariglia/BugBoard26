import { expect, test } from "@playwright/test";

import { loginAsDev } from "./utils/auth";

test("@smoke logs in and lands on the projects page", async ({ page }) => {
  await loginAsDev(page);

  await expect(page).toHaveURL(/\/projects$/);
  await expect(page.getByRole("heading", { name: /hello/i })).toBeVisible();
  await expect(page.getByText("Bruno CI Project")).toBeVisible();
});
