import { test, expect } from '@playwright/test'

test.describe('Teacher content route smoke', () => {
  test('anonymous user cannot open teacher content page', async ({ page }) => {
    await page.goto('/teacher/content')
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole('button', { name: 'Register' }).first()).toBeVisible()
  })

  test('home shows role selector for registration flow', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Register' }).nth(0).click()

    const roleSelect = page.getByRole('combobox')
    await expect(roleSelect).toBeVisible()
    await expect(roleSelect).toHaveValue('student')
  })
})
