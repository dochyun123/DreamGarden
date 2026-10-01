// 담당: dream-f4 — 시작, 초기 설정, 팀 선택, 문제, 리더보드, 관리 화면.
// UI는 상태를 직접 바꾸지 않는다. render()로 받은 상태를 그리고, 사용자 행동은 actions 호출로만 전달한다.
import type { GameState, ValidationIssue } from '../types';
import type { TeamDraft } from '../core/engine';

export type View = 'setup' | 'teams' | 'question' | 'leaderboard' | 'admin';

/** 영속되지 않는 화면 상태 (app이 소유) */
export interface UiState {
  /** 시작(전체화면+오디오) 버튼을 눌렀는가. false면 시작 화면만 표시 */
  started: boolean;
  /** 저장된 진행이 있어 '이어하기'로 시작해야 하는가 */
  hasSavedGame: boolean;
  view: View;
  /** 문제 화면 왼쪽 아래 관리 아이콘으로 연 메뉴. 열려 있으면 입력·연출 일시정지 */
  adminMenuOpen: boolean;
  volume: number; // 0~1
  /** 저장 실패 등 관리자 알림 */
  notice: string | null;
  /** 최근 검증 오류 (문제 가져오기·팀 등록) */
  issues: ValidationIssue[];
  /** 연출 재생 오류로 대체 자막 중 → 관리자에게 '연출 건너뛰기' 노출 */
  animationStuck: boolean;
  isFullscreen: boolean;
}

export interface UiActions {
  start(): void; // 클릭 핸들러 안에서 호출됨 → 전체화면+오디오
  setView(view: Exclude<View, 'question'>): void;
  returnToChallenge(): void; // 진행 중 도전 화면으로
  importContent(json: unknown): void;
  registerTeams(drafts: TeamDraft[]): void;
  startChallenge(teamId: string): void;
  selectChoice(choiceId: string): void;
  openAdminMenu(): void;
  closeAdminMenu(): void;
  undo(): void;
  skipAnimation(): void;
  setVolume(volume: number): void;
  enterFullscreen(): void;
  resetRecords(): void; // UI가 확인 다이얼로그를 먼저 띄운 뒤 호출 (window.confirm 금지, 자체 모달)
}

export interface UiHandle {
  render(state: GameState, ui: UiState): void;
  /** 연출 오버레이가 붙을 요소 (16:9 스테이지 내부) */
  animationHost: HTMLElement;
}

export function mountUi(root: HTMLElement, actions: UiActions): UiHandle {
  void root; void actions;
  throw new Error('TODO(dream-f4)');
}
