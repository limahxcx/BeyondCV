declare module 'mammoth/mammoth.browser.js' {
  type ExtractionResult = { value: string; messages: { type: 'warning' | 'error'; message: string }[] }
  const mammoth: {
    extractRawText(input: { arrayBuffer: ArrayBuffer }): Promise<ExtractionResult>
  }
  export default mammoth
}
