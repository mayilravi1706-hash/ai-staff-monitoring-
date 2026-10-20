import { test, expect } from '@playwright/test';
import { loginAsAdmin, logoutUser } from './helpers/testUtils';

test.describe('3. Timetables, PDF Import, Attendance & Operations', () => {

  test('Timetable workspace and PDF preview/import flow', async ({ page }) => {
    await loginAsAdmin(page);

    await page.goto('/admin/timetable');
    await expect(page.getByRole('heading', { name: /Institutional Timetable & Schedules/i })).toBeVisible();

    // Verify upload button or dropzone exists
    await expect(page.getByText(/Upload Timetable PDF/i)).toBeVisible();

    await logoutUser(page);
  });

  test('Class coverage and attendance monitoring', async ({ page }) => {
    await loginAsAdmin(page);

    await page.goto('/admin/coverage');
    await expect(page.getByRole('heading', { name: /Class Operations & Coverage/i })).toBeVisible();

    await page.goto('/admin/attendance');
    await expect(page.getByRole('heading', { name: /Attendance Management/i })).toBeVisible();

    await logoutUser(page);
  });

  test('AI Operations Copilot and Audit Logs', async ({ page }) => {
    await loginAsAdmin(page);

    await page.goto('/admin/ai-copilot');
    await expect(page.getByRole('heading', { name: /Institutional AI Operations Copilot/i })).toBeVisible();
    await expect(page.getByPlaceholder('Ask an operational question')).toBeVisible();

    await page.goto('/admin/audit-logs');
    await expect(page.getByRole('heading', { name: /System Audit Trail & Security Logs/i })).toBeVisible();

    await page.goto('/admin/settings');
    await expect(page.getByRole('heading', { name: /System Settings & Operational Configurations/i })).toBeVisible();

    await logoutUser(page);
  });
});
