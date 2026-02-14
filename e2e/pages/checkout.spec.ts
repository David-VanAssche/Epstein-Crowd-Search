import { test, expect } from '@playwright/test'

test.describe('Checkout Success Page', () => {
  test('loads without errors', async ({ page }) => {
    const res = await page.goto('/checkout/success')
    expect(res?.status()).toBeLessThan(500)
  })

  test('shows thank you heading', async ({ page }) => {
    await page.goto('/checkout/success')
    await expect(page.getByRole('heading', { name: /thank you/i })).toBeVisible()
  })

  test('shows receipt message', async ({ page }) => {
    await page.goto('/checkout/success')
    await expect(page.getByText(/receipt/i)).toBeVisible()
  })

  test('has "See Your Impact" link to /funding', async ({ page }) => {
    await page.goto('/checkout/success')
    const link = page.getByRole('link', { name: /see your impact/i })
    await expect(link).toBeVisible()
    await expect(link).toHaveAttribute('href', '/funding')
  })

  test('has "Back to Archive" link to /', async ({ page }) => {
    await page.goto('/checkout/success')
    const link = page.getByRole('link', { name: /back to archive/i })
    await expect(link).toBeVisible()
    await expect(link).toHaveAttribute('href', '/')
  })

  test('shows session reference when session_id is present', async ({ page }) => {
    await page.goto('/checkout/success?session_id=cs_test_a1b2c3d4e5f6g7h8i9j0abcdef')
    await expect(page.getByText(/reference/i)).toBeVisible()
    await expect(page.getByText(/cs_test_a1b2c3d4e5f6/)).toBeVisible()
  })

  test('does not show reference when session_id is absent', async ({ page }) => {
    await page.goto('/checkout/success')
    await expect(page.getByText(/reference/i)).not.toBeVisible()
  })
})

test.describe('Checkout Cancel Page', () => {
  test('loads without errors', async ({ page }) => {
    const res = await page.goto('/checkout/cancel')
    expect(res?.status()).toBeLessThan(500)
  })

  test('shows payment cancelled heading', async ({ page }) => {
    await page.goto('/checkout/cancel')
    await expect(page.getByRole('heading', { name: /cancelled/i })).toBeVisible()
  })

  test('shows reassuring message about not being charged', async ({ page }) => {
    await page.goto('/checkout/cancel')
    await expect(page.getByText(/not been charged/i)).toBeVisible()
  })

  test('has "Back to Funding" link', async ({ page }) => {
    await page.goto('/checkout/cancel')
    const link = page.getByRole('link', { name: /back to funding/i })
    await expect(link).toBeVisible()
    await expect(link).toHaveAttribute('href', '/funding')
  })

  test('has "Back to Archive" link', async ({ page }) => {
    await page.goto('/checkout/cancel')
    const link = page.getByRole('link', { name: /back to archive/i })
    await expect(link).toBeVisible()
    await expect(link).toHaveAttribute('href', '/')
  })
})
