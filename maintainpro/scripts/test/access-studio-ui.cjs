// Isolated mocked UI check only. Browser plugin not available; use Playwright.
const { chromium, expect } = require('@playwright/test');
const fs = require('node:fs');
const out = 'docs/handover/review/access-f3-ui';
const profile = { id: 'admin', email: 'admin@example.invalid', role: 'SUPER_ADMIN', tenantId: 'tenant-a', permissions: [], enabledFeatures: [], accessStudioEnabled: true, accessConfigVersion: 2 };
const users = ['Alex', 'Blair'].map((name, i) => ({ id: `u${i + 1}`, displayName: name, email: `${name.toLowerCase()}@example.invalid`, roleName: 'TECHNICIAN', tenantId: 'tenant-a', tenantName: 'Test', isActive: true, lastLogin: null, createdAt: '2026-01-01', updatedAt: '2026-01-01' }));
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await context.addCookies([{ name: 'maintainpro_access', value: 'ui-fixture-only', url: 'http://127.0.0.1:3053' }]);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    let previewRead = false;
    let bulkPayload;
    await page.route('**/api/backend/**', async (route) => {
      const req = route.request();
      const path = new URL(req.url()).pathname.replace('/api/backend', '');
      let data = {};
      if (path === '/auth/me') {
        previewRead = Boolean(req.headers()['x-access-preview-user']);
        data = previewRead ? { ...profile, id: 'u1', role: 'TECHNICIAN' } : profile;
      } else if (path === '/tenants/me') data = [{ tenantId: 'tenant-a', tenantName: 'Test', isActive: true }];
      else if (path === '/admin/users') data = users;
      else if (path === '/admin/roles-permissions') data = { scope: 'tenant', permissions: [{ id: 'p1', key: 'assets.view', module: 'assets' }], permissionGroups: [], roles: [], coverage: {} };
      else if (path === '/admin/users/permission-overrides/bulk') {
        bulkPayload = req.postDataJSON();
        data = bulkPayload.userIds.map((userId) => ({ userId, saved: true, message: 'Saved' }));
      } else data = { items: [], data: [], total: 0, unreadCount: 0 };
      await route.fulfill({ json: { success: true, data } });
    });
    await page.addInitScript((value) => { if (!sessionStorage.getItem('maintainpro.access-preview.v1')) localStorage.setItem('maintainpro_user', JSON.stringify(value)); }, profile);
    await page.goto('http://127.0.0.1:3053/admin/users');
    await page.getByText('Access Studio: bulk permissions and preview', { exact: true }).click();
    await page.locator('details').getByRole('searchbox', { name: 'Search users', exact: true }).fill('Alex');
    await expect(page.getByRole('checkbox')).toHaveCount(1);
    await page.locator('details').getByRole('searchbox', { name: 'Search users', exact: true }).fill('');
    for (const check of await page.getByRole('checkbox').all()) await check.check();
    const panel = page.locator('details').filter({ hasText: 'Access Studio: bulk permissions and preview' });
    await panel.getByLabel('Permission', { exact: true }).selectOption('assets.view');
    await panel.getByLabel('Effect', { exact: true }).selectOption('DENY');
    await panel.getByLabel('Reason', { exact: true }).fill('Cover shift');
    await panel.getByLabel('Expiry (optional)', { exact: true }).fill('2099-01-01');
    await panel.getByRole('button', { name: 'Apply to 2 users' }).click();
    await expect(panel.getByText('Alex: Saved', { exact: true })).toBeVisible();
    expect(bulkPayload).toEqual({ userIds: ['u1', 'u2'], permissionKey: 'assets.view', effect: 'DENY', reason: 'Cover shift', expiresAt: '2099-01-01' });
    await page.screenshot({ path: `${out}/desktop.png`, fullPage: false });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: `${out}/mobile.png`, fullPage: false });
    await panel.getByRole('button', { name: 'Preview read-only' }).first().click();
    await expect(page.getByText('Preview as Alex — read-only. Changes are blocked.', { exact: true })).toBeVisible();
    await expect.poll(() => previewRead).toBe(true);
    await expect(page).toHaveURL(/\/work-orders\/my/);
    await expect(page.getByRole('heading', { name: 'My Jobs', exact: true })).toBeVisible();
    await page.screenshot({ path: `${out}/preview.png`, fullPage: false });
    await page.getByRole('button', { name: 'Exit preview', exact: true }).click();
    await expect(page.getByText('Access Studio: bulk permissions and preview', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => sessionStorage.getItem('maintainpro.access-preview.v1'))).toBeNull();
    profile.accessStudioEnabled = false;
    await page.reload();
    await expect(page.getByRole('searchbox').first()).toBeVisible();
    await expect(page.getByText('Access Studio: bulk permissions and preview', { exact: true })).toHaveCount(0);
    expect(errors).toEqual([]);
    fs.writeFileSync(`${out}/result.json`, JSON.stringify({ passed: true, mode: 'mocked UI only', desktop: '1280x900', mobile: '390x844', previewRead, pageErrors: errors }, null, 2));
    console.log('Access Studio UI PASS: search, bulk, preview header/banner, exit; desktop/mobile');
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
