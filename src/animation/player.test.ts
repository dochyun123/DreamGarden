import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AnimationEndReason } from '../types';
import { createAnimationPlayer, LOAD_TIMEOUT_MS, VIDEO_GRACE_MS, type AnimationPlayer } from './player';
import { DURATION } from './scenes';

const ctx = { teamName: '믿음팀', livesBefore: 3, livesAfter: 2 };

let host: HTMLElement;
let player: AnimationPlayer;
let playImpl: () => Promise<void>;

function track(p: Promise<AnimationEndReason>) {
  const t = { result: undefined as AnimationEndReason | undefined, calls: 0 };
  p.then((r) => {
    t.result = r;
    t.calls++;
  });
  return t;
}

const video = () => host.querySelector('video');
const overlay = () => host.querySelector('.ap-overlay');

beforeEach(() => {
  vi.useFakeTimers();
  host = document.createElement('div');
  document.body.appendChild(host);
  playImpl = () => new Promise(() => {}); // 기본: 로딩이 끝나지 않음
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function () {
    return playImpl();
  });
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
  player = createAnimationPlayer(host, './media/');
});

afterEach(() => {
  player.cancel();
  host.remove();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('연출 길이 기준', () => {
  it('기획서 범위 안에 있다', () => {
    expect(DURATION.correct).toBeGreaterThanOrEqual(1500);
    expect(DURATION.correct).toBeLessThanOrEqual(2000);
    expect(DURATION.wrongCaption).toBeGreaterThanOrEqual(1000);
    expect(DURATION.wrongCaption).toBeLessThanOrEqual(1500);
    expect(DURATION.heart).toBeGreaterThanOrEqual(500);
    expect(DURATION.heart).toBeLessThanOrEqual(800);
    for (const d of [DURATION.inferno, DURATION.heaven]) {
      expect(d).toBeGreaterThanOrEqual(4000);
      expect(d).toBeLessThanOrEqual(6000);
    }
  });
});

describe('영상 우선 → 대체 연출', () => {
  it('영상 오류면 대체 연출 후 ended, 오버레이 제거', async () => {
    const t = track(player.play('correct', ctx));
    expect(video()?.getAttribute('src')).toBe('./media/correct.mp4');
    video()!.dispatchEvent(new Event('error'));
    expect(video()).toBeNull();
    expect(host.textContent).toContain('정답!');
    expect(player.isPlaying()).toBe(true);
    await vi.advanceTimersByTimeAsync(DURATION.correct - 1);
    expect(t.result).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1);
    expect(t.result).toBe('ended');
    expect(overlay()).toBeNull();
    expect(player.isPlaying()).toBe(false);
  });

  it('한 번 실패한 kind는 다음부터 바로 대체 연출', async () => {
    track(player.play('correct', ctx));
    video()!.dispatchEvent(new Event('error'));
    await vi.advanceTimersByTimeAsync(DURATION.correct);
    track(player.play('correct', ctx));
    expect(video()).toBeNull();
    expect(host.textContent).toContain('정답!');
  });

  it('로딩 타임아웃이면 대체 연출', async () => {
    const t = track(player.play('heaven', ctx));
    await vi.advanceTimersByTimeAsync(LOAD_TIMEOUT_MS);
    expect(video()).toBeNull();
    expect(host.querySelector('[data-scene="heaven"]')).not.toBeNull();
    await vi.advanceTimersByTimeAsync(DURATION.heaven);
    expect(t.result).toBe('ended');
  });

  it('play() 거부(자동재생 차단 등)면 대체 연출', async () => {
    playImpl = () => Promise.reject(Object.assign(new Error('x'), { name: 'NotAllowedError' }));
    const t = track(player.play('inferno', ctx));
    await vi.advanceTimersByTimeAsync(0);
    expect(video()).toBeNull();
    await vi.advanceTimersByTimeAsync(DURATION.inferno);
    expect(t.result).toBe('ended');
  });

  it('영상이 끝나면 ended', async () => {
    playImpl = () => Promise.resolve();
    const t = track(player.play('heaven', ctx));
    video()!.dispatchEvent(new Event('playing'));
    await vi.advanceTimersByTimeAsync(LOAD_TIMEOUT_MS + 1000); // 로딩 타임아웃은 무시돼야 함
    expect(video()).not.toBeNull();
    video()!.dispatchEvent(new Event('ended'));
    await vi.advanceTimersByTimeAsync(0);
    expect(t.result).toBe('ended');
    expect(overlay()).toBeNull();
  });

  it('오답 영상이 끝나면 하트 소멸을 이어서 보여준다', async () => {
    const t = track(player.play('wrong', ctx));
    video()!.dispatchEvent(new Event('playing'));
    video()!.dispatchEvent(new Event('ended'));
    expect(host.querySelector('[data-part="hearts"]')).not.toBeNull();
    await vi.advanceTimersByTimeAsync(DURATION.heart - 1);
    expect(t.result).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1);
    expect(t.result).toBe('ended');
  });

  it('재생 중 오류면 대체 연출 후 error', async () => {
    const t = track(player.play('correct', ctx));
    video()!.dispatchEvent(new Event('playing'));
    video()!.dispatchEvent(new Event('error'));
    await vi.advanceTimersByTimeAsync(DURATION.correct);
    expect(t.result).toBe('error');
  });

  it('재생이 멈추면 영상 길이+여유 뒤 대체 연출(error)', async () => {
    const t = track(player.play('inferno', ctx));
    const v = video()!;
    Object.defineProperty(v, 'duration', { value: 5 });
    v.dispatchEvent(new Event('playing'));
    await vi.advanceTimersByTimeAsync(5000 + VIDEO_GRACE_MS - 1);
    expect(video()).not.toBeNull();
    await vi.advanceTimersByTimeAsync(1);
    expect(video()).toBeNull();
    await vi.advanceTimersByTimeAsync(DURATION.inferno);
    expect(t.result).toBe('error');
  });
});

