"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderRequestSchema = void 0;
exports.renderToImage = renderToImage;
const zod_1 = require("zod");
const screenshot_1 = require("./screenshot");
const stitch_1 = require("./stitch");
exports.renderRequestSchema = zod_1.z.object({
    url: zod_1.z.string().url(),
    mode: zod_1.z.enum(['auto', 'screenshot', 'stitch']).default('auto'),
    format: zod_1.z.enum(['jpeg', 'png']).default('jpeg'),
    quality: zod_1.z.number().int().min(1).max(100).default(80),
    fullPage: zod_1.z.boolean().default(true),
    timeoutMs: zod_1.z.number().int().min(1000).max(120000).default(45000),
    waitUntil: zod_1.z.enum(['load', 'domcontentloaded', 'networkidle']).default('networkidle'),
    viewport: zod_1.z
        .object({
        width: zod_1.z.number().int().min(320).max(3840).default(1280),
        height: zod_1.z.number().int().min(240).max(2160).default(720)
    })
        .default({ width: 1280, height: 720 })
});
function normalizeOptions(input, maxStitchHeight) {
    return {
        ...input,
        maxStitchHeight
    };
}
async function renderToImage(input, maxStitchHeight) {
    const options = normalizeOptions(input, maxStitchHeight);
    const format = options.format;
    if (options.mode === 'stitch') {
        const stitched = await (0, stitch_1.tryStitchFromPageData)({
            url: options.url,
            format,
            quality: options.quality,
            maxHeight: options.maxStitchHeight,
            timeoutMs: options.timeoutMs
        });
        if (stitched)
            return stitched;
    }
    if (options.mode === 'auto') {
        const stitched = await (0, stitch_1.tryStitchFromPageData)({
            url: options.url,
            format,
            quality: options.quality,
            maxHeight: options.maxStitchHeight,
            timeoutMs: options.timeoutMs
        });
        if (stitched)
            return stitched;
    }
    return await (0, screenshot_1.takeScreenshot)({
        url: options.url,
        fullPage: options.fullPage,
        format,
        quality: options.quality,
        timeoutMs: options.timeoutMs,
        waitUntil: options.waitUntil,
        viewport: options.viewport
    });
}
