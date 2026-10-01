// 담당: dream-20 — 정오 판정, 목숨·통과 수, 상태 전이, Undo 스냅샷.
// 모든 함수는 순수 함수: 입력 state를 변경하지 않고 새 state를 반환한다.
// 허용되지 않는 동작(잘못된 phase, 완료 팀 선택 등)은 state를 그대로 반환한다(throw 금지).
import type {
  AnimationKind, ContentFile, GameState, Phase, Question,
} from '../types';

export interface TeamDraft {
  name: string;
  questionSetId: string;
}

/** 빈 게임 상태. 팀 없음. */
export function createInitialState(content: ContentFile): GameState {
  void content;
  throw new Error('TODO(dream-20)');
}

/** 문제 데이터 교체. progress가 있거나 results가 있으면 거부(그대로 반환). 팀의 questionSetId는 유지. */
export function replaceContent(state: GameState, content: ContentFile): GameState {
  void content;
  return state;
}

/** 팀 등록/재구성. progress·results가 비어 있을 때만 허용. id는 "team-1".. 순서대로. Undo 이력 초기화. */
export function registerTeams(state: GameState, drafts: TeamDraft[]): GameState {
  void drafts;
  return state;
}

/** 미도전 팀 도전 시작. 다른 팀이 진행 중이면 거부. 시작 전 스냅샷을 undo에 쌓는다. lives=3, passed=0, phase=awaitingAnswer, runId+1 */
export function startChallenge(state: GameState, teamId: string): GameState {
  void teamId;
  return state;
}

/**
 * 보기 선택. phase가 awaitingAnswer일 때만 동작.
 * 선택 전 스냅샷 push → 판정 → passedCount 또는 lives를 한 번만 갱신 → phase=correct|wrong, runId+1.
 * 마지막 판정(5번째 정답 또는 목숨 0)이면 team.status=completed, results에 기록 추가까지 이 시점에 한다.
 */
export function selectChoice(state: GameState, choiceId: string): GameState {
  void choiceId;
  return state;
}

/**
 * 연출 완료 신호. runId가 progress.runId와 다르면 무시.
 * 점수는 다시 계산하지 않고 화면 단계만 이동한다:
 * correct → (passed<5) questionIndex+1, awaitingAnswer / (passed=5) heaven
 * wrong → (lives>0) awaitingAnswer / (lives=0) inferno
 * heaven|inferno → progress=null
 * 단계가 바뀔 때 runId+1.
 */
export function completeAnimation(state: GameState, runId: number): GameState {
  void runId;
  return state;
}

/** 새로고침 후 이어하기: runId만 +1 (현재 phase의 연출을 처음부터 다시 재생하도록). */
export function resumeRun(state: GameState): GameState {
  return state;
}

/** 직전 행동 되돌리기. 스냅샷 복원 + runId는 (기존 runId+1)로 설정해 진행 중 연출 신호를 무효화. 복원된 phase가 연출 단계면 awaitingAnswer 직전 상태가 스냅샷이므로 그대로 사용. */
export function undo(state: GameState): GameState {
  return state;
}

/** 관리 메뉴용 "마지막 행동 요약". 없으면 null. */
export function lastUndoLabel(state: GameState): string | null {
  void state;
  return null;
}

/** 전체 기록 초기화: progress·results·undo 제거, 모든 팀 notStarted. 팀명·문제 연결 유지. */
export function resetRecords(state: GameState): GameState {
  return state;
}

/** 현재 화면에 보여줄 문제. progress 없으면 null. */
export function getCurrentQuestion(state: GameState): Question | null {
  void state;
  return null;
}

/** phase에 해당하는 연출. awaitingAnswer면 null. */
export function animationForPhase(phase: Phase): AnimationKind | null {
  return phase === 'awaitingAnswer' ? null : phase;
}
