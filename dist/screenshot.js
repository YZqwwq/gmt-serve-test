"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.takeScreenshot = takeScreenshot;
const playwright_1 = require("playwright");
const image_1 = require("./image");
let browserPromise = null;
async function getBrowser() {
    if (!browserPromise) {
        browserPromise = playwright_1.chromium.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
    }
    return browserPromise;
}
async function takeScreenshot(options) {
    const browser = await getBrowser();
    const context = await browser.newContext({
        viewport: options.viewport
    });
    const page = await context.newPage();
    try {
        await page.goto(options.url, {
            waitUntil: options.waitUntil,
            timeout: options.timeoutMs
        });
        const buffer = await page.screenshot({
            fullPage: options.fullPage,
            type: options.format,
            quality: options.format === 'jpeg' ? options.quality : undefined,
            timeout: options.timeoutMs
        });
        const size = await page.evaluate(() => ({
            width: document.documentElement.scrollWidth,
            height: document.documentElement.scrollHeight
        }));
        return {
            from: 'screenshot',
            format: options.format,
            width: size.width,
            height: size.height,
            dataUrl: (0, image_1.bufferToDataUrl)(Buffer.from(buffer), options.format)
        };
    }
    finally {
        await page.close().catch(() => undefined);
        await context.close().catch(() => undefined);
    }
}
