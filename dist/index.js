"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_1 = __importDefault(require("fastify"));
const semaphore_1 = require("./semaphore");
const render_1 = require("./render");
const port = Number(process.env.PORT ?? '18081');
const host = process.env.HOST ?? '0.0.0.0';
const concurrency = Number(process.env.RENDER_CONCURRENCY ?? '2');
const maxStitchHeight = Number(process.env.MAX_STITCH_HEIGHT ?? '30000');
const semaphore = new semaphore_1.Semaphore(Number.isFinite(concurrency) ? Math.max(1, Math.floor(concurrency)) : 2);
const app = (0, fastify_1.default)({
    logger: true,
    bodyLimit: 2 * 1024 * 1024
});
const apiPrefix = '/middle-server/api';
async function healthHandler() {
    return { ok: true };
}
async function renderHandler(request, reply) {
    const parsed = render_1.renderRequestSchema.safeParse(request.body);
    if (!parsed.success) {
        reply.code(400);
        return {
            ok: false,
            error: 'INVALID_REQUEST',
            issues: parsed.error.issues
        };
    }
    const release = await semaphore.acquire();
    try {
        const result = await (0, render_1.renderToImage)(parsed.data, maxStitchHeight);
        return { ok: true, result };
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        reply.code(500);
        return { ok: false, error: 'RENDER_FAILED', message };
    }
    finally {
        release();
    }
}
app.get('/health', healthHandler);
app.get(`${apiPrefix}/health`, healthHandler);
app.post('/render', renderHandler);
app.post(`${apiPrefix}/render`, renderHandler);
app
    .listen({ port, host })
    .then(() => undefined)
    .catch((err) => {
    app.log.error(err);
    process.exit(1);
});
