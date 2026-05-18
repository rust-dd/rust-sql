export interface BackoffOptions {
  initialMs?: number;
  maxMs?: number;
  factor?: number;
  jitterRatio?: number;
}

export class ExponentialBackoff {
  private attempt = 0;
  private readonly initial: number;
  private readonly max: number;
  private readonly factor: number;
  private readonly jitter: number;

  constructor(opts: BackoffOptions = {}) {
    this.initial = opts.initialMs ?? 1000;
    this.max = opts.maxMs ?? 30000;
    this.factor = opts.factor ?? 2;
    this.jitter = opts.jitterRatio ?? 0.2;
  }

  next(): number {
    const base = Math.min(this.initial * this.factor ** this.attempt, this.max);
    this.attempt++;
    const jitter = base * this.jitter * (Math.random() * 2 - 1);
    return Math.max(0, Math.round(base + jitter));
  }

  reset(): void {
    this.attempt = 0;
  }

  get attempts(): number {
    return this.attempt;
  }
}
