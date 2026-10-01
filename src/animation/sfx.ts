// Web Audio 효과음 합성 — 외부 파일 없이 영상이 없을 때 대체 연출에 쓴다.
// 모든 함수는 out(세션별 GainNode)에 연결하므로, 세션 정리 시 out.disconnect()로 즉시 끊긴다.

type Wave = OscillatorType;

function tone(
  ctx: AudioContext,
  out: AudioNode,
  o: { type: Wave; freq: number; freqEnd?: number; at: number; dur: number; gain: number; attack?: number },
): void {
  const t0 = ctx.currentTime + o.at;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = o.type;
  osc.frequency.setValueAtTime(o.freq, t0);
  if (o.freqEnd !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.freqEnd), t0 + o.dur);
  const attack = o.attack ?? 0.01;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(o.gain, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
  osc.connect(g).connect(out);
  osc.start(t0);
  osc.stop(t0 + o.dur + 0.05);
}

let noiseCache: { ctx: AudioContext; buf: AudioBuffer } | null = null;

function noise(
  ctx: AudioContext,
  out: AudioNode,
  o: { at: number; dur: number; gain: number; filter: BiquadFilterType; freq: number },
): void {
  if (!noiseCache || noiseCache.ctx !== ctx) {
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    noiseCache = { ctx, buf };
  }
  const t0 = ctx.currentTime + o.at;
  const src = ctx.createBufferSource();
  src.buffer = noiseCache.buf;
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = o.filter;
  f.frequency.value = o.freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(o.gain, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
  src.connect(f).connect(g).connect(out);
  src.start(t0);
  src.stop(t0 + o.dur + 0.05);
}

export type SfxName = 'correct' | 'buzzer' | 'heartPop' | 'rumble' | 'whistle' | 'thud' | 'sizzle' | 'heavenPad' | 'sparkle';

const C5 = 523.25, E5 = 659.25, G5 = 783.99, C6 = 1046.5;

export function playSfx(ctx: AudioContext, out: AudioNode, name: SfxName): void {
  switch (name) {
    case 'correct':
      [C5, E5, G5, C6].forEach((f, i) => tone(ctx, out, { type: 'triangle', freq: f, at: i * 0.09, dur: 0.3, gain: 0.5 }));
      tone(ctx, out, { type: 'sine', freq: C6 * 1.5, at: 0.4, dur: 0.5, gain: 0.2 });
      break;
    case 'buzzer':
      tone(ctx, out, { type: 'square', freq: 220, at: 0, dur: 0.25, gain: 0.25 });
      tone(ctx, out, { type: 'square', freq: 165, at: 0.28, dur: 0.45, gain: 0.25 });
      break;
    case 'heartPop':
      tone(ctx, out, { type: 'sine', freq: 900, freqEnd: 180, at: 0, dur: 0.3, gain: 0.45 });
      noise(ctx, out, { at: 0, dur: 0.12, gain: 0.15, filter: 'highpass', freq: 2000 });
      break;
    case 'rumble':
      noise(ctx, out, { at: 0, dur: 0.9, gain: 0.35, filter: 'lowpass', freq: 180 });
      break;
    case 'whistle':
      tone(ctx, out, { type: 'sine', freq: 1400, freqEnd: 180, at: 0, dur: 1.25, gain: 0.3 });
      break;
    case 'thud':
      tone(ctx, out, { type: 'sine', freq: 130, freqEnd: 40, at: 0, dur: 0.45, gain: 0.8 });
      noise(ctx, out, { at: 0, dur: 0.35, gain: 0.4, filter: 'lowpass', freq: 500 });
      break;
    case 'sizzle':
      noise(ctx, out, { at: 0.05, dur: 2.2, gain: 0.12, filter: 'bandpass', freq: 2500 });
      break;
    case 'heavenPad':
      [261.63, 329.63, 392.0, 523.25].forEach((f) =>
        tone(ctx, out, { type: 'sine', freq: f, at: 0, dur: 4.2, gain: 0.16, attack: 0.9 }),
      );
      break;
    case 'sparkle':
      [1568, 2093, 1760, 2637, 2093].forEach((f, i) =>
        tone(ctx, out, { type: 'triangle', freq: f, at: i * 0.11, dur: 0.35, gain: 0.15 }),
      );
      break;
  }
}
