// 문제 화면 효과음 — 시간 제한 마지막 5초 카운트다운 "삑". 연출 플레이어와 별개의 작은 AudioContext.
let ctx: AudioContext | null = null;

/** last: 마지막(0초) 소리는 더 길고 낮게 */
export function countdownBeep(last = false): void {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(last ? 440 : 988, t0);
    const dur = last ? 0.5 : 0.12;
    g.gain.setValueAtTime(0.1, t0);
    g.gain.setValueAtTime(0.1, t0 + dur - 0.02);
    g.gain.linearRampToValueAtTime(0, t0 + dur);
    osc.connect(g).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  } catch {
    /* 오디오를 쓸 수 없는 환경이면 소리 없이 진행 */
  }
}
