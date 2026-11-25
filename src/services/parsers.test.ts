import { describe, expect, it } from 'vitest'
import { extractResumeFile, reconstructPdfPage } from './parsers'
import { createResumeDocx, createResumePdf } from './exports'
import { createEmptyResume } from '../domain/resume'
import * as pdfjs from 'pdfjs-dist'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(resolve('node_modules/pdfjs-dist/build/pdf.worker.min.mjs')).href

describe('resume import and export', () => {
  it('imports readable TXT content', async () => {
    const file = new File(['A resume with readable text.'], 'resume.txt', { type: 'text/plain' })
    await expect(extractResumeFile(file)).resolves.toContain('readable text')
  })

  it('imports DOCX content without rendering imported HTML', async () => {
    const resume = { ...createEmptyResume(), name: 'Jordan Example', summary: 'Operations professional' }
    const file = new File([await createResumeDocx(resume)], 'resume.docx')
    const text = await extractResumeFile(file)
    expect(text).toContain('Jordan Example')
    expect(text).toContain('Operations professional')
  })

  it('exports a selectable-text PDF with content in reading order', async () => {
    const resume = { ...createEmptyResume(), name: 'Jordan Example', summary: 'Improved a verified process.' }
    const pdf = createResumePdf(resume)
    const bytes = new Uint8Array(pdf.output('arraybuffer'))
    const document = await pdfjs.getDocument({ data: bytes.slice(), useSystemFonts: true }).promise
    const page = await document.getPage(1)
    const items = await page.getTextContent()
    const extracted = items.items.map((item) => ('str' in item ? item.str : '')).join(' ')
    expect(extracted.indexOf('Jordan Example')).toBeLessThan(extracted.indexOf('RESUMO PROFISSIONAL'))
    expect(extracted).toContain('Improved a verified process.')
    await document.destroy()
    const extractedImport = await extractResumeFile(new File([bytes], 'generated.pdf'))
    expect(extractedImport.indexOf('Jordan Example')).toBeLessThan(extractedImport.indexOf('RESUMO PROFISSIONAL'))
  })

  it('does not score a PDF without selectable text', async () => {
    const { jsPDF } = await import('jspdf')
    const pdf = new jsPDF().output('arraybuffer')
    await expect(extractResumeFile(new File([pdf], 'scan.pdf'))).rejects.toThrow('Nenhum texto selecionável')
  })

  it('reconstructs PDF lines and separates stable columns without dropping text', async () => {
    const { jsPDF } = await import('jspdf')
    const pdf = new jsPDF({ unit: 'pt' })
    pdf.text('EXPERIENCE', 40, 60)
    pdf.text('SKILLS', 330, 60)
    pdf.text('Manager | Example | 2020 - 2024', 40, 80)
    pdf.text('Planning', 330, 80)
    pdf.text('Improved delivery by 30 percent.', 40, 100)
    pdf.text('Communication', 330, 100)
    const text = await extractResumeFile(new File([pdf.output('arraybuffer')], 'columns.pdf'))
    expect(text.indexOf('EXPERIENCE')).toBeLessThan(text.indexOf('Manager'))
    expect(text.indexOf('Improved')).toBeLessThan(text.indexOf('SKILLS'))
    expect(text).toContain('Communication')
  })

  it('joins positioned text fragments on a baseline and keeps separate lines', () => {
    const item = (str: string, x: number, y: number, width: number) => ({ str, transform: [10, 0, 0, 10, x, y], width, height: 10 })
    expect(reconstructPdfPage([item('EXPER', 10, 100, 30), item('IENCE', 40, 100, 30), item('Manager', 10, 80, 40)])).toBe('EXPERIENCE\nManager')
  })

  it('keeps right-aligned dates with their jobs instead of treating them as a second column', async () => {
    const { jsPDF } = await import('jspdf')
    const pdf = new jsPDF({ unit: 'pt' })
    pdf.text('EXPERIENCE', 40, 50)
    for (const [index, year] of [2010, 2014, 2018].entries()) {
      const y = 80 + index * 45
      pdf.text(`Manager ${index + 1} | Example`, 40, y)
      pdf.text(`${year} - ${year + 3}`, 330, y)
      pdf.text(`Improved operations for team ${index + 1}.`, 40, y + 20)
    }
    const text = await extractResumeFile(new File([pdf.output('arraybuffer')], 'aligned.pdf'))
    expect(text).toMatch(/Manager 1 \| Example\s+2010 - 2013\nImproved operations for team 1/)
    expect(text).toMatch(/Manager 2 \| Example\s+2014 - 2017\nImproved operations for team 2/)
    expect(text).toMatch(/Manager 3 \| Example\s+2018 - 2021\nImproved operations for team 3/)
  })

  it('rejects unsupported, oversized, and empty documents', async () => {
    const unsupported = new File(['content'], 'resume.rtf')
    const empty = new File([''], 'empty.txt')
    const oversized = new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'large.txt')
    await expect(extractResumeFile(unsupported)).rejects.toThrow('Formato não aceito')
    await expect(extractResumeFile(empty)).rejects.toThrow('vazio')
    await expect(extractResumeFile(oversized)).rejects.toThrow('10 MB')
  })
})
