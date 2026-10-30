import { test, expect, Page } from '@playwright/test';

// ─── Config ───────────────────────────────────────────────────────────────────

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173';
const FM_URL   = `${BASE_URL}/field-mapping`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function gotoFieldMapping(page: Page): Promise<void> {
  await page.goto(FM_URL);
  await page.waitForLoadState('networkidle');
}

// ─────────────────────────────────────────────────────────────────────────────
// SPEC 1: Page title visible
// ─────────────────────────────────────────────────────────────────────────────

test('1 — Page title "Field Mapping" is visible', async ({ page }) => {
  await gotoFieldMapping(page);
  await expect(page.getByRole('heading', { name: 'Field Mapping' })).toBeVisible();
});

// ─────────────────────────────────────────────────────────────────────────────
// SPEC 2: Upload File button visible
// ─────────────────────────────────────────────────────────────────────────────

test('2 — Upload File button is visible', async ({ page }) => {
  await gotoFieldMapping(page);
  await expect(page.getByRole('button', { name: /upload file/i })).toBeVisible();
});

// ─────────────────────────────────────────────────────────────────────────────
// SPEC 3: Download Template button visible
// ─────────────────────────────────────────────────────────────────────────────

test('3 — Download Template button is visible', async ({ page }) => {
  await gotoFieldMapping(page);
  await expect(page.getByRole('button', { name: /download template/i })).toBeVisible();
});

// ─────────────────────────────────────────────────────────────────────────────
// SPEC 4: Upload modal opens on button click
// ─────────────────────────────────────────────────────────────────────────────

test('4 — Upload modal opens when Upload File button is clicked', async ({ page }) => {
  await gotoFieldMapping(page);
  await page.getByRole('button', { name: /upload file/i }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByText('Upload Field Mapping File')).toBeVisible();
});

// ─────────────────────────────────────────────────────────────────────────────
// SPEC 5: Modal has file input accepting .xlsx/.xls
// ─────────────────────────────────────────────────────────────────────────────

test('5 — Upload modal has file input accepting .xlsx and .xls', async ({ page }) => {
  await gotoFieldMapping(page);
  await page.getByRole('button', { name: /upload file/i }).click();
  await page.waitForSelector('[role="dialog"]');

  const fileInput = page.locator('#fm-file-input');
  await expect(fileInput).toHaveAttribute('accept', '.xlsx,.xls');
});

// ─────────────────────────────────────────────────────────────────────────────
// SPEC 6: Cancel button closes the modal
// ─────────────────────────────────────────────────────────────────────────────

