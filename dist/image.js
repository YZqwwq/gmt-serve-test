"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bufferToDataUrl = bufferToDataUrl;
function bufferToDataUrl(buffer, format) {
    const mime = format === 'png' ? 'image/png' : 'image/jpeg';
    return `data:${mime};base64,${buffer.toString('base64')}`;
}
