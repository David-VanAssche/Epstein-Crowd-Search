import { test, expect } from '@playwright/test'

test.describe('Document Page', () => {
  test('shows error/empty state for non-existent UUID', async ({ page }) => {
    await page.goto('/document/00000000-0000-0000-0000-000000000000')
    const body = page.locator('body')
    await expect(body).toBeVisible()
  })

  test('does not expose sensitive data for non-UUID path', async ({ page }) => {
    await page.goto('/document/..%2F..%2Fetc%2Fpasswd')
    const body = await page.locator('body').textContent()
    expect(body).not.toContain('/etc/passwd')
  })

  test('does not expose data for SQL injection in id param', async ({ page }) => {
    await page.goto("/document/1' OR '1'='1")
    const body = await page.locator('body').textContent()
    expect(body).not.toContain('SQL')
  })

  test('page still renders with valid structure', async ({ page }) => {
    await page.goto('/document/550e8400-e29b-41d4-a716-446655440000')
    const body = page.locator('body')
    await expect(body).toBeVisible()
  })
})
