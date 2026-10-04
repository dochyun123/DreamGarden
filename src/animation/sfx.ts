// 8비트(칩튠) 느낌의 Web Audio 효과음 — 외부 파일 없이 사각파·삼각파 삑삑이로 만든다.
// 모든 함수는 out(세션별 GainNode)에 연결하므로, 세션 정리 시 out.disconnect()로 즉시 끊긴다.
// 나중에 실제 음원으로 바꾸기 쉽도록 짧고 단순하게 둔다.

type Wave = 'square' | 'triangle';

/** 음 하나: 시작(초)·길이(초)·주파수. freqEnd가 있으면 계단식이 아닌 선형으로 미끄러진다 */
function note(
  ctx: AudioContext,
  out: AudioNode,
  o: { type?: Wave; freq: number; freqEnd?: number; at: number; dur: number; gain?: number },
): void {
  const t0 = ctx.currentTime + o.at;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = o.type ?? 'square';
  osc.frequency.setValueAtTime(o.freq, t0);
  if (o.freqEnd !== undefined) osc.frequency.linearRampToValueAtTime(o.freqEnd, t0 + o.dur);
  const vol = o.gain ?? 0.12;
  // 칩튠처럼 거의 바로 켜지고 끝에서 짧게 꺼진다
  g.gain.setValueAtTime(vol, t0);
  g.gain.setValueAtTime(vol, t0 + Math.max(0, o.dur - 0.02));
  g.gain.linearRampToValueAtTime(0, t0 + o.dur);
  osc.connect(g).connect(out);
  osc.start(t0);
  osc.stop(t0 + o.dur + 0.02);
}

/** 음 목록을 순서대로 [주파수, 길이(초)] — 0Hz는 쉼표 */
function melody(ctx: AudioContext, out: AudioNode, seq: [number, number][], type: Wave = 'square', gain?: number, start = 0): void {
  let at = start;
  for (const [freq, dur] of seq) {
    if (freq > 0) note(ctx, out, { type, freq, at, dur: dur * 0.92, gain });
    at += dur;
  }
}

export type SfxName = 'intro' | 'correct' | 'wrong' | 'heartBreak' | 'heaven' | 'fall' | 'inferno' | 'wake' | 'blip';

// 음 높이 (Hz)
const C4 = 261.63, E4 = 329.63, G4 = 392.0, A4 = 440.0;
const C5 = 523.25, D5 = 587.33, E5 = 659.25, G5 = 783.99, A5 = 880.0, C6 = 1046.5;

export function playSfx(ctx: AudioContext, out: AudioNode, name: SfxName): void {
  switch (name) {
    case 'intro': // 꿈 속 차임 — 느린 삼각파 아르페지오
      melody(ctx, out, [[E5, 0.22], [G5, 0.22], [C6, 0.22], [G5, 0.22], [E5, 0.5]], 'triangle', 0.18);
      break;
    case 'correct': // 짧은 상승 징글
      melody(ctx, out, [[C5, 0.08], [E5, 0.08], [G5, 0.08], [C6, 0.3]]);
      break;
    case 'wrong': // 낮은 두 번 부저
      melody(ctx, out, [[150, 0.16], [0, 0.05], [110, 0.3]], 'square', 0.14);
      break;
    case 'heartBreak': // 위에서 아래로 뚝 떨어지는 소리
      note(ctx, out, { freq: 900, freqEnd: 120, at: 0, dur: 0.25, gain: 0.12 });
      break;
    case 'heaven': // 팡파르
      melody(ctx, out, [[G4, 0.12], [C5, 0.12], [E5, 0.12], [G5, 0.24], [E5, 0.12], [G5, 0.5]], 'square', 0.1);
      melody(ctx, out, [[C4, 0.48], [E4, 0.36], [C4, 0.5]], 'triangle', 0.18);
      break;
    case 'fall': // 떨어지는 휘파람
      note(ctx, out, { freq: 1200, freqEnd: 150, at: 0, dur: 1.1, gain: 0.08 });
      break;
    case 'inferno': // 낮게 우르릉 — 삼각파를 빠르게 오르내린다
      for (let i = 0; i < 10; i++) note(ctx, out, { type: 'triangle', freq: i % 2 ? 55 : 70, at: i * 0.08, dur: 0.08, gain: 0.3 });
      break;
    case 'wake': // 번쩍 깨는 소리
      melody(ctx, out, [[A4, 0.06], [D5, 0.06], [A5, 0.16]], 'square', 0.1);
      break;
    case 'blip': // 대사 글자 소리
      note(ctx, out, { freq: 620, at: 0, dur: 0.03, gain: 0.05 });
      break;
  }
}
