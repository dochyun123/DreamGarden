// 담당: 9d10c602 — 정답·오답(+하트 소멸)·천국·불구덩이 연출, 완료 신호, 취소, 오류 대체.
import type { AnimationEndReason, AnimationKind } from '../types';
import { PausableClock } from './clock';
import { buildScene, heartScene, type Scene, type SfxFn } from './scenes';
import { playSfx } from './sfx';
import { ensureStyles } from './styles';

export interface PlayContext {
  teamName: string;
  livesBefore: number;
  livesAfter: number;
}

export interface AnimationPlayer {
  /**
   * host 위 전체화면 오버레이로 연출 재생. 끝나면 이유와 함께 resolve (reject 금지).
   * public/media/{kind}.mp4 가 있으면 영상 우선, 없거나 오류/타임아웃이면 CSS 대체 연출+자막.
   * 'wrong'은 오답 자막(1~1.5s) → 하트 소멸(0.5~0.8s)까지 포함. 정답을 공개하지 않는다.
   * 이전 재생이 남아 있으면 먼저 cancel.
   */
  play(kind: AnimationKind, ctx: PlayContext): Promise<AnimationEndReason>;
  /** 관리자 '연출 건너뛰기' → 현재 재생 'skipped'로 종료 */
  skip(): void;
  /** Undo 등 → 영상·소리·타이머 정리, 'cancelled'로 종료 */
  cancel(): void;
  /** 관리 메뉴 열림 동안 일시정지/재개 (타이머 포함) */
  pause(): void;
  resume(): void;
  isPlaying(): boolean;
  setVolume(volume: number): void; // 0~1
  /** 시작/이어하기 버튼 클릭 핸들러 안에서 호출 (오디오 자동재생 제한 해제) */
  unlockAudio(): Promise<void>;
}

/*
 * 구현 메모
 * - 종료 이유: 영상 끝/대체 연출 끝 → 'ended'. 영상이 재생을 시작한 뒤 오류·멈춤으로 대체 연출로
 *   넘어간 경우에만 대체 연출 끝에 'error'. (영상 파일이 없어서 처음부터 대체 연출이면 'ended')
 * - 영상이 한 번도 시작하지 못한 kind는 기억해 두고 다음부터 바로 대체 연출 (404 대기 반복 방지).
 * - 'wrong' 영상이 끝나면 하트 소멸(0.7s) CSS 연출을 이어서 보여준다.
 * - pause()는 플레이어 상태다: 일시정지 중에 play()하면 일시정지된 채로 시작하고 resume()에서 진행.
 * - 모든 콜백은 세션이 살아 있는지 확인한다 → cancel/skip 뒤 늦은 타이머·ended 이벤트는 무시.
 */

export const LOAD_TIMEOUT_MS = 2500;
export const VIDEO_UNKNOWN_DURATION_MS = 20000;
export const VIDEO_GRACE_MS = 2000;

interface Session {
  kind: AnimationKind;
  ctx: PlayContext;
  clock: PausableClock;
  overlay: HTMLElement;
  done: boolean;
  resolve: (r: AnimationEndReason) => void;
  video: HTMLVideoElement | null;
  videoStarted: boolean;
  detachVideo: (() => void) | null;
  sfxOut: GainNode | null;
}

type AudioCtor = typeof AudioContext;

