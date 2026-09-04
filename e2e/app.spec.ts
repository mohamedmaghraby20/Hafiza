import { expect, test } from "@playwright/test";

test("opens the Hafiza application", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("Hafiza");
  await expect(
    page.getByRole("heading", { name: "Good morning." }),
  ).toBeVisible();
  await expect(page.locator(".home-hero")).toHaveCSS(
    "background-color",
    "rgb(68, 56, 163)",
  );
  await expect(page.getByRole("button", { name: "Start review" })).toHaveCSS(
    "color",
    "rgb(68, 56, 163)",
  );
  await page.getByRole("button", { name: "Library", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Library" })).toBeVisible();
  await expect(page.getByLabel("Deck folder")).toHaveCSS("appearance", "none");
  await expect(page.locator("svg.lucide-chevron-down").first()).toBeVisible();

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
  await page.getByRole("button", { name: "Library", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Turkish basics/ }),
  ).toContainText("1 cards");

  await page.getByRole("button", { name: /Turkish basics/ }).click();
  await page.getByRole("button", { name: "Start review" }).click();
  await expect(page.getByRole("heading", { name: "Hello" })).toBeVisible();
  await page.keyboard.press("Space");
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
  await page.keyboard.press("3");
  await expect(page.getByRole("heading", { name: "Nice work" })).toBeVisible();
  await page.getByRole("button", { name: "View progress" }).click();
  await expect(page.getByText("Cards reviewed", { exact: true })).toBeVisible();

  await page.context().setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Good morning." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Library", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Turkish basics/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Turkish basics/ }),
  ).toContainText("0 due");

  await page.reload();
  await page.getByRole("button", { name: "Library", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Turkish basics/ }),
  ).toContainText("1 cards");
});

test("imports cards and transactionally restores a local backup", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Library", exact: true }).click();
  await page.getByLabel("New deck").fill("Import target");
  await page.getByRole("button", { name: "Add" }).first().click();

  await page.getByRole("button", { name: "+ Create", exact: true }).click();
  await page.getByRole("button", { name: "Import" }).click();
  await page.getByLabel("CSV or XLSX file").setInputFiles({
    name: "geography.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "Question,Answer,Tags\nCapital of Turkey?,Ankara,geography",
    ),
  });
  await expect(page.getByText(/1 valid rows/)).toBeVisible();
  await page.getByRole("button", { name: "Import 1 cards" }).click();
  await expect(page.getByText("Imported 1 cards locally.")).toBeVisible();

  await page.getByRole("button", { name: "Library", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Import target/ }),
  ).toContainText("1 cards");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export backup" }).click();
  const download = await downloadPromise;
  const backupPath = await download.path();
  expect(backupPath).not.toBeNull();

  await page.getByRole("button", { name: "Library", exact: true }).click();
  await page.getByLabel("New deck").fill("Temporary deck");
  await page.getByRole("button", { name: "Add" }).first().click();
  await expect(
    page.getByRole("button", { name: /Temporary deck/ }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByLabel("Choose a Hafiza backup").setInputFiles(backupPath);
  await expect(page.getByText(/1 decks and 1 cards/)).toBeVisible();
  await page.getByRole("button", { name: "Confirm restore" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Restore backup" }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Cancel" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await page.getByRole("button", { name: "Restore backup" }).click();

  await page.getByRole("button", { name: "Library", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Import target/ }),
  ).toContainText("1 cards");
  await expect(
    page.getByRole("button", { name: /Temporary deck/ }),
  ).toHaveCount(0);
});

test("keeps primary journeys usable on a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await page.keyboard.press("Tab");
  const skipLink = page.getByRole("link", { name: "Skip to content" });
  await expect(skipLink).toBeFocused();
  await skipLink.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();

  const navigation = page.getByRole("navigation", {
    name: "Primary navigation",
  });
  await expect(navigation).toBeVisible();
  await page.getByRole("button", { name: "Library", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Library" })).toBeVisible();
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Create cards" }),
  ).toBeVisible();
  expect(
    await page.evaluate<boolean>(
      "document.documentElement.scrollWidth <= window.innerWidth",
    ),
  ).toBe(true);
});
