interface Chunk { data: string; durationMs: number; receivedAt: number }
export class AudioInputQueue {
  private queue: Chunk[] = [];
  droppedMs = 0;
  get queuedMs(): number { return this.queue.reduce((total, chunk) => total + chunk.durationMs, 0); }
  get size(): number { return this.queue.length; }
  push(data: string, now = performance.now()): boolean {
    const bytes = data.length * 3 / 4 - (data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0);
    const durationMs = bytes / 32;
    this.queue.push({ data, durationMs, receivedAt: now });
    if (this.queuedMs > 200 || now - this.queue[0].receivedAt > 200) { this.clear(true); return false; }
    return true;
  }
  drain(send: (data: string) => boolean, now = performance.now()): boolean {
    if (this.queue[0] && now - this.queue[0].receivedAt > 200) { this.clear(true); return false; }
    while (this.queue[0] && send(this.queue[0].data)) this.queue.shift();
    return true;
  }
  clear(dropped = false): void { if (dropped) this.droppedMs += this.queuedMs; this.queue = []; }
}
