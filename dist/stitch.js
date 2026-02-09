"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.tryStitchFromPageData = tryStitchFromPageData;
const axios_1 = __importDefault(require("axios"));
const sharp_1 = __importDefault(require("sharp"));
const image_1 = require("./image");
const pageData_1 = require("./pageData");
function collectImageGroups(pageData) {
    if (!pageData) {
        return { staticImageUrls: [], carouselGroupsUrls: [] };
    }
    const staticImageUrls = [];
    const carouselGroupsUrls = [];
    for (const item of pageData.body) {
        if (item.tag === 'FundImgContainer') {
            const src = item.props?.src;
            if (src)
                staticImageUrls.push(src);
            continue;
        }
        if (item.tag === 'FundCarouselList') {
            for (const slide of item.children ?? []) {
                const slideImgs = [];
                for (const gchild of slide.children ?? []) {
                    const src = gchild.props?.src;
                    if (src)
                        slideImgs.push(src);
                }
                if (slideImgs.length > 0)
                    carouselGroupsUrls.push(slideImgs);
            }
        }
    }
    return { staticImageUrls, carouselGroupsUrls };
}
async function downloadImage(url, timeoutMs) {
    const res = await axios_1.default.get(url, {
        responseType: 'arraybuffer',
        timeout: timeoutMs,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'
        }
    });
    return Buffer.from(res.data);
}
async function tryStitchFromPageData(options) {
    const htmlRes = await axios_1.default.get(options.url, { timeout: options.timeoutMs });
    const pageData = (0, pageData_1.extractPageDataFromHtml)(htmlRes.data);
    if (!pageData)
        return null;
    const { staticImageUrls, carouselGroupsUrls } = collectImageGroups(pageData);
    if (carouselGroupsUrls.length === 0)
        return null;
    const imageUrls = [];
    imageUrls.push(...staticImageUrls);
    for (const group of carouselGroupsUrls)
        imageUrls.push(...group);
    if (imageUrls.length === 0)
        return null;
    const buffers = [];
    for (const url of imageUrls) {
        try {
            buffers.push(await downloadImage(url, options.timeoutMs));
        }
        catch {
            return null;
        }
    }
    const metas = await Promise.all(buffers.map((b) => (0, sharp_1.default)(b).metadata()));
    const first = metas[0];
    if (!first.width || !first.height)
        return null;
    const baseWidth = first.width;
    const resizedHeights = [];
    let totalHeight = 0;
    for (const meta of metas) {
        if (!meta.width || !meta.height)
            return null;
        const h = Math.floor((meta.height * baseWidth) / meta.width);
        resizedHeights.push(h);
        totalHeight += h;
        if (totalHeight > options.maxHeight)
            return null;
    }
    const isPng = options.format === 'png';
    const channels = isPng ? 4 : 3;
    const background = isPng ? { r: 0, g: 0, b: 0, alpha: 0 } : { r: 255, g: 255, b: 255 };
    const canvas = (0, sharp_1.default)({
        create: {
            width: baseWidth,
            height: totalHeight,
            channels,
            background
        }
    });
    let top = 0;
    const composites = [];
    for (let i = 0; i < buffers.length; i += 1) {
        const resized = await (0, sharp_1.default)(buffers[i]).resize({ width: baseWidth }).toBuffer();
        composites.push({ input: resized, top, left: 0 });
        top += resizedHeights[i];
    }
    const pipeline = canvas.composite(composites);
    const output = options.format === 'jpeg'
        ? await pipeline.jpeg({ quality: options.quality }).toBuffer()
        : await pipeline.png().toBuffer();
    const meta = await (0, sharp_1.default)(output).metadata();
    if (!meta.width || !meta.height)
        return null;
    return {
        from: 'stitch',
        format: options.format,
        width: meta.width,
        height: meta.height,
        dataUrl: (0, image_1.bufferToDataUrl)(output, options.format)
    };
}
