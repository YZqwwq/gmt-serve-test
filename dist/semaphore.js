"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Semaphore = void 0;
class Semaphore {
    max;
    current = 0;
    waiters = [];
    constructor(max) {
        if (!Number.isInteger(max) || max <= 0) {
            throw new Error(`Semaphore max must be a positive integer, got: ${max}`);
        }
        this.max = max;
    }
    async acquire() {
        if (this.current < this.max) {
            this.current += 1;
            return () => this.release();
        }
        await new Promise((resolve) => {
            this.waiters.push(resolve);
        });
        this.current += 1;
        return () => this.release();
    }
    release() {
        this.current -= 1;
        const next = this.waiters.shift();
        if (next)
            next();
    }
}
exports.Semaphore = Semaphore;