describe('취소 · 건너뛰기', () => {
  it('cancel → cancelled, 늦은 ended·타이머는 무시, resolve 1회', async () => {
    const t = track(player.play('correct', ctx));
    const v = video()!;
    v.dispatchEvent(new Event('playing'));
    player.cancel();
    v.dispatchEvent(new Event('ended'));
    v.dispatchEvent(new Event('error'));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(t.result).toBe('cancelled');
    expect(t.calls).toBe(1);
    expect(overlay()).toBeNull();
    expect(player.isPlaying()).toBe(false);
  });

  it('대체 연출 중 cancel 후 타이머가 결과를 바꾸지 않는다', async () => {
    const t = track(player.play('wrong', ctx));
    video()!.dispatchEvent(new Event('error'));
    await vi.advanceTimersByTimeAsync(500);
    player.cancel();
    player.skip();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(t.result).toBe('cancelled');
    expect(t.calls).toBe(1);
  });

  it('skip → skipped', async () => {
    const t = track(player.play('heaven', ctx));
    player.skip();
    await vi.advanceTimersByTimeAsync(0);
    expect(t.result).toBe('skipped');
    expect(overlay()).toBeNull();
  });

  it('재생 중 새 play는 이전 것을 cancelled로 끝낸다', async () => {
    const a = track(player.play('wrong', ctx));
    const b = track(player.play('inferno', { ...ctx, livesAfter: 0, livesBefore: 1 }));
    await vi.advanceTimersByTimeAsync(0);
    expect(a.result).toBe('cancelled');
    expect(b.result).toBeUndefined();
    expect(host.querySelectorAll('.ap-overlay').length).toBe(1);
    player.skip();
    await vi.advanceTimersByTimeAsync(0);
    expect(b.result).toBe('skipped');
  });

  it('idle 상태의 skip/cancel/pause/resume은 안전하다', () => {
    expect(() => {
      player.skip();
      player.cancel();
      player.pause();
      player.resume();
    }).not.toThrow();
    expect(player.isPlaying()).toBe(false);
  });
});

