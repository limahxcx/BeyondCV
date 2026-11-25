import * as pdfjs from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import mammoth from 'mammoth/mammoth.browser.js'

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

export const MAX_FILE_BYTES = 10 * 1024 * 1024

export class ResumeFileError extends Error {}

export async function extractResumeFile(file: File, onProgress?: (percent: number) => void): Promise<string> {
  if (file.size > MAX_FILE_BYTES) throw new ResumeFileError('O arquivo ultrapassa 10 MB. Escolha um arquivo menor.')
  const extension = file.name.split('.').pop()?.toLocaleLowerCase()
  onProgress?.(10)
  if (extension === 'txt') {
    const text = await file.text()
    onProgress?.(100)
    if (!text.trim()) throw new ResumeFileError('O arquivo de texto está vazio.')
    return text
  }
  const buffer = await file.arrayBuffer()
  onProgress?.(30)
  if (extension === 'docx') {
    const result = await mammoth.extractRawText({ arrayBuffer: buffer })
    onProgress?.(100)
    if (!result.value.trim()) throw new ResumeFileError('Nenhum texto legível foi encontrado no arquivo DOCX.')
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
      if (!text) throw new ResumeFileError('Nenhum texto selecionável foi encontrado. O PDF pode ser digitalizado; OCR não está disponível nesta versão. Cole o texto ou use um PDF com texto selecionável.')
      return text
    } finally {
      await document.destroy()
    }
  }
  throw new ResumeFileError('Formato não aceito. Escolha um arquivo PDF, DOCX ou TXT.')
}
