import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx'
import { jsPDF } from 'jspdf'
import { resumeToText, type Resume } from '../domain/resume'

export function exportResumeJson(resume: Resume): void {
  download(new Blob([JSON.stringify(resume, null, 2)], { type: 'application/json' }), 'beyondcv-resume.json')
}

export function exportResumePdf(resume: Resume): void {
  createResumePdf(resume).save('beyondcv-resume.pdf')
}

export function createResumePdf(resume: Resume): jsPDF {
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' })
  const margin = 52
  const width = pdf.internal.pageSize.getWidth() - margin * 2
  let y = margin
  const text = resumeToText(resume)
  const paragraphs = text.split(/\n/)
  for (const [index, paragraph] of paragraphs.entries()) {
    const isHeading = /^[A-Z][A-Z &]+$/.test(paragraph.trim()) && paragraph.trim().length < 40
    const isName = index === 0
    pdf.setFont('helvetica', isHeading || isName ? 'bold' : 'normal')
    pdf.setFontSize(isName ? (resume.template === 'executive' ? 19 : 17) : isHeading ? 12 : 10)
    pdf.setTextColor(isName && resume.template !== 'classic' ? 49 : 48, isName && resume.template === 'modern' ? 81 : 55, isName && resume.template === 'modern' ? 151 : 68)
    const lines = pdf.splitTextToSize(paragraph || ' ', width) as string[]
    const required = lines.length * (isName ? 23 : isHeading ? 18 : 15) + 4
    if (y + required > pdf.internal.pageSize.getHeight() - margin) {
      pdf.addPage()
      y = margin
    }
    pdf.text(lines, margin, y)
    y += required
  }
  return pdf
}

export async function exportResumeDocx(resume: Resume): Promise<void> {
  const file = await createResumeDocx(resume)
  download(file, 'beyondcv-resume.docx')
}

export async function createResumeDocx(resume: Resume): Promise<Blob> {
  const text = resumeToText(resume)
  const paragraphs = text.split(/\n/).map((line, index) => {
    const heading = /^[A-Z][A-Z &]+$/.test(line.trim()) && line.trim().length < 40
    return new Paragraph({
      heading: heading ? HeadingLevel.HEADING_2 : undefined,
      children: [new TextRun({ text: line, bold: heading || index === 0, size: index === 0 && resume.template === 'executive' ? 36 : 24, color: index === 0 && resume.template === 'modern' ? '3157D5' : '303746' })],
      spacing: { after: 120 },
    })
  })
  return Packer.toBlob(new Document({ sections: [{ children: paragraphs }] }))
}

function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
