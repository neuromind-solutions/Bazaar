import { test, expect } from '@playwright/test';

test.describe('E2E Inventory & Catalog Workflow', () => {
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

  test('01. Catalog Navigation & Instant Search Filter', async ({ page }) => {
    // Navigate to Inventory hub
    await page.locator('aside button:has-text("Inventory")').first().click();
    await page.waitForTimeout(300);

    // Verify catalog title
    await expect(page.locator('text=Inventory & Catalog').first()).toBeVisible();

    // Search for Tata Salt
    const searchInput = page.locator('input[placeholder*="Search by name"]').first();
    await expect(searchInput).toBeVisible();

    await searchInput.fill('Salt');
    await page.waitForTimeout(300);
    await expect(page.locator('text=Salt').first()).toBeVisible();

    // Clear search
    await searchInput.fill('');
    await page.waitForTimeout(200);
  });

  test('02. Filter Tabs — Low Stock & Out of Stock Queries', async ({ page }) => {
    await page.locator('aside button:has-text("Inventory")').first().click();
    await page.waitForTimeout(300);

    // Click "Low Stock" filter button if present
    const lowStockBtn = page.locator('button:has-text("Low Stock")').first();
    if (await lowStockBtn.isVisible()) {
      await lowStockBtn.click();
      await page.waitForTimeout(300);
    }

    // Switch back to "All Products"
    const allProductsBtn = page.locator('button:has-text("All Products"), button:has-text("All")').first();
    if (await allProductsBtn.isVisible()) {
      await allProductsBtn.click();
      await page.waitForTimeout(200);
    }
  });

  test('03. Create New Product Modal Flow', async ({ page }) => {
    await page.locator('aside button:has-text("Inventory")').first().click();
    await page.waitForTimeout(300);

    // Click Add Product button
    const addProductBtn = page.locator('button:has-text("Add Product")').first();
    await expect(addProductBtn).toBeVisible();
    await addProductBtn.click();
    await page.waitForTimeout(300);

    // Check modal opened
    await expect(page.locator('text=Add New Inventory Product').first()).toBeVisible();

    // Fill form fields
    const nameInput = page.locator('label:has-text("Product Name") + input, input[name="name"], input[placeholder*="Basmati Rice"]').first();
    if (await nameInput.isVisible()) {
      await nameInput.fill('Automated Test Grains 1kg');
    }

    // Close modal via Cancel button or Close button
    const cancelBtn = page.locator('button:has-text("Cancel"), button:has-text("✕")').first();
    if (await cancelBtn.isVisible()) {
      await cancelBtn.click();
    }
  });
});
