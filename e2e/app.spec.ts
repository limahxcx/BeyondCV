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

test('analisa currículo em inglês sem modificar o conteúdo e recomenda em português', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Analisar meu currículo', exact: true }).first().click()
  const text = page.getByRole('textbox', { name: /Cole o texto do currículo/ })
  await text.fill(resumeText)
  await page.getByRole('button', { name: 'Analisar currículo', exact: true }).last().click()
  await expect(page.getByRole('heading', { name: 'Pontuação geral' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Torne a descrição da responsabilidade mais específica' })).toBeVisible()
  await expect(page.getByText('Qualidade das experiências').first()).toBeVisible()
  await expect(page.getByText('Avaliação do projeto, não certificação ATS nem previsão de contratação.')).toBeVisible()
  await expect(page.locator('.recommendation-card').first().locator('.priority')).toHaveText('Alta')
  const scoreSize = await page.locator('.big-score strong').evaluate((element) => parseFloat(getComputedStyle(element).fontSize))
  expect(scoreSize).toBeGreaterThanOrEqual(48)
  expect(scoreSize).toBeLessThanOrEqual(64)
  await expect(text).toHaveValue(resumeText)
  await expect(page.getByText('Salvo neste dispositivo')).toBeVisible()
  await page.reload()
  await expect(text).toHaveValue(resumeText)
})

test('mantém português mesmo com idioma de navegador e preferência salvos diferentes', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'en-US' })
  const page = await context.newPage()
  await page.goto('/')
  await expect(page.getByText('Salvo neste dispositivo')).toBeVisible()
  await page.waitForTimeout(600)
  await page.evaluate(async () => {
    const request = indexedDB.open('beyondcv-local')
    await new Promise<void>((resolve, reject) => {
      request.onsuccess = () => {
        const db = request.result
        const transaction = db.transaction('records', 'readwrite')
        const store = transaction.objectStore('records')
        const get = store.get('app-data')
        get.onsuccess = () => {
          if (!get.result) { transaction.abort(); return }
          store.put({ ...get.result, locale: 'es' }, 'app-data')
        }
        transaction.oncomplete = () => { db.close(); resolve() }
        transaction.onabort = () => { db.close(); reject(new Error('Preferência não foi salva')) }
        transaction.onerror = () => { db.close(); reject(transaction.error) }
      }
      request.onerror = () => reject(request.error)
    })
  })
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR')
  await expect(page.getByRole('heading', { name: 'Sua experiência tem valor. Mostre ao mundo.' })).toBeVisible()
  await expect(page.getByRole('button', { name: /alterar idioma|change language|cambiar idioma/i })).toHaveCount(0)
  await context.close()
})

const routes = [
  ['/resume-analyzer', 'Analisar currículo'],
  ['/resume-builder', 'Criar currículo'],
  ['/career-impact', 'Entrevista de impacto profissional'],
  ['/job-match', 'Comparar com vaga'],
  ['/my-resumes', 'Meus currículos'],
  ['/settings', 'Configurações'],
  ['/about', 'Sobre o BeyondCV'],
  ['/privacy', 'Sua história profissional continua sendo sua.'],
  ['/scoring-methodology', 'Metodologia de avaliação'],
] as const