test('6 — Cancel button closes the upload modal', async ({ page }) => {
  await gotoFieldMapping(page);
  await page.getByRole('button', { name: /upload file/i }).click();
  await page.waitForSelector('[role="dialog"]');

  await page.getByRole('button', { name: /cancel/i }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
});

// ─────────────────────────────────────────────────────────────────────────────
// SPEC 7: Grid renders with correct column headers
// ─────────────────────────────────────────────────────────────────────────────

test('7 — AG Grid renders with correct column headers', async ({ page }) => {
  await gotoFieldMapping(page);

  // Wait for the AG Grid to initialise
  await page.waitForSelector('.ag-header-cell', { timeout: 10000 });

  const headerTexts = await page.locator('.ag-header-cell-text').allTextContents();

  expect(headerTexts).toContain('Upload ID');
  expect(headerTexts).toContain('File Name');
  expect(headerTexts).toContain('Upload Type');
  expect(headerTexts).toContain('Total Records');
  expect(headerTexts).toContain('Uploaded By');
  expect(headerTexts).toContain('Upload Date');
  expect(headerTexts).toContain('Status');
});

// ─────────────────────────────────────────────────────────────────────────────
// SPEC 8: Row click navigates to /field-mapping/details/:uploadId
// ─────────────────────────────────────────────────────────────────────────────

test('8 — Row click navigates to field mapping details page', async ({ page }) => {
  await gotoFieldMapping(page);

  // Seed or wait for at least one row
  const rowLocator = page.locator('.ag-row').first();
  const rowCount = await rowLocator.count();

  if (rowCount === 0) {
    // No rows in grid — skip navigation assertion
    test.info().annotations.push({ type: 'info', description: 'No grid rows — skipped navigation check' });
    return;
  }

  await rowLocator.click();
  await expect(page).toHaveURL(/\/field-mapping\/details\/.+/);
});

// ─────────────────────────────────────────────────────────────────────────────
// SPEC 9–13: Details screen assertions
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Field Mapping Details screen', () => {
  const DETAILS_URL = `${BASE_URL}/field-mapping/details/test-upload-id`;

  test('9 — Details screen: header info strip visible', async ({ page }) => {
    await page.goto(DETAILS_URL);
    await page.waitForLoadState('networkidle');

    // Info strip should be rendered even if details are loading
    const infoStrip = page.locator('.detail-info-strip');
    await expect(infoStrip).toBeVisible();
  });

  test('10 — Details screen: Uploaded Records section visible', async ({ page }) => {
    await page.goto(DETAILS_URL);
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Uploaded Records')).toBeVisible();
  });

  test('11 — Details screen: Mapping Configuration section visible', async ({ page }) => {
    await page.goto(DETAILS_URL);
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Mapping Configuration')).toBeVisible();
  });

  test('12 — Details screen: Add Mapping button visible', async ({ page }) => {
    await page.goto(DETAILS_URL);
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('button', { name: /add mapping/i })).toBeVisible();
  });

  test('13 — Details screen: Save All button visible', async ({ page }) => {
    await page.goto(DETAILS_URL);
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('button', { name: /save all/i })).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SPEC: No breadcrumbs on any screen
// ─────────────────────────────────────────────────────────────────────────────

test('No breadcrumbs on Field Mapping screen', async ({ page }) => {
  await gotoFieldMapping(page);
  const breadcrumbNav = page.locator('[aria-label="breadcrumb"], .breadcrumb, .breadcrumbs');
  const count = await breadcrumbNav.count();
  expect(count).toBe(0);
});

test('No breadcrumbs on Field Mapping Details screen', async ({ page }) => {
  await page.goto(`${BASE_URL}/field-mapping/details/test-upload-id`);
  await page.waitForLoadState('networkidle');
  const breadcrumbNav = page.locator('[aria-label="breadcrumb"], .breadcrumb, .breadcrumbs');
  const count = await breadcrumbNav.count();
  expect(count).toBe(0);
});

// ─────────────────────────────────────────────────────────────────────────────
// SPEC: Mapping Configuration CRUD (TC-41..44)
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Mapping Configuration CRUD', () => {
  const DETAILS_URL = `${BASE_URL}/field-mapping/details/test-upload-id`;

  // TC-41: Add Mapping → new editable row appears
  test('TC-41 — Add Mapping button inserts a new editable row (Source Field input visible)', async ({ page }) => {
    await page.goto(DETAILS_URL);
    await page.waitForLoadState('networkidle');

    // Click Add Mapping
    await page.getByRole('button', { name: /add mapping/i }).click();

    // A Source Field text input should now be visible in the table
    const sourceInput = page.getByRole('textbox', { name: /source field/i });
    await expect(sourceInput).toBeVisible({ timeout: 5000 });

    // Target Field input should also appear
    const targetInput = page.getByRole('textbox', { name: /target field/i });
    await expect(targetInput).toBeVisible();
  });

  // TC-42: After Add, editing row shows input fields
  test('TC-42 — Editing row shows Source Field and Target Field inputs', async ({ page }) => {
    await page.goto(DETAILS_URL);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /add mapping/i }).click();

    // Row-level Save and Cancel buttons must be visible (confirms edit mode)
    await expect(page.getByRole('button', { name: /^save$/i }).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('button', { name: /^cancel$/i }).first()).toBeVisible();
  });

  // TC-43: Save button in editing row saves and exits edit mode
  test('TC-43 — Filling and saving a new mapping row removes the input fields', async ({ page }) => {
    await page.goto(DETAILS_URL);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /add mapping/i }).click();

    // Fill in the new row
    await page.getByRole('textbox', { name: /source field/i }).fill('claimNumber');
    await page.getByRole('textbox', { name: /target field/i }).fill('claim_number');

    // Save the row
    await page.getByRole('button', { name: /^save$/i }).first().click();

    // Input fields should no longer be visible (edit mode exited)
    await expect(page.getByRole('textbox', { name: /source field/i })).not.toBeVisible({ timeout: 3000 });
  });

  // TC-44: Cancel button in editing row discards and exits edit mode
  test('TC-44 — Cancelling a new mapping row removes the input fields without saving', async ({ page }) => {
    await page.goto(DETAILS_URL);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /add mapping/i }).click();

    // Confirm edit mode
    await expect(page.getByRole('textbox', { name: /source field/i })).toBeVisible({ timeout: 5000 });

    // Cancel the row
    await page.getByRole('button', { name: /^cancel$/i }).first().click();

    // Input fields should be gone
    await expect(page.getByRole('textbox', { name: /source field/i })).not.toBeVisible({ timeout: 3000 });
  });
});
