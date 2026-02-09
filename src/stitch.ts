import axios from 'axios'
import sharp from 'sharp'

import type { ImageFormat, RenderResult } from './image'
import { bufferToDataUrl } from './image'
import { extractPageDataFromHtml } from './pageData'

export type StitchOptions = {
  url: string
  format: ImageFormat
  quality: number
  maxHeight: number
  timeoutMs: number
}

type ExtractedImageGroups = {
  staticImageUrls: string[]
  carouselGroupsUrls: string[][]
}

function collectImageGroups(pageData: ReturnType<typeof extractPageDataFromHtml>): ExtractedImageGroups {
  if (!pageData) {
    return { staticImageUrls: [], carouselGroupsUrls: [] }
  }

  const staticImageUrls: string[] = []
  const carouselGroupsUrls: string[][] = []

  for (const item of pageData.body) {
    if (item.tag === 'FundImgContainer') {
      const src = item.props?.src
      if (src) staticImageUrls.push(src)
      continue
    }

    if (item.tag === 'FundCarouselList') {
      for (const slide of item.children ?? []) {
        const slideImgs: string[] = []
        for (const gchild of slide.children ?? []) {
          const src = gchild.props?.src
          if (src) slideImgs.push(src)
        }
        if (slideImgs.length > 0) carouselGroupsUrls.push(slideImgs)
      }
    }
  }

  return { staticImageUrls, carouselGroupsUrls }
}

async function downloadImage(url: string, timeoutMs: number): Promise<Buffer> {
  const res = await axios.get<ArrayBuffer>(url, {
    responseType: 'arraybuffer',
    timeout: timeoutMs,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'
    }
  })
  return Buffer.from(res.data)
}

export async function tryStitchFromPageData(options: StitchOptions): Promise<RenderResult | null> {
  const htmlRes = await axios.get<string>(options.url, { timeout: options.timeoutMs })
  const pageData = extractPageDataFromHtml(htmlRes.data)
  if (!pageData) return null

  const { staticImageUrls, carouselGroupsUrls } = collectImageGroups(pageData)
  if (carouselGroupsUrls.length === 0) return null

  const imageUrls: string[] = []
  imageUrls.push(...staticImageUrls)
  for (const group of carouselGroupsUrls) imageUrls.push(...group)
  if (imageUrls.length === 0) return null

  const buffers: Buffer[] = []
  for (const url of imageUrls) {
    try {
      buffers.push(await downloadImage(url, options.timeoutMs))
    } catch {
      return null
    }
  }

  const metas = await Promise.all(buffers.map((b) => sharp(b).metadata()))
  const first = metas[0]
  if (!first.width || !first.height) return null

  const baseWidth = first.width
  const resizedHeights: number[] = []
  let totalHeight = 0

  for (const meta of metas) {
    if (!meta.width || !meta.height) return null
    const h = Math.floor((meta.height * baseWidth) / meta.width)
    resizedHeights.push(h)
    totalHeight += h
    if (totalHeight > options.maxHeight) return null
  }

  const isPng = options.format === 'png'
  const channels = isPng ? 4 : 3
  const background = isPng ? { r: 0, g: 0, b: 0, alpha: 0 } : { r: 255, g: 255, b: 255 }

  const canvas = sharp({
    create: {
      width: baseWidth,
      height: totalHeight,
      channels,
      background
    }
  })

  let top = 0
  const composites: Array<{ input: Buffer; top: number; left: number }> = []
  for (let i = 0; i < buffers.length; i += 1) {
    const resized = await sharp(buffers[i]).resize({ width: baseWidth }).toBuffer()
    composites.push({ input: resized, top, left: 0 })
    top += resizedHeights[i]
  }

  const pipeline = canvas.composite(composites)
  const output =
    options.format === 'jpeg'
      ? await pipeline.jpeg({ quality: options.quality }).toBuffer()
      : await pipeline.png().toBuffer()

  const meta = await sharp(output).metadata()
  if (!meta.width || !meta.height) return null

  return {
    from: 'stitch',
    format: options.format,
    width: meta.width,
    height: meta.height,
    dataUrl: bufferToDataUrl(output, options.format)
  }
}
