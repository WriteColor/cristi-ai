export type PlayoutState = 'IDLE' | 'PREFILL' | 'PLAYING' | 'DRAINING' | 'INTERRUPTED';

export class AudioPlayoutQueue {
  state: PlayoutState = 'IDLE';
  generation = 0;
  generationComplete = false;
  turnComplete = false;
  jitterMs = 0;
  underruns = 0;
  scheduledAheadMs = 0;
  private lastArrival: number | null = null;
  private lastDuration = 0;
  get targetMs(): number { return Math.max(30, Math.min(120, 30 + this.jitterMs * 2)); }
  begin(): number {
    this.generation++; this.generationComplete = this.turnComplete = false;
    this.state = 'PREFILL'; this.lastArrival = null;
    return this.generation;
  }
  receive(nowMs: number, durationMs: number): void {
    if (this.lastArrival !== null) {
      const deviation = Math.abs(nowMs - this.lastArrival - this.lastDuration);
      this.jitterMs += (deviation - this.jitterMs) / 16;
    }
    this.lastArrival = nowMs; this.lastDuration = durationMs;
  }
  finishGeneration(): void { this.generationComplete = true; this.state = 'DRAINING'; }
  finishTurn(): void { this.turnComplete = true; this.state = 'DRAINING'; }
  interrupt(): void { this.generation++; this.state = 'INTERRUPTED'; this.scheduledAheadMs = 0; }
}
