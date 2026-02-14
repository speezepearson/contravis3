import { test, expect, Page } from "@playwright/test";

/** Select an option from the action SearchableDropdown (first one in builder) */
async function selectAction(page: Page, label: string) {
  const input = page
    .locator(".instruction-builder .searchable-dropdown")
    .first()
    .locator("input");
  await input.click();
  await page
    .locator(".searchable-dropdown-popover li")
    .filter({ hasText: label })
    .click();
}

test.describe("default beats on action change", () => {
  test("allemande defaults to 8 beats", async ({ page }) => {
    await page.goto("/");
    await selectAction(page, "allemande");
    const beatsInput = page
      .locator('.instruction-builder input[inputmode="decimal"]')
      .last();
    await expect(beatsInput).toHaveValue("8");
  });

  test("step defaults to 2 beats", async ({ page }) => {
    await page.goto("/");
    await selectAction(page, "step");
    const beatsInput = page
      .locator('.instruction-builder input[inputmode="decimal"]')
      .last();
    await expect(beatsInput).toHaveValue("2");
  });

  test("take_hands has no beats input (always 0)", async ({ page }) => {
    await page.goto("/");
    await selectAction(page, "take hands");

    // No beats input should be visible for take_hands
    const beatsInputs = page.locator(
      '.instruction-builder input[inputmode="decimal"]',
    );
    await expect(beatsInputs).toHaveCount(0);
  });

  test("drop_hands has no beats input (always 0)", async ({ page }) => {
    await page.goto("/");
    await selectAction(page, "drop hands");

    const beatsInputs = page.locator(
      '.instruction-builder input[inputmode="decimal"]',
    );
    await expect(beatsInputs).toHaveCount(0);
  });

  test("turn defaults to 0 beats", async ({ page }) => {
    await page.goto("/");
    await selectAction(page, "allemande");
    await selectAction(page, "turn");

    const beatsInput = page
      .locator('.instruction-builder input[inputmode="decimal"]')
      .last();
    await expect(beatsInput).toHaveValue("0");
  });

  test("does not change beats when editing an existing instruction", async ({
    page,
  }) => {
    await page.goto("/");
    await selectAction(page, "allemande");
    const beatsInput = page
      .locator('.instruction-builder input[inputmode="decimal"]')
      .last();
    const addBtn = page.locator(".add-btn");

    // Add an allemande with 4 beats
    await beatsInput.fill("4");
    await addBtn.click();

    // Click edit on it
    await page.locator('.instruction-actions button[title="Edit"]').click();

    // Beats should be 4 (loaded from instruction), not the default 8
    await expect(beatsInput).toHaveValue("4");
  });
});

test.describe("number input free-form typing", () => {
  test('beats field accepts ".25" typed over selected content', async ({
    page,
  }) => {
    await page.goto("/");
    await selectAction(page, "step");

    const beatsInput = page
      .locator('.instruction-builder input[inputmode="decimal"]')
      .last();

    // Select all and type .25
    await beatsInput.fill("");
    await beatsInput.type(".25");
    await expect(beatsInput).toHaveValue(".25");
  });

  test('beats field accepts intermediate states like "1." while typing', async ({
    page,
  }) => {
    await page.goto("/");
    await selectAction(page, "turn");

    const beatsInput = page
      .locator('.instruction-builder input[inputmode="decimal"]')
      .last();

    await beatsInput.fill("");
    await beatsInput.type("1.");
    await expect(beatsInput).toHaveValue("1.");
  });

  test('distance field accepts ".5" typed from scratch', async ({ page }) => {
    await page.goto("/");
    await selectAction(page, "step");

    // Distance is the first decimal input when step is selected
    const distanceInput = page
      .locator('.instruction-builder input[inputmode="decimal"]')
      .first();

    await distanceInput.fill("");
    await distanceInput.type(".75");
    await expect(distanceInput).toHaveValue(".75");
  });

  test('instruction with ".25" beats is created correctly', async ({
    page,
  }) => {
    await page.goto("/");
    await selectAction(page, "turn");

    const beatsInput = page
      .locator('.instruction-builder input[inputmode="decimal"]')
      .last();
    await beatsInput.fill(".25");

    // Type a direction for the turn (second SearchableDropdown after action)
    const targetInput = page
      .locator(".instruction-builder .searchable-dropdown")
      .nth(1)
      .locator("input");
    await targetInput.fill("up");

    await page.locator(".add-btn").click();

    // Check the instruction summary shows 0.25b
    const summary = page.locator(".instruction-summary").first();
    await expect(summary).toContainText("0.25b");
  });
});

