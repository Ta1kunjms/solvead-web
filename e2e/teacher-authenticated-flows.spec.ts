import { expect, test } from '@playwright/test'

const teacherEmail = process.env.TEACHER_E2E_EMAIL
const teacherPassword = process.env.TEACHER_E2E_PASSWORD

test.describe('Teacher authenticated flows', () => {
  test.skip(!teacherEmail || !teacherPassword, 'Set TEACHER_E2E_EMAIL and TEACHER_E2E_PASSWORD to run authenticated teacher flows.')

  test('teacher can open dashboard and content tools', async ({ page }) => {
    await page.goto('/')

    await page.getByPlaceholder('LRN or Gmail').fill(teacherEmail!)
    await page.getByPlaceholder('Password').fill(teacherPassword!)
    await page.getByRole('button', { name: 'Login' }).click()

    await expect(page).toHaveURL(/\/teacher$/)
    await expect(page.getByRole('heading', { name: 'Teacher Dashboard' })).toBeVisible()

    await page.getByRole('link', { name: 'Content Studio' }).click()
    await expect(page).toHaveURL(/\/teacher\/content$/)
    await expect(page.getByRole('heading', { name: 'Manage Lessons and Activities' })).toBeVisible()

    const firstLevelButton = page.getByRole('button', { name: /Level \d+/ }).first()
    await firstLevelButton.click()
    await expect(page.getByRole('button', { name: 'Create Lesson' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Create Activity' })).toBeVisible()

    await page.goto('/teacher/classes')
    await expect(page).toHaveURL(/\/teacher\/classes$/)
    await expect(page.getByRole('heading', { name: 'Manage Classes and Students' })).toBeVisible()
    const studentsCard = page.locator('.teacher-card', { hasText: 'Students' }).first()
    await expect(studentsCard).toBeVisible()
    await expect(studentsCard.locator('.teacher-metric')).toHaveText(/\S+/)

    await page.goto('/teacher/reflections')
    await expect(page.getByRole('heading', { name: 'Review Student Reflections' })).toBeVisible()
  })
})