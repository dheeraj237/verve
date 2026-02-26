/**
 * Simple RetryPolicy helper with configurable backoff delays
 */
export class RetryPolicy {
  private backoffs: number[];

  constructor(backoffs: number[] = [1000, 3000, 5000]) {
    this.backoffs = backoffs.slice();
  }

  /**
   * Get delay for a given attempt (0-based). Returns 0 for attempt 0.
   */
  getDelay(attempt: number): number {
    if (attempt <= 0) return 0;
    return this.backoffs[Math.min(attempt - 1, this.backoffs.length - 1)];
  }

  async waitForAttempt(attempt: number): Promise<void> {
    const d = this.getDelay(attempt);
    if (d > 0) return new Promise((r) => setTimeout(r, d));
    return Promise.resolve();
  }
}

export const defaultRetryPolicy = new RetryPolicy();
