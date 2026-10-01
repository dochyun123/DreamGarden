// 일시정지 가능한 타이머 묶음. 연출 한 번(세션)마다 하나씩 쓰고 clear()로 전부 버린다.

interface Timer {
  fn: () => void;
  remaining: number;
  startedAt: number;
  handle: ReturnType<typeof setTimeout> | null;
}

export class PausableClock {
  private timers = new Set<Timer>();
  private paused = false;
  private cleared = false;

  constructor(startPaused = false) {
    this.paused = startPaused;
  }

  schedule(fn: () => void, ms: number): void {
    if (this.cleared) return;
    const t: Timer = { fn, remaining: Math.max(0, ms), startedAt: 0, handle: null };
    this.timers.add(t);
    if (!this.paused) this.arm(t);
  }

  pause(): void {
    if (this.paused || this.cleared) return;
    this.paused = true;
    const now = Date.now();
    for (const t of this.timers) {
      if (t.handle !== null) clearTimeout(t.handle);
      t.handle = null;
      t.remaining = Math.max(0, t.remaining - (now - t.startedAt));
    }
  }

  resume(): void {
    if (!this.paused || this.cleared) return;
    this.paused = false;
    for (const t of this.timers) this.arm(t);
  }

  clear(): void {
    this.cleared = true;
    for (const t of this.timers) if (t.handle !== null) clearTimeout(t.handle);
    this.timers.clear();
  }

  isPaused(): boolean {
    return this.paused;
  }

  private arm(t: Timer): void {
    t.startedAt = Date.now();
    t.handle = setTimeout(() => {
      this.timers.delete(t);
      if (!this.cleared) t.fn();
    }, t.remaining);
  }
}
