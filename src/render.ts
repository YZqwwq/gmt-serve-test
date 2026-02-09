import { z } from 'zod'

import type { ImageFormat, RenderResult } from './image'
import { takeScreenshot } from './screenshot'
import { tryStitchFromPageData } from './stitch'

export const renderRequestSchema = z.object({
  url: z.string().url(),
  mode: z.enum(['auto', 'screenshot', 'stitch']).default('auto'),
  format: z.enum(['jpeg', 'png']).default('jpeg'),
  quality: z.number().int().min(1).max(100).default(80),
  fullPage: z.boolean().default(true),
  timeoutMs: z.number().int().min(1000).max(120000).default(45000),
  waitUntil: z.enum(['load', 'domcontentloaded', 'networkidle']).default('networkidle'),
  viewport: z
    .object({
      width: z.number().int().min(320).max(3840).default(1280),
      height: z.number().int().min(240).max(2160).default(720)
    })
    .default({ width: 1280, height: 720 })
})

export type RenderRequest = z.infer<typeof renderRequestSchema>

export type RenderOptions = RenderRequest & {
  maxStitchHeight: number
}

function normalizeOptions(input: RenderRequest, maxStitchHeight: number): RenderOptions {
  return {
    ...input,
    maxStitchHeight
  }
}

export async function renderToImage(input: RenderRequest, maxStitchHeight: number): Promise<RenderResult> {
  const options = normalizeOptions(input, maxStitchHeight)

  const format: ImageFormat = options.format

  if (options.mode === 'stitch') {
    const stitched = await tryStitchFromPageData({
      url: options.url,
      format,
      quality: options.quality,
      maxHeight: options.maxStitchHeight,
      timeoutMs: options.timeoutMs
    })
    if (stitched) return stitched
  }

  if (options.mode === 'auto') {
    const stitched = await tryStitchFromPageData({
      url: options.url,
      format,
      quality: options.quality,
      maxHeight: options.maxStitchHeight,
      timeoutMs: options.timeoutMs
    })
    if (stitched) return stitched
  }

  return await takeScreenshot({
    url: options.url,
    fullPage: options.fullPage,
    format,
    quality: options.quality,
    timeoutMs: options.timeoutMs,
    waitUntil: options.waitUntil,
    viewport: options.viewport
  })
}
