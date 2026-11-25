import { describe, expect, it } from 'vitest'
import { extractResumeFile } from './parsers'
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

  it('rejects unsupported, oversized, and empty documents', async () => {
    const unsupported = new File(['content'], 'resume.rtf')
    const empty = new File([''], 'empty.txt')
    const oversized = new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'large.txt')
    await expect(extractResumeFile(unsupported)).rejects.toThrow('Formato não aceito')
    await expect(extractResumeFile(empty)).rejects.toThrow('vazio')
    await expect(extractResumeFile(oversized)).rejects.toThrow('10 MB')
  })
})
