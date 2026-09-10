export interface TranscriptSnapshot {
  turnId: number; revision: number; isFinal: boolean; text: string;
  timestamp: number; segments: string[];
}
export function mergeTranscript(previous: string, next: string): string {
  if (!next) return previous;
  if (!previous || next.startsWith(previous)) return next;
  if (previous === next || previous.endsWith(next)) return previous;
  for (let length = Math.min(previous.length, next.length); length > 0; length--) {
    if (previous.slice(-length) === next.slice(0, length)) return previous + next.slice(length);
  }
  return previous + next;
}

export class TranscriptAssembler {
  snapshot: TranscriptSnapshot = { turnId: 0, revision: 0, isFinal: false, text: '', timestamp: 0, segments: [] };
  begin(turnId = this.snapshot.turnId + 1): void {
    this.snapshot = { turnId, revision: 0, isFinal: false, text: '', timestamp: performance.now(), segments: [] };
  }
  update(text: string, options: { mode?: 'delta' | 'snapshot'; isFinal?: boolean; revision?: number; turnId?: number } = {}): TranscriptSnapshot {
    if (options.turnId !== undefined && options.turnId !== this.snapshot.turnId) return this.snapshot;
    const revision = options.revision ?? this.snapshot.revision + 1;
    if (revision <= this.snapshot.revision || this.snapshot.isFinal) return this.snapshot;
    const merged = options.mode === 'snapshot' ? text : mergeTranscript(this.snapshot.text, text);
    this.snapshot = { ...this.snapshot, text: merged, revision, isFinal: options.isFinal ?? false,
      timestamp: performance.now(), segments: merged ? [merged] : [] };
    return this.snapshot;
  }
  finalize(): TranscriptSnapshot { return this.update(this.snapshot.text, { mode: 'snapshot', isFinal: true }); }
}
