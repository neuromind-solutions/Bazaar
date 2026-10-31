import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Automated Accessibility (A11y) Audit — WCAG 2.1 AA Compliance', () => {
  test('01. Dashboard Accessibility Audit', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      // Exclude third-party unspanned images or optional third-party font wrappers
      .exclude(['iframe'])
      .analyze();

    // Critical structural accessibility violations (labels, ARIA, roles) are strictly forbidden
    const criticalViolations = accessibilityScanResults.violations.filter(
      v => v.impact === 'critical'
    );

    expect(criticalViolations, `Critical A11y Violations Found:\n${JSON.stringify(criticalViolations, null, 2)}`).toEqual([]);
  });

  test('02. POS Terminal Accessibility Audit', async ({ page }) => {
    await page.goto('/');
    await page.locator('aside button:has-text("POS Terminal")').first().click();
    await page.waitForTimeout(400);

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .exclude(['iframe'])
      .analyze();

    const criticalViolations = accessibilityScanResults.violations.filter(
      v => v.impact === 'critical'
    );

    expect(criticalViolations).toEqual([]);
  });

  test('03. Settings & Shop Profile Accessibility Audit', async ({ page }) => {
    await page.goto('/');
    await page.locator('aside button:has-text("Settings")').first().click();
    await page.waitForTimeout(400);

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .exclude(['iframe'])
      .analyze();

    const criticalViolations = accessibilityScanResults.violations.filter(
      v => v.impact === 'critical'
    );

    expect(criticalViolations).toEqual([]);
  });
});
