// 담당: 9d10c602 — 정답·오답(+하트 소멸)·천국·불구덩이 연출, 완료 신호, 취소, 오류 대체.
import type { AnimationEndReason, AnimationKind } from '../types';

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

export function createAnimationPlayer(host: HTMLElement, mediaBase = './media/'): AnimationPlayer {
  void host; void mediaBase;
  throw new Error('TODO(9d10c602)');
}
