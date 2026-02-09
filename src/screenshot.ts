import { chromium, type Browser } from 'playwright'

import type { ImageFormat, RenderResult } from './image'
import { bufferToDataUrl } from './image'

export type ScreenshotOptions = {
  url: string
  fullPage: boolean
  format: ImageFormat
  quality: number
  timeoutMs: number
  waitUntil: 'load' | 'domcontentloaded' | 'networkidle'
  viewport: {
    width: number
    height: number
  }
}

let browserPromise: Promise<Browser> | null = null

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })
  }
  return browserPromise
}

export async function takeScreenshot(options: ScreenshotOptions): Promise<RenderResult> {
  const browser = await getBrowser()
  const context = await browser.newContext({
    viewport: options.viewport
  })

  const page = await context.newPage()
  try {
    await page.goto(options.url, {
      waitUntil: options.waitUntil,
      timeout: options.timeoutMs
    })

    const buffer = await page.screenshot({
      fullPage: options.fullPage,
      type: options.format,
      quality: options.format === 'jpeg' ? options.quality : undefined
    })

    const size = await page.evaluate(() => ({
      width: document.documentElement.scrollWidth,
      height: document.documentElement.scrollHeight
    }))

    return {
      from: 'screenshot',
      format: options.format,
      width: size.width,
      height: size.height,
      dataUrl: bufferToDataUrl(Buffer.from(buffer), options.format)
    }
  } finally {
    await page.close().catch(() => undefined)
    await context.close().catch(() => undefined)
  }
}

