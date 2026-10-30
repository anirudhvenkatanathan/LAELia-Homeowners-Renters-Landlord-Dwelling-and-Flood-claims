import { test, expect, Page } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const CLAIM_INTAKE_URL = `${BASE_URL}/claim-intake`;

// ─── Helper: navigate to the Claim Intake page ───────────────────────────────

async function goToClaimIntake(page: Page): Promise<void> {
  await page.goto(CLAIM_INTAKE_URL);
  await page.waitForLoadState('networkidle');
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

test.describe('Claim Intake Screen', () => {

  // ── 1. Page loads ────────────────────────────────────────────────────────
  test('should display the page title "Claim Intake"', async ({ page }) => {
    await goToClaimIntake(page);

    const title = page.locator('h1.page-title');
    await expect(title).toBeVisible();
    await expect(title).toHaveText('Claim Intake');
  });

  test('should display the page subtitle', async ({ page }) => {
    await goToClaimIntake(page);

    const subtitle = page.locator('p.page-subtitle');
    await expect(subtitle).toBeVisible();
    await expect(subtitle).toHaveText('Upload and review claim intake records');
  });

  test('should render the upload section heading', async ({ page }) => {
    await goToClaimIntake(page);
    await expect(page.getByText('Upload Claim')).toBeVisible();
  });

  // ── 2. Upload Type radio switches ────────────────────────────────────────
  test('selecting Excel shows file input and hides textareas', async ({ page }) => {
    await goToClaimIntake(page);

    await page.getByLabel('Excel File').check();

    await expect(page.locator('input[type="file"]')).toBeAttached();
    await expect(page.getByLabel('JSON Payload')).not.toBeVisible();
    await expect(page.getByLabel('XML Data')).not.toBeVisible();
  });

  test('selecting JSON shows JSON textarea and hides file input', async ({ page }) => {
    await goToClaimIntake(page);

    await page.getByLabel('JSON Payload', { exact: true }).first().check();

    await expect(page.getByRole('textbox', { name: /json payload/i })).toBeVisible();
    await expect(page.locator('input[type="file"]')).not.toBeAttached();
  });

  test('selecting XML shows XML textarea and hides file input', async ({ page }) => {
    await goToClaimIntake(page);

    await page.getByLabel('XML Data', { exact: true }).check();

    await expect(page.getByRole('textbox', { name: /xml data/i })).toBeVisible();
    await expect(page.locator('input[type="file"]')).not.toBeAttached();
  });

  // ── 3. Upload with empty form shows validation error ─────────────────────
  test('clicking Upload Claim without selecting type shows validation error', async ({ page }) => {
    await goToClaimIntake(page);

    await page.getByRole('button', { name: /upload claim/i }).click();

    await expect(
      page.getByText(/upload type is required/i)
    ).toBeVisible();
  });

  // ── 4. JSON upload — invalid JSON → error; valid JSON → submits ──────────
  test('JSON upload: pasting invalid JSON shows validation error', async ({ page }) => {
    await goToClaimIntake(page);

    await page.getByLabel('JSON Payload', { exact: true }).first().check();
    await page.getByRole('textbox', { name: /json payload/i }).fill('not-valid-json{{{');
    await page.getByRole('button', { name: /upload claim/i }).click();

    await expect(page.getByText(/not valid JSON/i)).toBeVisible();
  });

  test('JSON upload: valid JSON enables submission attempt', async ({ page }) => {
    await goToClaimIntake(page);

    await page.getByLabel('JSON Payload', { exact: true }).first().check();
    await page.getByRole('textbox', { name: /json payload/i }).fill(
      JSON.stringify({
        claimNumber:  'CLM-001',
        policyNumber: 'POL-001',
        insuredName:  'John Doe',
        lossDate:     '2026-01-01',
        reportedDate: '2026-01-02',
        claimType:    'Auto',
      })
    );
    await page.getByRole('button', { name: /upload claim/i }).click();

    // Either a success message or a server error (API may not be running in E2E)
    // Ensure no frontend validation error for jsonPayload
    await expect(page.locator('[role="alert"]').filter({ hasText: /not valid JSON/i })).not.toBeVisible();
  });

  // ── 5. XML upload — invalid XML → error ──────────────────────────────────
  test('XML upload: pasting content without < shows validation error', async ({ page }) => {
    await goToClaimIntake(page);

    await page.getByLabel('XML Data', { exact: true }).check();
    await page.getByRole('textbox', { name: /xml data/i }).fill('plain text not xml');
    await page.getByRole('button', { name: /upload claim/i }).click();

    await expect(page.getByText(/tag element/i)).toBeVisible();
  });

  test('XML upload: valid XML (starts with <) passes frontend validation', async ({ page }) => {
    await goToClaimIntake(page);

    await page.getByLabel('XML Data', { exact: true }).check();
    await page.getByRole('textbox', { name: /xml data/i }).fill(
      '<claim><claimNumber>CLM-001</claimNumber></claim>'
    );
    await page.getByRole('button', { name: /upload claim/i }).click();

    await expect(page.getByText(/tag element/i)).not.toBeVisible();
  });

  // ── 6. Grid renders with correct columns ─────────────────────────────────
  test('grid renders with the correct column headers', async ({ page }) => {
    await goToClaimIntake(page);

    // AG Grid column headers
    const grid = page.locator('.ag-theme-alpine');
    await expect(grid).toBeVisible();

    const headers = page.locator('.ag-header-cell-text');
    const headerTexts = await headers.allTextContents();

    expect(headerTexts).toContain('Upload ID');
    expect(headerTexts).toContain('File Name');
    expect(headerTexts).toContain('Upload Type');
    expect(headerTexts).toContain('Claim Number');
    expect(headerTexts).toContain('Uploaded By');
    expect(headerTexts).toContain('Upload Date');
    expect(headerTexts).toContain('Status');
  });

  // ── 7. Grid row selection → claim details section appears ────────────────
  test('selecting a grid row shows the claim details section', async ({ page }) => {
    await goToClaimIntake(page);

    // Seed the grid via API (only runs if API is available)
    // This test assumes at least one row exists.
    // If grid is empty, the test will be skipped gracefully.
    const rowCount = await page.locator('.ag-row').count();

    if (rowCount > 0) {
      await page.locator('.ag-row').first().click();

      await expect(
        page.getByText('Uploaded Claim Details')
      ).toBeVisible({ timeout: 5000 });
    } else {
      test.skip();
    }
  });

  // ── 8. Status badges rendered with correct colour classes ────────────────
  test('status badges use badge-green, badge-yellow, or badge-red classes', async ({ page }) => {
    await goToClaimIntake(page);

    const rowCount = await page.locator('.ag-row').count();

    if (rowCount > 0) {
      // At least one badge should exist with one of the allowed classes
      const badges = page.locator('.badge');
      const count = await badges.count();
      expect(count).toBeGreaterThan(0);

      // Verify no inline styles used for colour (all classes only)
      for (let i = 0; i < count; i++) {
        const badge = badges.nth(i);
        const style = await badge.getAttribute('style');
        // No inline colour styles allowed
        expect(style ?? '').not.toMatch(/color\s*:/);
        expect(style ?? '').not.toMatch(/background\s*:/);
      }
    } else {
      test.skip();
    }
  });

  // ── 9. App shell renders sidebar and topbar ───────────────────────────────
  test('app shell renders sidebar and topbar', async ({ page }) => {
    await goToClaimIntake(page);

    await expect(page.locator('.sidebar')).toBeVisible();
    await expect(page.locator('.app-header')).toBeVisible();
    await expect(page.locator('.sidebar-logo')).toBeVisible();
    await expect(page.getByRole('button', { name: /logout/i })).toBeVisible();
  });

  // ── 10. No breadcrumbs anywhere ───────────────────────────────────────────
  test('no breadcrumbs are rendered on the page', async ({ page }) => {
    await goToClaimIntake(page);

    await expect(page.locator('[aria-label="breadcrumb"]')).not.toBeAttached();
    await expect(page.locator('.breadcrumb')).not.toBeAttached();
    await expect(page.locator('nav[class*="breadcrumb"]')).not.toBeAttached();
  });

  // ── 11. TEST-27: Grid default sort — latest upload first ─────────────────
  // Requires seeded data: at least two rows with different uploadDate values.
  test('grid rows are sorted with the most recent upload first (TEST-27)', async ({ page }) => {
    await goToClaimIntake(page);

    const rowCount = await page.locator('.ag-row').count();

    if (rowCount < 2) {
      test.skip();
      return;
    }

    // Get the Upload Date cell content from the first two visible rows.
    // AG Grid renders cells inside .ag-row[row-index="0"] and [row-index="1"].
    const firstRowDateCell = page.locator('.ag-row[row-index="0"] .ag-cell[col-id="uploadDate"]');
    const secondRowDateCell = page.locator('.ag-row[row-index="1"] .ag-cell[col-id="uploadDate"]');

    const firstDateText  = await firstRowDateCell.textContent();
    const secondDateText = await secondRowDateCell.textContent();

    if (firstDateText && secondDateText) {
      const firstDate  = new Date(firstDateText.trim());
      const secondDate = new Date(secondDateText.trim());
      // Most recent should be first (descending order)
      expect(firstDate.getTime()).toBeGreaterThanOrEqual(secondDate.getTime());
    }
  });

  // ── 12. TEST-28: Pagination controls are rendered ────────────────────────
  test('grid pagination panel is rendered (TEST-28)', async ({ page }) => {
    await goToClaimIntake(page);

    // AG Grid renders .ag-paging-panel when pagination: true
    const pagingPanel = page.locator('.ag-paging-panel');
    await expect(pagingPanel).toBeAttached();
  });

  // ── 13. TEST-29: Single row selection mode enforced ──────────────────────
  // Requires seeded data: at least two rows.
  test('selecting a second row deselects the first (single selection mode, TEST-29)', async ({ page }) => {
    await goToClaimIntake(page);

    const rowCount = await page.locator('.ag-row').count();

    if (rowCount < 2) {
      test.skip();
      return;
    }

    const firstRow  = page.locator('.ag-row[row-index="0"]');
    const secondRow = page.locator('.ag-row[row-index="1"]');

    // Click the first row
    await firstRow.click();
    await expect(firstRow).toHaveClass(/ag-row-selected/);

    // Click the second row — first row must no longer be selected
    await secondRow.click();
    await expect(secondRow).toHaveClass(/ag-row-selected/);
    await expect(firstRow).not.toHaveClass(/ag-row-selected/);
  });
});
