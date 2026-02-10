import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify'

import { Semaphore } from './semaphore'
import { renderRequestSchema, renderToImage } from './render'

const port = Number(process.env.PORT ?? '18081')
const host = process.env.HOST ?? '0.0.0.0'

const concurrency = Number(process.env.RENDER_CONCURRENCY ?? '2')
const maxStitchHeight = Number(process.env.MAX_STITCH_HEIGHT ?? '30000')

const semaphore = new Semaphore(Number.isFinite(concurrency) ? Math.max(1, Math.floor(concurrency)) : 2)

const app = Fastify({
  logger: true,
  bodyLimit: 2 * 1024 * 1024
})

const apiPrefix = '/middle-server/api'

async function healthHandler(): Promise<{ ok: true }> {
  return { ok: true }
}

async function renderHandler(request: FastifyRequest<{ Body: unknown }>, reply: FastifyReply) {
  const parsed = renderRequestSchema.safeParse(request.body)
  if (!parsed.success) {
    reply.code(400)
    return {
      ok: false,
      error: 'INVALID_REQUEST',
      issues: parsed.error.issues
    }
  }

  const release = await semaphore.acquire()
  try {
    const result = await renderToImage(parsed.data, maxStitchHeight)
    return { ok: true, result }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    reply.code(500)
    return { ok: false, error: 'RENDER_FAILED', message }
  } finally {
    release()
  }
}

app.get('/health', healthHandler)
app.get(`${apiPrefix}/health`, healthHandler)

app.post('/render', renderHandler)
app.post(`${apiPrefix}/render`, renderHandler)

app
  .listen({ port, host })
  .then(() => undefined)
  .catch((err: unknown) => {
    app.log.error(err)
    process.exit(1)
  })
