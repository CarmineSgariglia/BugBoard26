import type { Page } from "@playwright/test";

export async function loginAsDev(page: Page) {
  await page.goto("/login");
  await page.getByPlaceholder("Email").fill("dev@test.it");
  await page.getByPlaceholder("Password").fill("StrongPass123!");
  await page.getByRole("button", { name: "Login" }).click();
}
