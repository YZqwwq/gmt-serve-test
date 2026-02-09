export class Semaphore {
  private readonly max: number
  private current = 0
  private readonly waiters: Array<() => void> = []

  constructor(max: number) {
    if (!Number.isInteger(max) || max <= 0) {
      throw new Error(`Semaphore max must be a positive integer, got: ${max}`)
    }
    this.max = max
  }

  async acquire(): Promise<() => void> {
    if (this.current < this.max) {
      this.current += 1
      return () => this.release()
    }

    await new Promise<void>((resolve) => {
      this.waiters.push(resolve)
    })

    this.current += 1
    return () => this.release()
  }

  private release(): void {
    this.current -= 1
    const next = this.waiters.shift()
    if (next) next()
  }
}

