// 담당: dream-2a — 화면 컴포넌트가 공유하는 타입과 화면 내부 상태(영속 안 함)
import type { GameState } from '../types';
import type { ScriptureDraft } from '../core/engine';
import type { UiActions, UiState } from './ui';

/** 화면 하나 = 루트 요소 + 상태 반영 함수. 같은 화면이 유지되는 동안 update만 반복 호출된다. */
export interface Screen {
  el: HTMLElement;
  update(state: GameState, ui: UiState): void;
}

/** 관리 화면 입력 중인 값 (저장 전까지 UI만 가진다) */
export interface SetupForm {
  teamNames: string[]; // 길이 = 팀 수
  scriptures: ScriptureDraft[]; // 갈림길 순서. 추가·삭제 가능 (최대 TRACK_COUNT)
}

/** UI 내부 전용 상태 (app의 UiState와 별개) */
export interface LocalUi {
  /** 자체 확인 모달 (window.confirm 대신): 관리 화면 저장 → 기록 초기화 확인 */
  confirm: { kind: 'save'; onOk: () => void } | null;
  /** 보기 클릭 즉시 잠금: 이 runId에서는 다시 선택할 수 없다 */
  lock: { runId: number; choiceId: string } | null;
  /** 관리 화면 입력값. 관리 화면에 들어올 때 state로 다시 채운다 */
  setup: SetupForm | null;
  /** home에서 '게임 시작'을 눌러 팀 목록을 펼쳤는가 */
  pickingTeam: boolean;
}

export interface Ctx {
  actions: UiActions;
  local: LocalUi;
  /** 내부 상태만 바뀌었을 때 마지막 state로 다시 그린다 */
  rerender(): void;
}
