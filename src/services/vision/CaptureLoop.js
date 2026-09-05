/** One paced capture at a time, including across asynchronous stop/start races. */
export class CaptureLoop {
  constructor({ capture, onFrame, shouldCapture = () => true, onError = () => {} }) {
    Object.assign(this, { capture, onFrame, shouldCapture, onError });
    this.active = false;
    this.generation = 0;
    this.timer = null;
    this.inFlight = false;
    this.immediate = false;
    this.intervalMs = 2000;
  }

  start(intervalMs, initialDelay = 120) {
    this.stop();
    this.active = true;
    this.intervalMs = intervalMs;
    this.schedule(initialDelay);
  }

  schedule(delay) {
    if (!this.active) return;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.tick();
    }, delay);
  }

  requestImmediate() {
    if (!this.active) return;
    if (this.inFlight) this.immediate = true;
    else this.schedule(120);
  }

  async tick() {
    if (!this.active || this.inFlight) return;
    const generation = this.generation;
    this.inFlight = true;
    try {
      if (this.shouldCapture()) {
        const frame = await this.capture();
        if (frame && this.active && generation === this.generation && this.shouldCapture()) {
          this.onFrame(frame);
        }
      }
    } catch (error) {
      if (this.active && generation === this.generation) this.onError(error);
    } finally {
      this.inFlight = false;
      if (this.active && this.timer === null) {
        this.schedule(this.immediate || generation !== this.generation ? 120 : this.intervalMs);
      }
      this.immediate = false;
    }
  }

  stop() {
    this.active = false;
    this.generation++;
    this.immediate = false;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }
}
