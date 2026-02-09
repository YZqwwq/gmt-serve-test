import { z } from 'zod'

export type PageItem = {
  tag: string
  props?: {
    src?: string
  }
  children?: PageItem[]
}

export type PageData = {
  body: PageItem[]
}

const pageItemSchema: z.ZodType<PageItem> = z.lazy(() =>
  z.object({
    tag: z.string(),
    props: z
      .object({
        src: z.string().min(1).optional()
      })
      .optional(),
    children: z.array(pageItemSchema).optional()
  })
)

const pageDataSchema = z.object({
  body: z.array(pageItemSchema)
})

export function parsePageData(input: unknown): PageData {
  return pageDataSchema.parse(input)
}

export function extractPageDataFromHtml(html: string): PageData | null {
  const candidates = [
    /window\._pageData\s*=\s*(\{[\s\S]*?\})\s*window\._mergeItem/s,
    /window\._pageData\s*=\s*(\{[\s\S]*?\})\s*<\/script>/s
  ]

  for (const re of candidates) {
    const match = html.match(re)
    if (!match) continue
    try {
      const raw = JSON.parse(match[1]) as unknown
      return parsePageData(raw)
    } catch {
      return null
    }
  }

  return null
}