describe('일시정지', () => {
  it('대체 연출 타이머가 멈췄다가 남은 시간만큼 이어진다', async () => {
    const t = track(player.play('correct', ctx));
    video()!.dispatchEvent(new Event('error'));
    await vi.advanceTimersByTimeAsync(1000);
    player.pause();
    expect(overlay()!.classList.contains('ap-paused')).toBe(true);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(t.result).toBeUndefined();
    player.resume();
    expect(overlay()!.classList.contains('ap-paused')).toBe(false);
    await vi.advanceTimersByTimeAsync(DURATION.correct - 1000 - 1);
    expect(t.result).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1);
    expect(t.result).toBe('ended');
  });

  it('로딩 타임아웃도 일시정지된다', async () => {
    track(player.play('correct', ctx));
    player.pause();
    await vi.advanceTimersByTimeAsync(LOAD_TIMEOUT_MS * 4);
    expect(video()).not.toBeNull();
    player.resume();
    await vi.advanceTimersByTimeAsync(LOAD_TIMEOUT_MS);
    expect(video()).toBeNull();
  });

  it('영상 일시정지·재개 시 pause/play를 호출하고, 일시정지 중 AbortError는 오류가 아니다', async () => {
    const t = track(player.play('heaven', ctx));
    const v = video()!;
    v.dispatchEvent(new Event('playing'));
    const pauseSpy = vi.mocked(HTMLMediaElement.prototype.pause);
    const playSpy = vi.mocked(HTMLMediaElement.prototype.play);
    pauseSpy.mockClear();
    playSpy.mockClear();
    playImpl = () => Promise.reject(Object.assign(new Error('interrupted'), { name: 'AbortError' }));
    player.pause();
    expect(pauseSpy).toHaveBeenCalled();
    player.resume();
    expect(playSpy).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(0);
    expect(video()).toBe(v);
    v.dispatchEvent(new Event('ended'));
    await vi.advanceTimersByTimeAsync(0);
    expect(t.result).toBe('ended');
  });

  it('일시정지 중 시작한 연출은 resume 전까지 진행하지 않는다', async () => {
    player.pause();
    const t = track(player.play('correct', ctx));
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(t.result).toBeUndefined();
    player.resume();
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();
  });
});

describe('오답 대체 연출', () => {
  it('자막 → 하트 소멸, 정답 보기는 공개하지 않는다', async () => {
    const t = track(player.play('wrong', ctx));
    video()!.dispatchEvent(new Event('error'));
    expect(host.textContent).toContain('땡!');
    expect(host.querySelector('[data-part="hearts"]')).toBeNull();
    await vi.advanceTimersByTimeAsync(DURATION.wrongCaption);
    expect(host.querySelector('[data-part="caption"]')).toBeNull();
    expect(host.querySelectorAll('.ap-heart').length).toBe(3);
    expect(host.querySelectorAll('.ap-heart.ap-lost').length).toBe(1);
    expect(host.textContent).toContain('목숨 3개');
    await vi.advanceTimersByTimeAsync(200);
    expect(host.querySelector('.ap-heart.ap-break')).not.toBeNull();
    expect(host.textContent).toContain('목숨 2개');
    expect(host.textContent).not.toMatch(/정답/);
    await vi.advanceTimersByTimeAsync(DURATION.heart - 200);
    expect(t.result).toBe('ended');
  });

  it('마지막 목숨이면 0개 표시', async () => {
    track(player.play('wrong', { teamName: 'A', livesBefore: 1, livesAfter: 0 }));
    video()!.dispatchEvent(new Event('error'));
    await vi.advanceTimersByTimeAsync(DURATION.wrongCaption + 200);
    expect(host.textContent).toContain('목숨 0개');
  });

  it('팀명은 textContent로만 들어간다', async () => {
    track(player.play('inferno', { teamName: '<img src=x onerror=alert(1)>', livesBefore: 1, livesAfter: 0 }));
    video()!.dispatchEvent(new Event('error'));
    expect(host.querySelector('img')).toBeNull();
    expect(host.textContent).toContain('<img src=x');
  });
});

describe('음량', () => {
  it('setVolume은 0~1로 제한되어 영상에 반영된다', () => {
    track(player.play('correct', ctx));
    player.setVolume(0.3);
    expect(video()!.volume).toBeCloseTo(0.3);
    player.setVolume(5);
    expect(video()!.volume).toBe(1);
    player.setVolume(-1);
    expect(video()!.volume).toBe(0);
  });

  it('AudioContext가 없어도 unlockAudio는 실패하지 않는다', async () => {
    await expect(player.unlockAudio()).resolves.toBeUndefined();
  });
});
