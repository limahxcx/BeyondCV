import * as pdfjs from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import mammoth from 'mammoth/mammoth.browser.js'

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

export const MAX_FILE_BYTES = 10 * 1024 * 1024

export class ResumeFileError extends Error {}

type PositionedText = { str: string; transform: number[]; width: number; height: number }

export function reconstructPdfPage(items: PositionedText[]): string {
  const rows: { y: number; height: number; items: PositionedText[] }[] = []
  for (const item of items) {
    if (!item.str.trim()) continue
    const y = item.transform[5]
    const height = Math.max(item.height, Math.abs(item.transform[3]), 1)
    const row = rows.find((candidate) => Math.abs(candidate.y - y) <= Math.max(candidate.height, height) * 0.4)
    if (row) row.items.push(item)
    else rows.push({ y, height, items: [item] })
  }
  rows.sort((a, b) => b.y - a.y)
  const segments = rows.map((row) => {
    const sorted = row.items.sort((a, b) => a.transform[4] - b.transform[4])
    const groups: { x: number; end: number; text: string }[] = []
    for (const item of sorted) {
      const x = item.transform[4]
      const previous = groups[groups.length - 1]
      if (!previous || x - previous.end > row.height * 3) groups.push({ x, end: x + item.width, text: item.str })
      else {
        const gap = x - previous.end
        previous.text += gap > row.height * 0.15 && !/\s$/.test(previous.text) && !/^\s/.test(item.str) ? ` ${item.str}` : item.str
        previous.end = Math.max(previous.end, x + item.width)
      }
    }
    return groups
  })
  const dateOnly = /^(?:[\p{L}.]{1,12}\s+)?(?:19|20)\d{2}\s*[-–—−]\s*(?:(?:[\p{L}.]{1,12}\s+)?(?:19|20)\d{2}|present|presente|current|atual|actual|hoje)$/iu
  const starts = segments.filter((groups) => groups.length === 2 && !dateOnly.test(groups[1].text.trim())).map((groups) => groups[1].x)
  const columnStart = starts.find((start) => starts.filter((other) => Math.abs(other - start) < 12).length >= 3)
  const split = columnStart === undefined ? undefined : columnStart - 6
  if (split === undefined) return segments.map((groups) => groups.map((group) => group.text).join(' ')).join('\n')
  const left: string[] = []
  const right: string[] = []
  for (const groups of segments) {
    const leftText = groups.filter((group) => group.x < split).map((group) => group.text).join(' ')
    const rightText = groups.filter((group) => group.x >= split).map((group) => group.text).join(' ')
    if (leftText) left.push(leftText)
    if (rightText) right.push(rightText)
  }
  return [...left, ...right].join('\n')
}

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
        pages.push(reconstructPdfPage(content.items.filter((item) => 'str' in item)))
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
