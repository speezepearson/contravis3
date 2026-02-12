import { test, expect } from '@playwright/test';

test.describe('default beats on action change', () => {
  test('allemande defaults to 8 beats', async ({ page }) => {
    await page.goto('/');
    const actionSelect = page.locator('.instruction-builder select').first();
    const beatsInput = page.locator('.instruction-builder input[inputmode="decimal"]').last();

    await actionSelect.selectOption('allemande');
    await expect(beatsInput).toHaveValue('8');
  });

  test('step defaults to 2 beats', async ({ page }) => {
    await page.goto('/');
    const actionSelect = page.locator('.instruction-builder select').first();
    const beatsInput = page.locator('.instruction-builder input[inputmode="decimal"]').last();

    await actionSelect.selectOption('step');
    await expect(beatsInput).toHaveValue('2');
  });

  test('take_hands defaults to 0 beats', async ({ page }) => {
    await page.goto('/');
    const actionSelect = page.locator('.instruction-builder select').first();

    // Switch to allemande first (8 beats), then back to take_hands
    await actionSelect.selectOption('allemande');
    await actionSelect.selectOption('take_hands');

    const beatsInput = page.locator('.instruction-builder input[inputmode="decimal"]').last();
    await expect(beatsInput).toHaveValue('0');
  });

  test('turn defaults to 0 beats', async ({ page }) => {
    await page.goto('/');
    const actionSelect = page.locator('.instruction-builder select').first();

    await actionSelect.selectOption('allemande');
    await actionSelect.selectOption('turn');

    const beatsInput = page.locator('.instruction-builder input[inputmode="decimal"]').last();
    await expect(beatsInput).toHaveValue('0');
  });

  test('does not change beats when editing an existing instruction', async ({ page }) => {
    await page.goto('/');
    const actionSelect = page.locator('.instruction-builder select').first();
    const beatsInput = page.locator('.instruction-builder input[inputmode="decimal"]').last();
    const addBtn = page.locator('.add-btn');

    // Add an allemande with 4 beats
    await actionSelect.selectOption('allemande');
    await beatsInput.fill('4');
    await addBtn.click();

    // Click edit on it
    await page.locator('.instruction-actions button[title="Edit"]').click();

    // Beats should be 4 (loaded from instruction), not the default 8
    await expect(beatsInput).toHaveValue('4');
  });
});

test.describe('number input free-form typing', () => {
  test('beats field accepts ".25" typed over selected content', async ({ page }) => {
    await page.goto('/');
    const actionSelect = page.locator('.instruction-builder select').first();
    await actionSelect.selectOption('step');

    const beatsInput = page.locator('.instruction-builder input[inputmode="decimal"]').last();

    // Select all and type .25
    await beatsInput.fill('');
    await beatsInput.type('.25');
    await expect(beatsInput).toHaveValue('.25');
  });

  test('beats field accepts intermediate states like "1." while typing', async ({ page }) => {
    await page.goto('/');
    const beatsInput = page.locator('.instruction-builder input[inputmode="decimal"]').last();

    await beatsInput.fill('');
    await beatsInput.type('1.');
    await expect(beatsInput).toHaveValue('1.');
  });

  test('distance field accepts ".5" typed from scratch', async ({ page }) => {
    await page.goto('/');
    const actionSelect = page.locator('.instruction-builder select').first();
    await actionSelect.selectOption('step');

    // Distance is the first decimal input when step is selected
    const distanceInput = page.locator('.instruction-builder input[inputmode="decimal"]').first();

    await distanceInput.fill('');
    await distanceInput.type('.75');
    await expect(distanceInput).toHaveValue('.75');
  });

  test('instruction with ".25" beats is created correctly', async ({ page }) => {
    await page.goto('/');
    const actionSelect = page.locator('.instruction-builder select').first();
    await actionSelect.selectOption('turn');

    const beatsInput = page.locator('.instruction-builder input[inputmode="decimal"]').last();
    await beatsInput.fill('.25');

    // Type a direction for the turn
    const targetInput = page.locator('.face-input');
    await targetInput.fill('up');

    await page.locator('.add-btn').click();

    // Check the instruction summary shows 0.25b
    const summary = page.locator('.instruction-summary').first();
    await expect(summary).toContainText('0.25b');
  });
});

