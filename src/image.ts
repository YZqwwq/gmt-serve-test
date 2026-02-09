export type ImageFormat = 'jpeg' | 'png'

export type RenderResult = {
  from: 'screenshot' | 'stitch'
  format: ImageFormat
  width: number
  height: number
  dataUrl: string
}

export function bufferToDataUrl(buffer: Buffer, format: ImageFormat): string {
  const mime = format === 'png' ? 'image/png' : 'image/jpeg'
  return `data:${mime};base64,${buffer.toString('base64')}`
}

