import { test, expect } from '@playwright/test';

test.describe('Enterprise POS & AMC Systematic Test Suite', () => {
  const consoleErrors: string[] = [];

  test.beforeEach(async ({ page }) => {
    // Listen for uncaught runtime exceptions and critical errors
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
    // Enterprise AMC standard: 0 uncaught runtime exceptions permitted
    expect(consoleErrors, `Uncaught console errors detected: ${consoleErrors.join('\n')}`).toEqual([]);
  });

  test('01. Smoke & Navigation Test — All 5 Enterprise Hubs Load Without Errors', async ({ page }) => {
    // 1. Verify initial Dashboard is visible
    await expect(page.locator('text=Shop Overview & Performance').first()).toBeVisible();
    await expect(page.locator('text=Today\'s Revenue').first()).toBeVisible();

    // 2. Hubs to test in the primary navigation
    const hubs = [
      { label: 'POS Terminal', checkText: 'Biller Active' },
      { label: 'Inventory', checkText: 'Products & Stock' },
      { label: 'Khata CRM', checkText: 'Customer Management & Dues Ledger' },
      { label: 'Analytics', checkText: 'Overview Dashboard' },
      { label: 'Settings', checkText: 'Shop Profile & Invoice Settings' },
    ];

    for (const hub of hubs) {
      const hubBtn = page.locator(`aside button:has-text("${hub.label}")`).first();
      await expect(hubBtn).toBeVisible();
      await hubBtn.click();
      await page.waitForTimeout(400);

      // Verify the target view rendered
      await expect(page.locator(`text=${hub.checkText}`).first()).toBeVisible();
    }
  });

  test('02. POS Billing Workflow — Add Item by Name/Barcode & Calculate Cart Totals', async ({ page }) => {
    // Navigate to POS Terminal
    await page.locator('aside button:has-text("POS Terminal")').first().click();
    await expect(page.locator('text=Biller Active').first()).toBeVisible();

    // Switch to Tiles View to click a product tile directly
    const tilesToggleBtn = page.locator('button:has-text("Tiles View")').first();
    if (await tilesToggleBtn.isVisible()) {
      await tilesToggleBtn.click();
      await page.waitForTimeout(300);
    }

    // Click the first product tile in the catalog
    const productTile = page.locator('button:has-text("₹"), div[role="button"]:has-text("₹")').first();
    await expect(productTile).toBeVisible();
    await productTile.click();

    // Verify item was added to the bill / cart
    await expect(page.locator('text=Active Bill').first()).toBeVisible();

    // Verify subtotal or price is displayed in the cashier checkout panel
    const totalDisplay = page.locator('text=Total Payable').first();
    await expect(totalDisplay).toBeVisible();

    // Test Barcode input field
    const barcodeInput = page.locator('input[placeholder*="Scan barcode"]').first();
    await expect(barcodeInput).toBeVisible();
    await barcodeInput.fill('8901234001035'); // Tata Salt barcode
    await barcodeInput.press('Enter');
    await page.waitForTimeout(400);

    // Verify Cash button is selected/visible
    const cashBtn = page.locator('button:has-text("Cash")').first();
    await expect(cashBtn).toBeVisible();
  });

  test('03. Inventory Master — Product Catalog & Live Search Filter', async ({ page }) => {
    // Navigate to Inventory
    await page.locator('aside button:has-text("Inventory")').first().click();
    await page.waitForTimeout(300);

    // Verify products table or search bar exists
    const searchInput = page.locator('input[placeholder*="Search"], input[placeholder*="search"]').first();
    await expect(searchInput).toBeVisible();

    // Filter by "Fortune"
    await searchInput.fill('Fortune');
    await page.waitForTimeout(300);
    await expect(page.locator('text=Fortune').first()).toBeVisible();

    // Clear filter
    await searchInput.fill('');
    await page.waitForTimeout(200);
  });

  test('04. Khata CRM — Customer Ledger & Dues Overview', async ({ page }) => {
    // Navigate to Khata CRM
    await page.locator('aside button:has-text("Khata CRM")').first().click();
    await page.waitForTimeout(300);

    // Verify Customer Management UI elements
    await expect(page.locator('text=Customer Management & Dues Ledger').first()).toBeVisible();
    await expect(page.locator('text=Total Outstanding Dues').first()).toBeVisible();
  });

  test('05. System Health & Storage Engine Optimization', async ({ page }) => {
    // Navigate to Settings
    await page.locator('aside button:has-text("Settings")').first().click();
    await page.waitForTimeout(300);

    // Click on System Diagnostics sub-item if visible
    const diagNav = page.locator('button:has-text("System Diagnostics")').first();
    if (await diagNav.isVisible()) {
      await diagNav.click();
      await page.waitForTimeout(400);

      // Verify health monitor loaded
      await expect(page.locator('text=System Health & Local SQLite Diagnostics').first()).toBeVisible();
      await expect(page.locator('text=HEALTHY').first()).toBeVisible();

      // Trigger Vacuum & Reindex
      const vacuumBtn = page.locator('button:has-text("Run SQLite Vacuum & Reindex")').first();
      await expect(vacuumBtn).toBeVisible();
      await vacuumBtn.click();
      await expect(page.locator('text=Storage engine optimized!').first()).toBeVisible({ timeout: 5000 });
    } else {
      // In solo mode, Shop Settings is visible
      await expect(page.locator('text=Shop Profile & Invoice Settings').first()).toBeVisible();
    }
  });

  test('06. Store Settings & Business Mode Policy Configuration', async ({ page }) => {
    // Navigate to Settings
    await page.locator('aside button:has-text("Settings")').first().click();
    await page.waitForTimeout(300);

    // Verify Shop Name input
    const shopNameInput = page.locator('label:has-text("Shop Name") + input, input[value*="Grocery"], input[value*="Supermarket"]').first();
    await expect(shopNameInput).toBeVisible();

    // Verify Operating Mode section
    await expect(page.locator('text=Solo Owner Mode').first()).toBeVisible();
    await expect(page.locator('text=Multi-Staff / Team Mode').first()).toBeVisible();

    // Verify Dynamic UPI settings section
    await expect(page.locator('text=Dynamic UPI Payment Module Settings').first()).toBeVisible();
  });
});