test.describe('balance action', () => {
  test('balance defaults to 2 beats', async ({ page }) => {
    await page.goto('/');
    const actionSelect = page.locator('.instruction-builder select').first();
    await actionSelect.selectOption('balance');

    const beatsInput = page.locator('.instruction-builder input[inputmode="decimal"]').last();
    await expect(beatsInput).toHaveValue('4');
  });

  test('balance shows direction input', async ({ page }) => {
    await page.goto('/');
    const actionSelect = page.locator('.instruction-builder select').first();
    await actionSelect.selectOption('balance');

    // Should show a direction input
    const dirInput = page.locator('.face-input');
    await expect(dirInput).toBeVisible();
  });

  test('adding a balance instruction shows correct summary', async ({ page }) => {
    await page.goto('/');
    const actionSelect = page.locator('.instruction-builder select').first();
    await actionSelect.selectOption('balance');

    const dirInput = page.locator('.face-input');
    await dirInput.fill('across');

    await page.locator('.add-btn').click();

    const summary = page.locator('.instruction-summary').first();
    await expect(summary).toContainText('balance across 0.5 (4b)');
  });

  test('balance with facing-relative direction', async ({ page }) => {
    await page.goto('/');
    const actionSelect = page.locator('.instruction-builder select').first();
    await actionSelect.selectOption('balance');

    const dirInput = page.locator('.face-input');
    await dirInput.fill('forward');

    await page.locator('.add-btn').click();

    const summary = page.locator('.instruction-summary').first();
    await expect(summary).toContainText('balance forward 0.5 (4b)');
  });
});

test.describe('new facing-relative directions', () => {
  test('step accepts "forward" direction', async ({ page }) => {
    await page.goto('/');
    const actionSelect = page.locator('.instruction-builder select').first();
    await actionSelect.selectOption('step');

    const dirInput = page.locator('.face-input');
    await dirInput.fill('forward');

    await page.locator('.add-btn').click();

    const summary = page.locator('.instruction-summary').first();
    await expect(summary).toContainText('step forward');
  });

  test('step accepts "back" direction', async ({ page }) => {
    await page.goto('/');
    const actionSelect = page.locator('.instruction-builder select').first();
    await actionSelect.selectOption('step');

    const dirInput = page.locator('.face-input');
    await dirInput.fill('back');

    await page.locator('.add-btn').click();

    const summary = page.locator('.instruction-summary').first();
    await expect(summary).toContainText('step back');
  });

  test('step accepts "right" direction', async ({ page }) => {
    await page.goto('/');
    const actionSelect = page.locator('.instruction-builder select').first();
    await actionSelect.selectOption('step');

    const dirInput = page.locator('.face-input');
    await dirInput.fill('right');

    await page.locator('.add-btn').click();

    const summary = page.locator('.instruction-summary').first();
    await expect(summary).toContainText('step right');
  });

  test('step accepts "left" direction', async ({ page }) => {
    await page.goto('/');
    const actionSelect = page.locator('.instruction-builder select').first();
    await actionSelect.selectOption('step');

    const dirInput = page.locator('.face-input');
    await dirInput.fill('left');

    await page.locator('.add-btn').click();

    const summary = page.locator('.instruction-summary').first();
    await expect(summary).toContainText('step left');
  });

  test('turn accepts "forward" direction', async ({ page }) => {
    await page.goto('/');
    const actionSelect = page.locator('.instruction-builder select').first();
    await actionSelect.selectOption('turn');

    const dirInput = page.locator('.face-input');
    await dirInput.fill('forward');

    await page.locator('.add-btn').click();

    const summary = page.locator('.instruction-summary').first();
    await expect(summary).toContainText('turn forward');
  });

  test('direction autocomplete offers "forward" for "fo"', async ({ page }) => {
    await page.goto('/');
    const actionSelect = page.locator('.instruction-builder select').first();
    await actionSelect.selectOption('step');

    const dirInput = page.locator('.face-input');
    await dirInput.fill('fo');

    // Ghost completion should show "forward"
    const ghost = page.locator('.face-ghost');
    await expect(ghost).toHaveText('forward');
  });

  test('anti-progression is not in autocomplete', async ({ page }) => {
    await page.goto('/');
    const actionSelect = page.locator('.instruction-builder select').first();
    await actionSelect.selectOption('step');

    const dirInput = page.locator('.face-input');
    await dirInput.fill('anti');

    // No ghost completion should appear
    const ghost = page.locator('.face-ghost');
    await expect(ghost).toHaveCount(0);
  });
});
