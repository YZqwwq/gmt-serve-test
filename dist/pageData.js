"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parsePageData = parsePageData;
exports.extractPageDataFromHtml = extractPageDataFromHtml;
const zod_1 = require("zod");
const pageItemSchema = zod_1.z.lazy(() => zod_1.z.object({
    tag: zod_1.z.string(),
    props: zod_1.z
        .object({
        src: zod_1.z.string().min(1).optional()
    })
        .optional(),
    children: zod_1.z.array(pageItemSchema).optional()
}));
const pageDataSchema = zod_1.z.object({
    body: zod_1.z.array(pageItemSchema)
});
function parsePageData(input) {
    return pageDataSchema.parse(input);
}
function extractPageDataFromHtml(html) {
    const candidates = [
        /window\._pageData\s*=\s*(\{[\s\S]*?\})\s*window\._mergeItem/s,
        /window\._pageData\s*=\s*(\{[\s\S]*?\})\s*<\/script>/s
    ];
    for (const re of candidates) {
        const match = html.match(re);
        if (!match)
            continue;
        try {
            const raw = JSON.parse(match[1]);
            return parsePageData(raw);
        }
        catch {
            return null;
        }
    }
    return null;
}
