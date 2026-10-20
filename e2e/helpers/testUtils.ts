import { Page, expect } from '@playwright/test';

export const TEST_CREDENTIALS = {
  admin: {
    email: process.env.TEST_ADMIN_EMAIL || 'admin@college.demo',
    password: process.env.TEST_ADMIN_PASSWORD || 'Admin@123',
    role: 'ADMIN',
  },
  staff: {
    email: process.env.TEST_STAFF_EMAIL || 'arun.kumar@college.demo',
    password: process.env.TEST_STAFF_PASSWORD || 'Staff@123',
    staffId: 'STF-CSE-001',
    role: 'STAFF',
  },
};

/**
 * Perform login as an Administrator via the real browser UI
 */
export async function loginAsAdmin(page: Page) {
  await page.goto('/login');
  await expect(page).toHaveTitle(/AI Staff Operations Intelligence Platform/i);

  // Select Administrator tab exactly
  const adminTab = page.getByRole('button', { name: 'Administrator', exact: true });
  if (await adminTab.isVisible()) {
    await adminTab.click();
  }

  // Fill in credentials
  const identifierInput = page.locator('#identifier');
  const passwordInput = page.locator('#password');

  await identifierInput.fill(TEST_CREDENTIALS.admin.email);
  await passwordInput.fill(TEST_CREDENTIALS.admin.password);

  // Submit form
  const submitButton = page.locator('button[type="submit"]');
  await submitButton.click();

  // Expect redirect to admin dashboard
  await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 15000 });
  await expect(page.getByText(/Real-time operational monitoring/i)).toBeVisible({ timeout: 15000 });
}

/**
 * Perform login as a Faculty / Staff member via the real browser UI
 */
export async function loginAsStaff(page: Page) {
  await page.goto('/login');
  await expect(page).toHaveTitle(/AI Staff Operations Intelligence Platform/i);

  // Select Faculty / Staff tab exactly
  const staffTab = page.getByRole('button', { name: 'Faculty / Staff', exact: true });
  await staffTab.click();

  // Fill in credentials
  const identifierInput = page.locator('#identifier');
  const passwordInput = page.locator('#password');

  await identifierInput.fill(TEST_CREDENTIALS.staff.email);
  await passwordInput.fill(TEST_CREDENTIALS.staff.password);

  // Submit form
  const submitButton = page.locator('button[type="submit"]');
  await submitButton.click();

  // Expect redirect to staff dashboard
  await expect(page).toHaveURL(/\/staff\/dashboard/, { timeout: 15000 });
  await expect(page.getByRole('heading', { name: /Faculty Workspace/i })).toBeVisible({ timeout: 15000 });
}

/**
 * Perform sign out via the real browser UI profile dropdown or sidebar button
 */
export async function logoutUser(page: Page) {
  // Use first available sign out button (sidebar button or profile menu)
  const sidebarSignOut = page.locator('button[aria-label="Sign Out"], button[title="Sign Out"]').first();
  if (await sidebarSignOut.isVisible()) {
    await sidebarSignOut.click();
  } else {
    // Open profile menu
    const profileButton = page.locator('header').locator('button').filter({ hasText: /Admin|Faculty|User|Dr\./i }).last();
    await profileButton.click();
    const dropdownSignOut = page.getByRole('button', { name: 'Sign Out' }).last();
    await dropdownSignOut.click();
  }

  // Expect redirection back to /login
  await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
}
