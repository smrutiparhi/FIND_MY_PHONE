import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const DEMO_EMAIL = 'demo.login@example.com';
const DEMO_PASSWORD = 'RecoverAI-Demo-2026!';

/**
 * Fails a test on any axe-core violation of "serious" or "critical" impact -
 * "minor"/"moderate" findings are logged but don't block the suite, since a
 * handful of those exist on nearly every real app and would make this
 * unmaintainably brittle; the two impact levels that actually mean a real
 * user with assistive tech is blocked are what Part 21 cares about catching
 * automatically.
 */
async function expectNoSeriousA11yViolations(page: Page, label: string): Promise<void> {
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  if (serious.length > 0) {
    const details = serious.map((v) => `- [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} node(s))`).join('\n');
    throw new Error(`${label}: ${serious.length} serious/critical accessibility violation(s):\n${details}`);
  }
}

async function expectNoHorizontalOverflow(page: Page, label: string): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `${label}: page content overflows its viewport horizontally by ${overflow}px`).toBeLessThanOrEqual(1);
}

async function login(page: Page): Promise<void> {
  await page.goto('/login');
  await page.fill('input[type="email"]', DEMO_EMAIL);
  await page.fill('input[type="password"]', DEMO_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard');
}

test.describe('Public pages - responsiveness and accessibility', () => {
  test('landing page', async ({ page }, testInfo) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expectNoHorizontalOverflow(page, `landing page (${testInfo.project.name})`);
    await expectNoSeriousA11yViolations(page, `landing page (${testInfo.project.name})`);
  });

  test('login page', async ({ page }, testInfo) => {
    await page.goto('/login');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expectNoHorizontalOverflow(page, `login page (${testInfo.project.name})`);
    await expectNoSeriousA11yViolations(page, `login page (${testInfo.project.name})`);

    // Keyboard navigation: every field and the submit button must be reachable by Tab alone -
    // Part 21/23 both explicitly require keyboard-navigable forms.
    await page.locator('input[type="email"]').focus();
    await page.keyboard.press('Tab');
    await expect(page.locator('input[type="password"]')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: /sign in/i })).toBeFocused();
  });
});

test.describe('Authenticated pages - responsiveness and accessibility', () => {
  test('dashboard', async ({ page }, testInfo) => {
    await login(page);
    await expectNoHorizontalOverflow(page, `dashboard (${testInfo.project.name})`);
    await expectNoSeriousA11yViolations(page, `dashboard (${testInfo.project.name})`);
  });

  test('notifications page', async ({ page }, testInfo) => {
    await login(page);
    await page.goto('/notifications');
    await expect(page.getByRole('heading', { name: 'Notifications' })).toBeVisible();
    await expectNoHorizontalOverflow(page, `notifications page (${testInfo.project.name})`);
    await expectNoSeriousA11yViolations(page, `notifications page (${testInfo.project.name})`);
  });
});

test.describe('Mobile navigation', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('the nav collapses to a hamburger menu and the hamburger actually opens it', async ({ page }) => {
    await login(page);

    const desktopNav = page.getByRole('navigation', { name: 'Main navigation' }).first();
    await expect(desktopNav).toBeHidden();

    const toggle = page.getByRole('button', { name: 'Toggle navigation menu' });
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const mobileNav = page.locator('#mobile-nav');
    await expect(mobileNav).toBeVisible();
    await expect(mobileNav.getByRole('link', { name: /Settings/ })).toBeVisible();
  });
});
