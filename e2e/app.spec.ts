import { expect, test } from "@playwright/test";

test("opens the Hafiza application", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("Hafiza");
  await expect(
    page.getByRole("heading", { name: "Good morning." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Library" }).click();
  await expect(page.getByRole("heading", { name: "Your decks" })).toBeVisible();

  await page.getByLabel("New deck").fill("Turkish basics");
  await page.getByRole("button", { name: "Add" }).first().click();
  await expect(
    page.getByRole("button", { name: /Turkish basics/ }),
  ).toContainText("0 cards");

  await page.getByRole("button", { name: "+ Create" }).click();
  await page.getByPlaceholder("Type the question or prompt…").fill("Hello");
  await page.getByPlaceholder("Write the answer…").fill("Merhaba");
  await page.getByRole("button", { name: "Save card" }).click();
  await expect(page.getByRole("heading", { name: "Cards" })).toBeVisible();
  await page.getByRole("button", { name: "Library" }).click();
  await expect(
    page.getByRole("button", { name: /Turkish basics/ }),
  ).toContainText("1 cards");

  await page.getByRole("button", { name: /Turkish basics/ }).click();
  await page.getByRole("button", { name: "Start review" }).click();
  await expect(page.getByRole("heading", { name: "Hello" })).toBeVisible();
  await page.getByRole("button", { name: "Show answer" }).click();
  await expect(page.getByRole("heading", { name: "Merhaba" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Again/ })).toHaveCSS(
    "background-color",
    "rgb(250, 227, 222)",
  );
  await expect(page.getByRole("button", { name: /Hard/ })).toHaveCSS(
    "background-color",
    "rgb(247, 237, 212)",
  );
  await expect(page.getByRole("button", { name: /Good/ })).toHaveCSS(
    "background-color",
    "rgb(227, 242, 232)",
  );
  await expect(page.getByRole("button", { name: /Easy/ })).toHaveCSS(
    "background-color",
    "rgb(229, 237, 250)",
  );
  await expect(
    page.getByRole("navigation", { name: "Primary navigation" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Good/ }).click();
  await expect(page.getByRole("heading", { name: "Nice work" })).toBeVisible();
  await page.getByRole("button", { name: "View progress" }).click();
  await expect(page.getByText("Cards reviewed")).toBeVisible();

  await page.context().setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Good morning." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Library" }).click();
  await expect(
    page.getByRole("button", { name: /Turkish basics/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Turkish basics/ }),
  ).toContainText("0 due");

  await page.reload();
  await page.getByRole("button", { name: "Library" }).click();
  await expect(
    page.getByRole("button", { name: /Turkish basics/ }),
  ).toContainText("1 cards");
});
