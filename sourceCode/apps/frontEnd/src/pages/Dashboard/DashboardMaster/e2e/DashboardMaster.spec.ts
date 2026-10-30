import { test, expect, Page } from '@playwright/test';

// ─── Config ───────────────────────────────────────────────────────────────────

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function gotoDashboard(page: Page): Promise<void> {
  await page.goto(BASE_URL);
  await page.waitForLoadState('networkidle');
}

// ─────────────────────────────────────────────────────────────────────────────
// SPEC 1: Page title visible
// ─────────────────────────────────────────────────────────────────────────────

test('1 — Page title "Executive Overview" is visible', async ({ page }) => {
  await gotoDashboard(page);
  await expect(page.getByRole('heading', { name: 'Executive Overview' })).toBeVisible();
});

// ─────────────────────────────────────────────────────────────────────────────
// SPEC 2: KPI summary cards visible
// ─────────────────────────────────────────────────────────────────────────────

test('2 — All 5 KPI summary cards are visible', async ({ page }) => {
  await gotoDashboard(page);

  const labels = page.locator('.dash-metric-card__label');
  await expect(labels.getByText('Total Claims', { exact: true })).toBeVisible();
  await expect(labels.getByText('Total LAE', { exact: true })).toBeVisible();
  await expect(labels.getByText('Total Savings', { exact: true })).toBeVisible();
  await expect(labels.getByText('Subrogation Recovery', { exact: true })).toBeVisible();
  await expect(labels.getByText('SLA Compliance', { exact: true })).toBeVisible();
});

// ─────────────────────────────────────────────────────────────────────────────
// SPEC 3: Date range filter defaults to "Today"
// ─────────────────────────────────────────────────────────────────────────────

test('3 — Date range filter defaults to "Today"', async ({ page }) => {
  await gotoDashboard(page);

  const select = page.getByLabel('Date range');
  await expect(select).toHaveValue('today');
});

// ─────────────────────────────────────────────────────────────────────────────
// SPEC 4: Changing date range updates KPI values
// ─────────────────────────────────────────────────────────────────────────────

test('4 — Changing the date range refreshes KPI values', async ({ page }) => {
  await gotoDashboard(page);

  const select = page.getByLabel('Date range');
  await select.selectOption('this-year');
  await expect(select).toHaveValue('this-year');

  // KPI cards should still be present after the refresh
  await expect(page.getByText('Total Claims')).toBeVisible();
});

// ─────────────────────────────────────────────────────────────────────────────
// SPEC 5: Trend charts render with hero values
// ─────────────────────────────────────────────────────────────────────────────

test('5 — LAE Ratio Trend and Subrogation Recovery Trend charts render', async ({ page }) => {
  await gotoDashboard(page);

  await expect(page.getByText('LAE Ratio Trend')).toBeVisible();
  await expect(page.getByText('Subrogation Recovery Trend')).toBeVisible();
  await expect(page.locator('.chart-hero-value').first()).toBeVisible();
});

// ─────────────────────────────────────────────────────────────────────────────
// SPEC 6: Top 5 Savings by Service and SLA Compliance bar charts render
// ─────────────────────────────────────────────────────────────────────────────

test('6 — Top 5 Savings by Service and SLA Compliance by Service charts render', async ({ page }) => {
  await gotoDashboard(page);

  await expect(page.getByText('Top 5 Savings by Service')).toBeVisible();
  await expect(page.getByText('SLA Compliance by Service')).toBeVisible();
});

// ─────────────────────────────────────────────────────────────────────────────
// SPEC 7: Vendor Performance Overview table
// ─────────────────────────────────────────────────────────────────────────────

test('7 — Vendor Performance Overview table renders with vendor rows', async ({ page }) => {
  await gotoDashboard(page);

  await expect(page.getByText('Vendor Performance Overview')).toBeVisible();
  await expect(page.locator('.dash-activity-table tbody tr').first()).toBeVisible();
});

// ─────────────────────────────────────────────────────────────────────────────
// SPEC 8: Sorting vendors via the sort dropdown
// ─────────────────────────────────────────────────────────────────────────────

test('8 — Vendor table sort dropdown changes sort field', async ({ page }) => {
  await gotoDashboard(page);

  const sortSelect = page.getByLabel('Sort vendors by');
  await sortSelect.selectOption('cycleTime');
  await expect(sortSelect).toHaveValue('cycleTime');
});

// ─────────────────────────────────────────────────────────────────────────────
// SPEC 9: Top Alerts & Exceptions panel
// ─────────────────────────────────────────────────────────────────────────────

test('9 — Top Alerts & Exceptions panel renders alert rows', async ({ page }) => {
  await gotoDashboard(page);

  await expect(page.getByText('Top Alerts & Exceptions')).toBeVisible();
  await expect(page.locator('.alert-row').first()).toBeVisible();
});

// ─────────────────────────────────────────────────────────────────────────────
// SPEC 10: Filters modal opens and closes
// ─────────────────────────────────────────────────────────────────────────────

test('10 — Filters modal opens from the Filters button and closes', async ({ page }) => {
  await gotoDashboard(page);

  await page.getByRole('button', { name: /^filters/i }).click();
  await expect(page.getByRole('heading', { name: 'Filters' })).toBeVisible();
  await expect(page.getByText('Clear All Filters')).toBeVisible();
  await expect(page.getByText('Apply Filters')).toBeVisible();

  await page.getByLabel('Close').click();
  await expect(page.getByRole('heading', { name: 'Filters' })).not.toBeVisible();
});

// ─────────────────────────────────────────────────────────────────────────────
// SPEC 11: KPI card visibility checkbox hides a card
// ─────────────────────────────────────────────────────────────────────────────

test('11 — Unchecking a KPI visibility checkbox hides that card', async ({ page }) => {
  await gotoDashboard(page);

  const checkbox = page.getByLabel('Toggle visibility of Total LAE card');
  await checkbox.click();
  await expect(page.locator('.dash-metric-card__label').getByText('Total LAE', { exact: true })).not.toBeVisible();
});

// ─────────────────────────────────────────────────────────────────────────────
// SPEC: AI Insights panel pinned to sidebar
// ─────────────────────────────────────────────────────────────────────────────

test('12 — AI Insight panel is visible in the sidebar', async ({ page }) => {
  await gotoDashboard(page);
  await expect(page.locator('.ai-insight-panel')).toBeVisible();
  await expect(page.getByText('AI Insight')).toBeVisible();
});

// ─────────────────────────────────────────────────────────────────────────────
// SPEC: No breadcrumbs
// ─────────────────────────────────────────────────────────────────────────────

test('No breadcrumbs on Executive Overview screen', async ({ page }) => {
  await gotoDashboard(page);
  const breadcrumbNav = page.locator('[aria-label="breadcrumb"], .breadcrumb, .breadcrumbs');
  const count = await breadcrumbNav.count();
  expect(count).toBe(0);
});