export function createAnimationPlayer(host: HTMLElement, mediaBase = './media/'): AnimationPlayer {
  const doc = host.ownerDocument;
  const win = doc.defaultView ?? window;
  let current: Session | null = null;
  let paused = false;
  let volume = 1;
  let audio: AudioContext | null = null;
  let master: GainNode | null = null;
  const videoUnavailable = new Set<AnimationKind>();

  function getAudio(): AudioContext | null {
    if (audio) return audio;
    const Ctor: AudioCtor | undefined =
      (win as unknown as { AudioContext?: AudioCtor }).AudioContext ??
      (win as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      audio = new Ctor();
      master = audio.createGain();
      master.gain.value = volume;
      master.connect(audio.destination);
      if (paused) void audio.suspend().catch(() => {});
    } catch {
      audio = null;
      master = null;
    }
    return audio;
  }

  function sfxFor(s: Session): SfxFn {
    return (name) => {
      if (s.done) return;
      const ac = getAudio();
      if (!ac || !master) return;
      try {
        if (!s.sfxOut) {
          s.sfxOut = ac.createGain();
          s.sfxOut.connect(master);
        }
        playSfx(ac, s.sfxOut, name);
      } catch {
        // 효과음 실패는 연출 진행에 영향을 주지 않는다
      }
    };
  }

  function finish(s: Session, reason: AnimationEndReason): void {
    if (s.done) return;
    s.done = true;
    s.clock.clear();
    stopVideo(s);
    if (s.sfxOut) {
      try {
        s.sfxOut.disconnect();
      } catch {
        /* 이미 끊김 */
      }
      s.sfxOut = null;
    }
    s.overlay.remove();
    if (current === s) current = null;
    s.resolve(reason);
  }

  function stopVideo(s: Session): void {
    const v = s.video;
    if (!v) return;
    s.detachVideo?.();
    s.detachVideo = null;
    s.video = null;
    try {
      v.pause();
      v.removeAttribute('src');
      v.load();
    } catch {
      /* jsdom 등 */
    }
    v.remove();
  }

  function runScene(s: Session, scene: Scene, endReason: AnimationEndReason): void {
    if (s.done) return;
    s.overlay.appendChild(scene.root);
    for (const step of scene.steps) {
      // 0ms 단계는 바로 실행해 빈 프레임을 없앤다
      if (step.at <= 0) step.run();
      else s.clock.schedule(() => !s.done && step.run(), step.at);
    }
    s.clock.schedule(() => finish(s, endReason), scene.duration);
  }

  function runFallback(s: Session, endReason: AnimationEndReason): void {
    runScene(s, buildScene(s.kind, doc, s.ctx, sfxFor(s)), endReason);
  }

  function videoFailed(s: Session, v: HTMLVideoElement): void {
    if (s.done || s.video !== v) return;
    const started = s.videoStarted;
    if (!started) videoUnavailable.add(s.kind);
    stopVideo(s);
    runFallback(s, started ? 'error' : 'ended');
  }

  function startPlayback(s: Session, v: HTMLVideoElement): void {
    const onReject = (err: unknown) => {
      if (s.done || s.video !== v) return;
      // pause()가 play()를 중단시킨 경우는 오류가 아니다 → resume에서 다시 play
      if (paused || (err as { name?: string } | null)?.name === 'AbortError') return;
      videoFailed(s, v);
    };
    try {
      const p = v.play() as Promise<void> | undefined;
      if (p && typeof p.then === 'function') p.catch(onReject);
    } catch (err) {
      onReject(err);
    }
  }

  function tryVideo(s: Session): void {
    const v = doc.createElement('video');
    v.className = 'ap-video';
    v.preload = 'auto';
    v.playsInline = true;
    v.setAttribute('playsinline', '');
    v.volume = volume;
    v.style.visibility = 'hidden';
    s.video = v;

    let watchdogArmed = false;
    const armWatchdog = () => {
      if (watchdogArmed || s.video !== v || !s.videoStarted) return;
      watchdogArmed = true;
      const d = v.duration;
      const ms = Number.isFinite(d) && d > 0 ? d * 1000 + VIDEO_GRACE_MS : VIDEO_UNKNOWN_DURATION_MS;
      s.clock.schedule(() => videoFailed(s, v), ms);
    };
    const onPlaying = () => {
      if (s.done || s.video !== v || s.videoStarted) return;
      s.videoStarted = true;
      v.style.visibility = '';
      if (paused) v.pause();
      armWatchdog();
    };
    const onError = () => videoFailed(s, v);
    const onEnded = () => {
      if (s.done || s.video !== v) return;
      stopVideo(s);
      if (s.kind === 'wrong') runScene(s, heartScene(doc, s.ctx, sfxFor(s)), 'ended');
      else finish(s, 'ended');
    };
    v.addEventListener('playing', onPlaying);
    v.addEventListener('error', onError);
    v.addEventListener('ended', onEnded);
    s.detachVideo = () => {
      v.removeEventListener('playing', onPlaying);
      v.removeEventListener('error', onError);
      v.removeEventListener('ended', onEnded);
    };

    s.clock.schedule(() => {
      if (!s.videoStarted) videoFailed(s, v);
    }, LOAD_TIMEOUT_MS);

    v.src = `${mediaBase}${s.kind}.mp4`;
    s.overlay.appendChild(v);
    if (!paused) startPlayback(s, v);
  }

  function play(kind: AnimationKind, ctx: PlayContext): Promise<AnimationEndReason> {
    if (current) finish(current, 'cancelled');
    ensureStyles(doc);
    const overlay = doc.createElement('div');
    overlay.className = 'ap-overlay';
    if (paused) overlay.classList.add('ap-paused');
    overlay.dataset.kind = kind;
    host.appendChild(overlay);

    return new Promise<AnimationEndReason>((resolve) => {
      const s: Session = {
        kind,
        ctx: { ...ctx },
        clock: new PausableClock(paused),
        overlay,
        done: false,
        resolve,
        video: null,
        videoStarted: false,
        detachVideo: null,
        sfxOut: null,
      };
      current = s;
      if (videoUnavailable.has(kind)) runFallback(s, 'ended');
      else tryVideo(s);
    });
  }

  return {
    play,
    skip() {
      if (current) finish(current, 'skipped');
    },
    cancel() {
      if (current) finish(current, 'cancelled');
    },
    pause() {
      if (paused) return;
      paused = true;
      if (audio) void audio.suspend().catch(() => {});
      const s = current;
      if (!s) return;
      s.clock.pause();
      s.overlay.classList.add('ap-paused');
      try {
        s.video?.pause();
      } catch {
        /* 무시 */
      }
    },
    resume() {
      if (!paused) return;
      paused = false;
      if (audio) void audio.resume().catch(() => {});
      const s = current;
      if (!s) return;
      s.clock.resume();
      s.overlay.classList.remove('ap-paused');
      if (s.video) startPlayback(s, s.video);
    },
    isPlaying() {
      return current !== null;
    },
    setVolume(v: number) {
      volume = Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : volume;
      if (master) master.gain.value = volume;
      if (current?.video) current.video.volume = volume;
    },
    async unlockAudio() {
      const ac = getAudio();
      if (!ac) return;
      try {
        await ac.resume();
        // 무음 1프레임 재생 — 일부 브라우저는 실제 재생이 있어야 잠금이 풀린다
        const src = ac.createBufferSource();
        src.buffer = ac.createBuffer(1, 1, ac.sampleRate);
        src.connect(ac.destination);
        src.start();
        if (paused) await ac.suspend();
      } catch {
        /* 실패해도 연출은 무음으로 진행 */
      }
    },
  };
}
