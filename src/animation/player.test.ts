import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AnimationEndReason } from '../types';
import { createAnimationPlayer, LOAD_TIMEOUT_MS, VIDEO_GRACE_MS, type AnimationPlayer } from './player';
import { CHAR_MS } from './dialogue';
import { DIALOGUE, DURATION } from './scenes';

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
const dialogue = () => host.querySelector('[data-part="dialogue"]');
const click = () => overlay()!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
const key = (k: string) => window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
const longest = (lines: readonly string[]) => Math.max(...lines.map((l) => Array.from(l).length));

/** 대사 상자가 나올 때까지 진행 → 줄마다 다 나오길 기다렸다가 클릭 */
async function clickThrough(lines: readonly string[]) {
  for (let i = 0; i < lines.length; i++) {
    await vi.advanceTimersByTimeAsync(longest(lines) * CHAR_MS + 10);
    click();
  }
  await vi.advanceTimersByTimeAsync(0);
}

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
    // 정답: 자막 1~1.5초 → 터널 통과, 합쳐 2.5~3.5초
    expect(DURATION.correctCaption).toBeGreaterThanOrEqual(1000);
    expect(DURATION.correctCaption).toBeLessThanOrEqual(1500);
    expect(DURATION.correct).toBeGreaterThanOrEqual(2500);
    expect(DURATION.correct).toBeLessThanOrEqual(3500);
    expect(DURATION.wrongCaption).toBeGreaterThanOrEqual(1000);
    expect(DURATION.wrongCaption).toBeLessThanOrEqual(1500);
    expect(DURATION.heart).toBeGreaterThanOrEqual(500);
    expect(DURATION.heart).toBeLessThanOrEqual(800);
    for (const d of [DURATION.inferno, DURATION.heaven]) {
      expect(d).toBeGreaterThanOrEqual(4000);
      expect(d).toBeLessThanOrEqual(6000);
    }
    // 인트로 네 장면(대사 제외)은 합쳐 10초 이내
    const intro = DURATION.introChurch + DURATION.introSermon + DURATION.intro + DURATION.introSign;
    expect(intro).toBeLessThanOrEqual(10000);
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
    await clickThrough(DIALOGUE.heaven);
    expect(t.result).toBe('ended');
  });

  it('play() 거부(자동재생 차단 등)면 대체 연출', async () => {
    playImpl = () => Promise.reject(Object.assign(new Error('x'), { name: 'NotAllowedError' }));
    const t = track(player.play('inferno', ctx));
    await vi.advanceTimersByTimeAsync(0);
    expect(video()).toBeNull();
    await vi.advanceTimersByTimeAsync(DURATION.inferno);
    await clickThrough(DIALOGUE.inferno);
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
    await clickThrough(DIALOGUE.inferno);
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
    expect(host.textContent).toContain('오답');
    expect(host.querySelector('[data-part="hearts"]')).toBeNull();
    await vi.advanceTimersByTimeAsync(DURATION.wrongCaption);
    expect(host.querySelector('[data-part="caption"]')).toBeNull();
    expect(host.querySelectorAll('.ap-heart').length).toBe(3);
    expect(host.querySelectorAll('.ap-heart.ap-lost').length).toBe(1);
    await vi.advanceTimersByTimeAsync(200);
    expect(host.querySelectorAll('.ap-heart.ap-break .ap-half').length).toBe(2);
    expect(host.textContent).not.toMatch(/정답/);
    await vi.advanceTimersByTimeAsync(DURATION.heart - 200);
    expect(t.result).toBe('ended');
  });

  it('마지막 목숨이면 잃은 하트 1개, 나머지는 빈 하트', async () => {
    track(player.play('wrong', { teamName: 'A', livesBefore: 1, livesAfter: 0 }));
    video()!.dispatchEvent(new Event('error'));
    await vi.advanceTimersByTimeAsync(DURATION.wrongCaption + 200);
    expect(host.querySelectorAll('.ap-heart').length).toBe(3);
    expect(host.querySelectorAll('.ap-heart.ap-break').length).toBe(1);
  });

  it('정답·오답은 클릭을 기다리지 않고 오버레이가 클릭을 막지 않는다', () => {
    track(player.play('correct', ctx));
    video()!.dispatchEvent(new Event('error'));
    expect(overlay()!.classList.contains('ap-modal')).toBe(false);
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

describe('저사양 모드', () => {
  afterEach(() => history.replaceState(null, '', '/'));

  it('?lite=1이면 ap-lite 클래스와 적은 입자', async () => {
    history.replaceState(null, '', '/?lite=1');
    player.cancel();
    player = createAnimationPlayer(host, './media/');
    track(player.play('inferno', { teamName: 'A', livesBefore: 1, livesAfter: 0 }));
    expect(overlay()!.classList.contains('ap-lite')).toBe(true);
    video()!.dispatchEvent(new Event('error'));
    await vi.advanceTimersByTimeAsync(1100);
    expect(host.querySelectorAll('.ap-flame').length).toBe(6);
    expect(host.querySelectorAll('.ap-ember').length).toBe(8);
  });

  it('기본은 일반 모드', async () => {
    track(player.play('inferno', { teamName: 'A', livesBefore: 1, livesAfter: 0 }));
    expect(overlay()!.classList.contains('ap-lite')).toBe(false);
    video()!.dispatchEvent(new Event('error'));
    await vi.advanceTimersByTimeAsync(1100);
    expect(host.querySelectorAll('.ap-flame').length).toBe(10);
  });
});

describe('픽셀아트', () => {
  it('그림은 crispEdges SVG로 그린다', () => {
    for (const kind of ['correct', 'heaven', 'inferno'] as const) {
      track(player.play(kind, ctx));
      video()?.dispatchEvent(new Event('error'));
      const svgs = host.querySelectorAll('svg');
      expect(svgs.length).toBeGreaterThan(0);
      for (const svg of svgs) expect(svg.getAttribute('shape-rendering')).toBe('crispEdges');
      player.cancel();
    }
  });

  it('정답은 별이 터진다, lite면 수가 줄어든다', () => {
    track(player.play('correct', ctx));
    video()!.dispatchEvent(new Event('error'));
    const normal = host.querySelectorAll('.ap-burst').length;
    expect(normal).toBeGreaterThan(0);
    player.cancel();
    history.replaceState(null, '', '/?lite=1');
    player = createAnimationPlayer(host, './media/');
    track(player.play('correct', ctx));
    expect(host.querySelectorAll('.ap-burst').length).toBeLessThan(normal);
    history.replaceState(null, '', '/');
  });

  it('천국 문이 열린다', async () => {
    track(player.play('heaven', ctx));
    video()!.dispatchEvent(new Event('error'));
    await vi.advanceTimersByTimeAsync(1700);
    expect(host.querySelector('.ap-gate.open')).not.toBeNull();
  });

  it('불구덩이 끝에는 설교 시간(sermon.jpg)으로 돌아와 눈을 번쩍 뜬다', async () => {
    track(player.play('inferno', ctx));
    video()!.dispatchEvent(new Event('error'));
    await vi.advanceTimersByTimeAsync(DURATION.inferno);
    expect(host.querySelector('.ap-room .ap-sermon')).not.toBeNull();
    expect(host.querySelector('.ap-fire')).toBeNull();
  });
});

describe('천국 자막', () => {
  it('천국 입성! 아래에 말씀 구절을 표시하지 않는다', async () => {
    track(player.play('heaven', { teamName: '믿음팀', livesBefore: 2, livesAfter: 2, scriptureReference: '요한복음 3:16' }));
    video()!.dispatchEvent(new Event('error'));
    await vi.advanceTimersByTimeAsync(DURATION.heaven);
    expect(host.textContent).toContain('천국 입성!');
    expect(host.textContent).not.toContain('요한복음');
  });
});

describe('인트로', () => {
  const introCtx = { teamName: '', livesBefore: 3, livesAfter: 3 };

  it('영상 주소는 intro.mp4', () => {
    track(player.play('intro', introCtx));
    expect(video()?.getAttribute('src')).toBe('./media/intro.mp4');
  });

  it('교회 → 설교 → 잠들어 지하 기차역 → 안내판, 장면마다 대사를 클릭으로 넘기면 ended', async () => {
    const t = track(player.play('intro', introCtx));
    video()!.dispatchEvent(new Event('error'));
    expect(host.querySelector('[data-scene="intro-church"] .ap-church')).not.toBeNull();
    expect(overlay()!.classList.contains('ap-modal')).toBe(true);
    await vi.advanceTimersByTimeAsync(DURATION.introChurch - 1);
    expect(dialogue()).toBeNull();
    await vi.advanceTimersByTimeAsync(1);
    expect(dialogue()).not.toBeNull();
    await clickThrough(DIALOGUE.introChurch);

    expect(host.querySelector('[data-scene="intro-church"]')).toBeNull();
    expect(host.querySelector('[data-scene="intro-sermon"] .ap-sermon')).not.toBeNull();
    expect(dialogue()).toBeNull();
    await vi.advanceTimersByTimeAsync(DURATION.introSermon);
    await clickThrough(DIALOGUE.introSermon);

    expect(host.querySelector('[data-scene="intro"] .ap-station')).not.toBeNull();
    expect(host.querySelectorAll('.ap-lid').length).toBe(2);
    await vi.advanceTimersByTimeAsync(DURATION.intro);
    expect(host.querySelector('.ap-sermon')).toBeNull();
    expect(host.querySelector('.ap-station.clear')).not.toBeNull();
    await clickThrough(DIALOGUE.intro);

    expect(host.querySelector('[data-scene="intro-sign"]')).not.toBeNull();
    await vi.advanceTimersByTimeAsync(DURATION.introSign);
    expect(host.querySelector('.ap-dlg.ap-notice')).not.toBeNull();
    expect(t.result).toBeUndefined();
    await clickThrough(DIALOGUE.introSign);
    expect(t.result).toBe('ended');
    expect(overlay()).toBeNull();
  });

  it('정답 자막 뒤 터널을 지나 다음 문제로', async () => {
    const t = track(player.play('correct', ctx));
    video()!.dispatchEvent(new Event('error'));
    expect(host.querySelector('[data-part="tunnel"]')).toBeNull();
    await vi.advanceTimersByTimeAsync(DURATION.correctCaption);
    expect(host.textContent).not.toContain('정답!');
    expect(host.querySelector('[data-part="tunnel"]')).not.toBeNull();
    await vi.advanceTimersByTimeAsync(DURATION.correct - DURATION.correctCaption);
    expect(t.result).toBe('ended');
  });

  it('영상이 끝나면 대사 없이 ended', async () => {
    const t = track(player.play('intro', introCtx));
    video()!.dispatchEvent(new Event('playing'));
    video()!.dispatchEvent(new Event('ended'));
    await vi.advanceTimersByTimeAsync(0);
    expect(t.result).toBe('ended');
  });
});

describe('끝 장면 클릭 대기', () => {
  const lines = DIALOGUE.heaven;

  async function toDialogue() {
    const t = track(player.play('heaven', ctx));
    video()!.dispatchEvent(new Event('error'));
    await vi.advanceTimersByTimeAsync(DURATION.heaven);
    return t;
  }

  it('클릭 전에는 끝나지 않는다', async () => {
    const t = await toDialogue();
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(t.result).toBeUndefined();
    expect(player.isPlaying()).toBe(true);
    expect(host.querySelector('.ap-dlg-text')!.textContent).toBe(lines[0]);
    expect(host.querySelector('[data-part="next"]')!.classList.contains('on')).toBe(true);
  });

  it('타자기 중 클릭은 그 줄을 바로 다 보여주고, 다음 클릭은 다음 줄', async () => {
    const t = await toDialogue();
    await vi.advanceTimersByTimeAsync(CHAR_MS * 2);
    const text = host.querySelector('.ap-dlg-text')!;
    expect(text.textContent!.length).toBeLessThan(lines[0].length);
    expect(host.querySelector('[data-part="next"]')!.classList.contains('on')).toBe(false);
    click();
    expect(text.textContent).toBe(lines[0]);
    expect(host.querySelector('[data-part="next"]')!.classList.contains('on')).toBe(true);
    await vi.advanceTimersByTimeAsync(CHAR_MS * 5); // 남은 글자 타이머가 덮어쓰지 않는다
    expect(text.textContent).toBe(lines[0]);
    click();
    expect(text.textContent).toBe('');
    click(); // 2번째 줄 빨리 넘기기
    expect(text.textContent).toBe(lines[1]);
    expect(t.result).toBeUndefined();
    click();
    await vi.advanceTimersByTimeAsync(0);
    expect(t.result).toBe('ended');
  });

  it('Enter/Space로도 넘긴다', async () => {
    const t = await toDialogue();
    for (const k of [' ', 'Enter', 'Enter', 'Enter']) key(k);
    await vi.advanceTimersByTimeAsync(0);
    expect(t.result).toBe('ended');
  });

  it('대사가 나오기 전 클릭과 다른 키는 무시', async () => {
    const t = track(player.play('inferno', ctx));
    video()!.dispatchEvent(new Event('error'));
    await vi.advanceTimersByTimeAsync(1000);
    for (let i = 0; i < 5; i++) click();
    key('a');
    await vi.advanceTimersByTimeAsync(DURATION.inferno - 1000);
    expect(dialogue()).not.toBeNull();
    expect(host.querySelector('.ap-dlg-text')!.textContent).toBe('');
    await clickThrough(DIALOGUE.inferno);
    expect(t.result).toBe('ended');
  });

  it('일시정지 중에는 클릭을 무시하고 타자기도 멈춘다', async () => {
    const t = await toDialogue();
    player.pause();
    for (let i = 0; i < 6; i++) click();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(host.querySelector('.ap-dlg-text')!.textContent).toBe('');
    expect(t.result).toBeUndefined();
    player.resume();
    await clickThrough(lines);
    expect(t.result).toBe('ended');
  });

  it('skip은 대사 중에도 즉시 skipped, 이후 입력은 무시', async () => {
    const t = await toDialogue();
    player.skip();
    await vi.advanceTimersByTimeAsync(0);
    expect(t.result).toBe('skipped');
    expect(overlay()).toBeNull();
    key('Enter');
    expect(t.calls).toBe(1);
  });

  it('cancel은 대사 중에도 cancelled, 키 리스너를 떼어낸다', async () => {
    const t = await toDialogue();
    player.cancel();
    await vi.advanceTimersByTimeAsync(0);
    expect(t.result).toBe('cancelled');
    const e = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
    window.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(false);
  });

  it('불구덩이도 대사 뒤 클릭으로 끝난다', async () => {
    const t = track(player.play('inferno', ctx));
    video()!.dispatchEvent(new Event('error'));
    await vi.advanceTimersByTimeAsync(DURATION.inferno);
    expect(host.querySelector('.ap-dlg-text')).not.toBeNull();
    await clickThrough(DIALOGUE.inferno);
    expect(t.result).toBe('ended');
  });
});
