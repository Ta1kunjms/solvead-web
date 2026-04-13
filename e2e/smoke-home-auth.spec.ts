import { test, expect } from '@playwright/test'

test.describe('Home auth shell smoke', () => {
  test('loads login shell and supports register toggle', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByText('SolveAd')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Login' })).toBeVisible()

    await page.getByRole('button', { name: 'Register' }).nth(0).click()

    await expect(page.getByRole('combobox')).toBeVisible()
    await expect(page.getByPlaceholder('First name')).toBeVisible()
    await expect(page.getByPlaceholder('Last name')).toBeVisible()
    await expect(page.getByPlaceholder('LRN or Gmail')).toBeVisible()
    await expect(page.getByPlaceholder('Password')).toBeVisible()
  })
})