test.describe("balance action", () => {
  test("balance defaults to 4 beats", async ({ page }) => {
    await page.goto("/");
    await selectAction(page, "balance");

    const beatsInput = page
      .locator('.instruction-builder input[inputmode="decimal"]')
      .last();
    await expect(beatsInput).toHaveValue("4");
  });

  test("balance shows direction input", async ({ page }) => {
    await page.goto("/");
    await selectAction(page, "balance");

    // Should show a direction SearchableDropdown (second one, after action)
    const dirInput = page
      .locator(".instruction-builder .searchable-dropdown")
      .nth(1)
      .locator("input");
    await expect(dirInput).toBeVisible();
  });

  test("adding a balance instruction shows correct summary", async ({
    page,
  }) => {
    await page.goto("/");
    await selectAction(page, "balance");

    const dirInput = page
      .locator(".instruction-builder .searchable-dropdown")
      .nth(1)
      .locator("input");
    await dirInput.fill("across");

    await page.locator(".add-btn").click();

    const summary = page.locator(".instruction-summary").first();
    await expect(summary).toContainText("balance across 0.5 (4b)");
  });

  test("balance with facing-relative direction", async ({ page }) => {
    await page.goto("/");
    await selectAction(page, "balance");

    const dirInput = page
      .locator(".instruction-builder .searchable-dropdown")
      .nth(1)
      .locator("input");
    await dirInput.fill("forward");

    await page.locator(".add-btn").click();

    const summary = page.locator(".instruction-summary").first();
    await expect(summary).toContainText("balance forward 0.5 (4b)");
  });
});

test.describe("new facing-relative directions", () => {
  test('step accepts "forward" direction', async ({ page }) => {
    await page.goto("/");
    await selectAction(page, "step");

    const dirInput = page
      .locator(".instruction-builder .searchable-dropdown")
      .nth(1)
      .locator("input");
    await dirInput.fill("forward");

    await page.locator(".add-btn").click();

    const summary = page.locator(".instruction-summary").first();
    await expect(summary).toContainText("step forward");
  });

  test('step accepts "back" direction', async ({ page }) => {
    await page.goto("/");
    await selectAction(page, "step");

    const dirInput = page
      .locator(".instruction-builder .searchable-dropdown")
      .nth(1)
      .locator("input");
    await dirInput.fill("back");

    await page.locator(".add-btn").click();

    const summary = page.locator(".instruction-summary").first();
    await expect(summary).toContainText("step back");
  });

  test('step accepts "right" direction', async ({ page }) => {
    await page.goto("/");
    await selectAction(page, "step");

    const dirInput = page
      .locator(".instruction-builder .searchable-dropdown")
      .nth(1)
      .locator("input");
    await dirInput.fill("right");

    await page.locator(".add-btn").click();

    const summary = page.locator(".instruction-summary").first();
    await expect(summary).toContainText("step right");
  });

  test('step accepts "left" direction', async ({ page }) => {
    await page.goto("/");
    await selectAction(page, "step");

    const dirInput = page
      .locator(".instruction-builder .searchable-dropdown")
      .nth(1)
      .locator("input");
    await dirInput.fill("left");

    await page.locator(".add-btn").click();

    const summary = page.locator(".instruction-summary").first();
    await expect(summary).toContainText("step left");
  });

  test('turn accepts "forward" direction', async ({ page }) => {
    await page.goto("/");
    await selectAction(page, "turn");

    const dirInput = page
      .locator(".instruction-builder .searchable-dropdown")
      .nth(1)
      .locator("input");
    await dirInput.fill("forward");

    await page.locator(".add-btn").click();

    const summary = page.locator(".instruction-summary").first();
    await expect(summary).toContainText("turn forward");
  });

  test('direction autocomplete offers "forward" for "fo"', async ({ page }) => {
    await page.goto("/");
    await selectAction(page, "step");

    const dirDropdown = page
      .locator(".instruction-builder .searchable-dropdown")
      .nth(1);
    const dirInput = dirDropdown.locator("input");
    await dirInput.click();
    await dirInput.fill("fo");

    // Popover should show "forward" as an option
    const option = dirDropdown.locator(".searchable-dropdown-popover li", {
      hasText: "forward",
    });
    await expect(option).toBeVisible();
  });

  test("anti-progression is not in autocomplete", async ({ page }) => {
    await page.goto("/");
    await selectAction(page, "step");

    const dirDropdown = page
      .locator(".instruction-builder .searchable-dropdown")
      .nth(1);
    const dirInput = dirDropdown.locator("input");
    await dirInput.click();
    await dirInput.fill("anti");

    // No options should appear for "anti"
    const options = dirDropdown.locator(".searchable-dropdown-popover li");
    await expect(options).toHaveCount(0);
  });
});
