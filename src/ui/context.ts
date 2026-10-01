// 담당: dream-f4 — 화면 컴포넌트가 공유하는 타입과 화면 내부 상태(영속 안 함)
import type { GameState } from '../types';
import type { UiActions, UiState } from './ui';

/** 화면 하나 = 루트 요소 + 상태 반영 함수. 같은 화면이 유지되는 동안 update만 반복 호출된다. */
export interface Screen {
  el: HTMLElement;
  update(state: GameState, ui: UiState): void;
}

export interface SetupRowDraft {
  name: string;
  questionSetId: string;
}

/** UI 내부 전용 상태 — 페이지 번호, 하위 화면, 확인 모달 등 (app의 UiState와 별개) */
export interface LocalUi {
  teamsPage: number;
  adminSub: 'main' | 'review';
  reviewSetId: string | null;
  /** 자체 확인 모달 (window.confirm 대신) */
  confirm: { kind: 'reset' } | { kind: 'reveal'; setId: string } | null;
  /** 진행 중인 팀의 세트를 검수 화면에 공개하기로 확인했는가 (관리 화면을 다시 열면 초기화) */
  revealedSetId: string | null;
  /** 보기 클릭 즉시 잠금: 이 runId에서는 다시 선택할 수 없다 */
  lock: { runId: number; choiceId: string } | null;
  setup: { count: number; rows: SetupRowDraft[]; parseError: string | null } | null;
}

export interface Ctx {
  actions: UiActions;
  local: LocalUi;
  /** 내부 상태만 바뀌었을 때 마지막 state로 다시 그린다 */
  rerender(): void;
}

export const TEAMS_PER_PAGE = 8;
export const MAX_TEAMS = 24;
