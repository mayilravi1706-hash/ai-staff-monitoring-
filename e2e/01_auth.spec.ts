import { test, expect } from '@playwright/test';
import { TEST_CREDENTIALS, loginAsAdmin, loginAsStaff, logoutUser } from './helpers/testUtils';

test.describe('1. Authentication, Sessions & Password Validation', () => {

  test.beforeEach(async ({ context }) => {
    // Clear cookies between tests to guarantee clean isolated session state
    await context.clearCookies();
  });

  test('Admin user logs in successfully and signs out', async ({ page }) => {
    await loginAsAdmin(page);

    // Verify executive operations dashboard loaded
    await expect(page.getByText(/Real-time operational monitoring/i)).toBeVisible();

    // Verify Admin role badge in top header profile
    const headerProfile = page.locator('header').locator('button').filter({ hasText: /Admin/i });
    await expect(headerProfile).toBeVisible();

    // Log out
    await logoutUser(page);
    await expect(page.locator('#identifier')).toBeVisible();
  });

  test('Staff user logs in successfully and signs out', async ({ page }) => {
    await loginAsStaff(page);

    // Verify staff workspace loaded with current expected class section
    await expect(page.getByRole('heading', { name: /Faculty Workspace/i })).toBeVisible();
    await expect(page.getByText(/Server Time Authority/i)).toBeVisible();

    // Log out
    await logoutUser(page);
    await expect(page.locator('#identifier')).toBeVisible();
  });

  test('Validates required fields when submitted empty', async ({ page }) => {
    await page.goto('/login');

    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();

    // Validation messages should appear
    await expect(page.getByText(/Email address or Staff ID is required/i)).toBeVisible();
    await expect(page.getByText(/Password is required/i)).toBeVisible();
  });

  test('Displays clear error alert on invalid credentials without disclosing account existence', async ({ page }) => {
    await page.goto('/login');

    await page.locator('#identifier').fill('nonexistent.user@college.demo');
    await page.locator('#password').fill('WrongPassword@999');

    await page.locator('button[type="submit"]').click();

    // Error alert container should appear
    await expect(page.getByText(/Authentication Failed/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Invalid email\/staff ID, password, or role selection/i)).toBeVisible();
  });

  test('Unauthenticated direct access to protected routes redirects to /login', async ({ page }) => {
    // Attempt visiting admin dashboard while unauthenticated
    await page.goto('/admin/dashboard');

    // Should be automatically routed to /login
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
    await expect(page.locator('#identifier')).toBeVisible();

    // Attempt visiting staff dashboard while unauthenticated
    await page.goto('/staff/dashboard');
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  test('Staff member cannot directly access admin-only protected route', async ({ page }) => {
    await loginAsStaff(page);

    // Now try to directly navigate to /admin/dashboard
    await page.goto('/admin/dashboard');

    // ProtectedRoute blocks unauthorized roles and routes back to staff dashboard or login
    await expect(page).not.toHaveURL(/\/admin\/dashboard/);
  });
});
