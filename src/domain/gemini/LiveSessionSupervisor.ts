export class LiveSessionSupervisor {
  private attempts: number[] = [];
  constructor(private readonly maxAttempts = 5, private readonly random = Math.random) {}
  nextDelay(code: number, reason: string, now = Date.now()): number | null {
    if ([1007, 4001, 4003].includes(code) || (code === 1008 && /auth|credential|api.?key|permission|quota|invalid|policy/i.test(reason))) return null;
    this.attempts = this.attempts.filter(time => now - time < 120000);
    if (this.attempts.length >= this.maxAttempts) return null;
    const delay = Math.floor(this.random() * Math.min(30000, 1000 * 2 ** this.attempts.length));
    this.attempts.push(now);
    return delay;
  }
}