test('mantém entrevista, editor, comparação e importação e exportação de documentos', async ({ page }) => {
  const externalRequests: string[] = []
  page.on('request', (request) => {
    if (new URL(request.url()).origin !== 'http://127.0.0.1:5173') externalRequests.push(request.url())
  })
  await page.goto('/resume-analyzer')
  await page.getByRole('textbox', { name: /Cole o texto do currículo/ }).fill(resumeText)
  await page.getByRole('button', { name: 'Analisar currículo', exact: true }).last().click()
  await page.getByRole('button', { name: 'Entrevista de impacto profissional' }).click()
  await page.getByRole('combobox', { name: 'Escolha uma experiência' }).selectOption({ index: 1 })
  await expect(page.getByText('Qual foi sua contribuição individual?')).toBeVisible()
  await page.getByRole('button', { name: 'Criar rascunho com minhas respostas' }).click()
  await expect(page.getByText('Revise seu rascunho')).toBeVisible()
  await page.getByRole('button', { name: 'Aceitar e atualizar currículo' }).click()
  await expect(page.getByRole('heading', { name: 'Criar currículo', exact: true })).toBeVisible()
  const files: string[] = []
  for (const format of ['PDF', 'DOCX']) {
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: `Exportar ${format}` }).first().click()
    const download = await downloadPromise
    files.push((await download.path())!)
  }
  await page.getByRole('button', { name: 'Comparar com vaga' }).click()
  await page.getByPlaceholder('Cole a descrição da vaga aqui…').fill('Logistics scheduling and inventory management')
  await page.getByRole('button', { name: 'Comparar com currículo' }).click()
  await expect(page.getByText('Aderência textual estimada')).toBeVisible()
  for (const [index, format] of ['pdf', 'docx'].entries()) {
    await page.goto('/resume-analyzer')
    const bytes = await import('node:fs/promises').then((fs) => fs.readFile(files[index]))
    await page.locator('input[type=file][accept^=".pdf"]').last().setInputFiles({ name: `curriculo.${format}`, mimeType: 'application/octet-stream', buffer: bytes })
    await expect(page.getByRole('textbox', { name: /Cole o texto do currículo/ })).toHaveValue(/Taylor Morgan/)
  }
  expect(externalRequests).toEqual([])
})

for (const viewport of [{ width: 390, height: 844 }, { width: 1366, height: 768 }, { width: 1920, height: 1080 }, { width: 2560, height: 1440 }]) {
  test(`páginas e navegação responsivas em ${viewport.width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport)
    await page.goto('/')
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1)
    if (viewport.width === 390 || viewport.width === 1366) {
      await page.screenshot({ path: testInfo.outputPath(`${viewport.width}-inicio.png`), fullPage: true })
    }
    for (const [path, heading] of routes) {
      await page.goto(path)
      await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible()
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1)
      await page.reload()
      await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible()
      if (viewport.width === 390 || viewport.width === 1366) {
        await page.screenshot({ path: testInfo.outputPath(`${viewport.width}-${path.slice(1)}.png`), fullPage: true })
      }
    }
    if (viewport.width === 390) {
      await page.getByRole('button', { name: 'Abrir navegação' }).click()
      await page.getByRole('button', { name: 'Criar currículo', exact: true }).click()
      await expect(page.getByRole('combobox', { name: 'Modelo' })).toBeVisible()
    }
    await page.goto('/resume-analyzer')
    await page.getByRole('textbox', { name: /Cole o texto do currículo/ }).fill(resumeText)
    await page.getByRole('button', { name: 'Analisar currículo', exact: true }).last().click()
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1)
    if (viewport.width === 390 || viewport.width === 1366) {
      await page.screenshot({ path: testInfo.outputPath(`${viewport.width}-dashboard.png`), fullPage: true })
    }
  })
}

test('atualiza o cache antigo da PWA e mantém a navegação offline', async ({ page, context }) => {
  await page.goto('/')
  await page.evaluate(async () => {
    await caches.open('beyondcv-shell-v1')
    await navigator.serviceWorker.register('/sw.js')
    await navigator.serviceWorker.ready
  })
  await expect.poll(() => page.evaluate(() => caches.keys())).toContain('beyondcv-shell-v2')
  await expect.poll(() => page.evaluate(() => caches.keys())).not.toContain('beyondcv-shell-v1')
  await page.reload()
  await context.setOffline(true)
  await page.goto('/resume-analyzer')
  await expect(page.getByRole('heading', { name: 'Analisar currículo', exact: true })).toBeVisible()
})
