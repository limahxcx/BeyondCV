import * as pdfjs from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import mammoth from 'mammoth/mammoth.browser.js'

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

export const MAX_FILE_BYTES = 10 * 1024 * 1024

export async function extractResumeFile(file: File, onProgress?: (percent: number) => void): Promise<string> {
  if (file.size > MAX_FILE_BYTES) throw new Error('This file is larger than 10 MB. Choose a smaller file.')
  const extension = file.name.split('.').pop()?.toLocaleLowerCase()
  onProgress?.(10)
  if (extension === 'txt') {
    const text = await file.text()
    onProgress?.(100)
    if (!text.trim()) throw new Error('The text file is empty.')
    return text
  }
  const buffer = await file.arrayBuffer()
  onProgress?.(30)
  if (extension === 'docx') {
    const result = await mammoth.extractRawText({ arrayBuffer: buffer })
    onProgress?.(100)
    if (!result.value.trim()) throw new Error('No readable text was found in this DOCX file.')
    return result.value
  }
  if (extension === 'pdf') {
    const document = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise
    try {
      const pages: string[] = []
      for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
        const page = await document.getPage(pageNumber)
        const content = await page.getTextContent()
        pages.push(content.items.map((item) => ('str' in item ? item.str : '')).join(' '))
        onProgress?.(30 + Math.round((pageNumber / document.numPages) * 70))
      }
      const text = pages.join('\n\n').trim()
      if (!text) throw new Error('No selectable text was found. This may be a scanned PDF; OCR is not available in this version. Paste the text or use a text-based PDF.')
      return text
    } finally {
      await document.destroy()
    }
  }
  throw new Error('Unsupported file type. Choose a PDF, DOCX, or TXT file.')
}
