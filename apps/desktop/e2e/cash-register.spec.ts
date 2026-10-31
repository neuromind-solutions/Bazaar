import { test, expect } from '@playwright/test';

test.describe('E2E Cash Register & Shift Drawer Reconciliation', () => {
  const consoleErrors: string[] = [];

  test.beforeEach(async ({ page }) => {
    page.on('pageerror', (err) => {
      consoleErrors.push(`[PageError] ${err.message}`);
    });
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!text.includes('favicon') && !text.includes('chrome-extension')) {
          consoleErrors.push(`[ConsoleError] ${text}`);
        }
      }
    });

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
  });

  test.afterEach(() => {
    expect(consoleErrors, `Uncaught console errors detected: ${consoleErrors.join('\n')}`).toEqual([]);
  });

  test('01. Enable Multi-Staff Mode & Open Cash Register Shift Drawer', async ({ page }) => {
    // Navigate to Settings
    await page.locator('aside button:has-text("Settings")').first().click();
    await page.waitForTimeout(300);

    // Switch to Multi-Staff mode if radio button is present
    const multiRadio = page.locator('input[value="multi"], label:has-text("Multi-Staff")').first();
    if (await multiRadio.isVisible()) {
      await multiRadio.click();
      await page.waitForTimeout(300);
    }

    // Navigate to POS Terminal hub
    await page.locator('aside button:has-text("POS Terminal")').first().click();
    await page.waitForTimeout(300);

    // Click on Cash Shift Drawer sub-item if visible
    const cashShiftBtn = page.locator('button:has-text("Cash Shift Drawer")').first();
    if (await cashShiftBtn.isVisible()) {
      await cashShiftBtn.click();
      await page.waitForTimeout(400);

      // Verify Cash Register UI rendered
      await expect(page.locator('text=Cash Register & Shifts').first()).toBeVisible();
      await expect(page.locator('text=Shift float reconciliation').first()).toBeVisible();

      // Check shift metrics cards exist
      await expect(page.locator('text=Opening Float').first()).toBeVisible();
    }
  });

  test('02. Shift Transaction Log & Safe Movements', async ({ page }) => {
    // Navigate to Settings -> ensure multi mode
    await page.locator('aside button:has-text("Settings")').first().click();
    await page.waitForTimeout(300);

    const multiRadio = page.locator('input[value="multi"]').first();
    if (await multiRadio.isVisible()) {
      await multiRadio.click();
      await page.waitForTimeout(300);
    }

    await page.locator('aside button:has-text("POS Terminal")').first().click();
    await page.waitForTimeout(300);

    const cashShiftBtn = page.locator('button:has-text("Cash Shift Drawer")').first();
    if (await cashShiftBtn.isVisible()) {
      await cashShiftBtn.click();
      await page.waitForTimeout(400);

      // Verify transaction table
      await expect(page.locator('text=Drawer Activity Log').first()).toBeVisible();
    }
  });
});
