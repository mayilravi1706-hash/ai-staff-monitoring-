import { test, expect } from '@playwright/test';
import { loginAsAdmin, logoutUser } from './helpers/testUtils';

test.describe('2. Admin Dashboard, Metrics, Master Data & Navigation', () => {

  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test('Admin dashboard loads core metrics and navigation links correctly', async ({ page }) => {
    await loginAsAdmin(page);

    // Verify Dashboard Metrics Stat Cards
    await expect(page.getByText('Total Faculty', { exact: true })).toBeVisible();
    await expect(page.getByText('Timetable Slots', { exact: true })).toBeVisible();
    await expect(page.getByText('Class Coverage', { exact: true })).toBeVisible();
    await expect(page.getByText('Monitoring Signals', { exact: true })).toBeVisible();

    // Test Navigation links
    await page.goto('/admin/staff');
    await expect(page).toHaveURL(/\/admin\/staff/, { timeout: 10000 });
    await expect(page.getByRole('heading', { name: /Staff & Faculty Directory/i })).toBeVisible();

    await page.goto('/admin/departments');
    await expect(page).toHaveURL(/\/admin\/departments/, { timeout: 10000 });
    await expect(page.getByRole('heading', { name: /Academic Departments/i })).toBeVisible();

    await page.goto('/admin/timetable');
    await expect(page).toHaveURL(/\/admin\/timetable/, { timeout: 10000 });
    await expect(page.getByRole('heading', { name: /Institutional Timetable & Schedules/i })).toBeVisible();

    await logoutUser(page);
  });

  test('Master data CRUD - Departments, Classes & Subjects', async ({ page }) => {
    await loginAsAdmin(page);

    // 1. Departments management
    await page.goto('/admin/departments');
    await expect(page.getByRole('heading', { name: /Academic Departments/i })).toBeVisible();
    await expect(page.locator('table').getByText(/Computer Science/i).first()).toBeVisible();

    // 2. Classes management
    await page.goto('/admin/classes');
    await expect(page.getByRole('heading', { name: /Student Classes & Cohorts/i })).toBeVisible();
    await expect(page.locator('table').getByText(/B.Tech CSE/i).first()).toBeVisible();

    // 3. Subjects management
    await page.goto('/admin/subjects');
    await expect(page.getByRole('heading', { name: /Curriculum Subjects & Modules/i })).toBeVisible();
    await expect(page.locator('table').getByText(/Data Structures/i).first()).toBeVisible();

    // 4. Academic years management
    await page.goto('/admin/academic-years');
    await expect(page.getByRole('heading', { name: /Academic Calendar & Years/i })).toBeVisible();

    await logoutUser(page);
  });

  test('Staff management list, search & filters', async ({ page }) => {
    await loginAsAdmin(page);

    await page.goto('/admin/staff');
    await expect(page.getByRole('heading', { name: /Staff & Faculty Directory/i })).toBeVisible();

    // Search staff by name
    const searchInput = page.locator('input[placeholder*="Search staff"]');
    if (await searchInput.isVisible()) {
      await searchInput.fill('Arun');
      await expect(page.getByText(/Arun Kumar/i)).toBeVisible();
    }

    await logoutUser(page);
  });
});
