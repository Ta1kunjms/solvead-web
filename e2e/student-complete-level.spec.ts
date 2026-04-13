import { test, expect } from '@playwright/test'

test.describe('Student route smoke', () => {
  test('anonymous user cannot open student dashboard', async ({ page }) => {
    await page.goto('/student')
    await expect(page.getByText('SolveAd')).toBeVisible()
    await expect(page).toHaveURL(/\/$/)
  })

  test('anonymous user cannot open reward center', async ({ page }) => {
    await page.goto('/student/rewards')
    await expect(page.getByText('SolveAd')).toBeVisible()
    await expect(page).toHaveURL(/\/$/)
  })
})
