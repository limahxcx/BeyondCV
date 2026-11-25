import { expect, test } from '@playwright/test'

const resumeText = `Taylor Morgan
taylor@example.com
SUMMARY
Operations professional with experience in warehouse scheduling.
EXPERIENCE
Operations Coordinator | Northwind Logistics | 2021 - 2024
Responsible for daily shipping operations.
EDUCATION
Diploma in Logistics
SKILLS
Scheduling, inventory management, customer service`

test('analyzes resume text and explains a concrete improvement', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Analyze my resume', exact: true }).click()
  await page.getByRole('textbox', { name: /Paste your resume text/ }).fill(resumeText)
  await page.getByRole('button', { name: 'Analyze resume' }).click()
  await expect(page.getByRole('heading', { name: 'BeyondCV score' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Replace generic responsibility phrasing' })).toBeVisible()
  await expect(page.getByText('A project assessment, not an ATS certification or hiring prediction.')).toBeVisible()
})

test('supports the mobile navigation and resume editor', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Open navigation' }).click()
  await page.getByRole('button', { name: 'Resume Builder' }).click()
  await expect(page.getByRole('heading', { name: 'Resume Builder' })).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Template' })).toBeVisible()
})

test('opens internal routes directly and after browser navigation', async ({ page }) => {
  await page.goto('/resume-analyzer')
  await expect(page.getByRole('heading', { name: 'Resume Analyzer' })).toBeVisible()
  await page.getByRole('button', { name: 'Resume Builder' }).click()
  await expect(page).toHaveURL(/\/resume-builder$/)
  await page.goBack()
  await expect(page.getByRole('heading', { name: 'Resume Analyzer' })).toBeVisible()
})
