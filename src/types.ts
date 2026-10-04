// 공용 타입 — 모든 모듈의 계약. 변경은 리드(dream-3c)와 합의 후에만.

export const SCHEMA_VERSION = 2;
/** 기차역 갈림길 = 문제 세트 수 (말씀 10개) */
export const TRACK_COUNT = 10;
export const QUESTIONS_PER_SET = 5;
export const CHOICES_PER_QUESTION = 5;
export const STARTING_LIVES = 3;

// ───────── 문제 데이터 (사용자가 JSON으로 제공) ─────────

export interface Choice {
  id: string;
  text: string; // 배열 순서가 화면 1~5번
}

export interface Question {
  id: string;
  /** 빈칸은 "___"(밑줄 3개 이상)로 표기. UI가 노란색+밑줄로 강조한다. */
  prompt: string;
  choices: Choice[]; // 길이 5
  correctChoiceId: string;
}

export interface QuestionSet {
  id: string;
  scriptureReference: string; // 예: "요한복음 3:16"
  scriptureText: string; // 관리자 검수용으로만 표시
  questions: Question[]; // 길이 5, 고정 순서
}

/** 가져오기용 JSON 파일 형식 */
export interface ContentFile {
  contentVersion: string;
  questionSets: QuestionSet[];
}

// ───────── 팀 / 진행 / 기록 ─────────

export type TeamStatus = 'notStarted' | 'inProgress' | 'completed';
export type Outcome = 'clear' | 'failed';

export interface Team {
  id: string;
  name: string;
  /** 기차역에서 고른 말씀(세트). 고르기 전에는 null. 다른 팀이 고른 세트는 선택 불가 */
  questionSetId: string | null;
  status: TeamStatus;
}

/**
 * 진행 단계.
 * - choosingTrack: 기차역 갈림길에서 말씀 선택 (도전 시작 직후. 연출 없음)
 * - awaitingAnswer: 문제 대기 (보기 입력 가능한 유일한 단계)
 * - correct: 정답 연출 (끝나면 passedCount<5 → 다음 문제, =5 → heaven)
 * - wrong: 오답 자막 + 하트 소멸 연출 (끝나면 lives>0 → 같은 문제, =0 → inferno)
 * - heaven / inferno: 종료 연출 (끝나면 progress=null, 팀 선택 복귀)
 */
export type Phase = 'choosingTrack' | 'awaitingAnswer' | 'correct' | 'wrong' | 'heaven' | 'inferno';

export interface Progress {
  activeTeamId: string;
  /** 0~4. 현재 화면에 표시할 문제. 정답 연출이 끝날 때 증가한다. 완료 시 4 유지. */
  questionIndex: number;
  lives: number; // 0~3
  passedCount: number; // 0~5
  phase: Phase;
  selectedChoiceId: string | null;
  /**
   * 진행 식별자. 연출 시작·Undo·복구마다 증가.
   * 연출 완료 신호는 runId가 일치할 때만 반영한다 (취소된 연출 무시).
   */
  runId: number;
}

export interface Result {
  teamId: string;
  passedCount: number; // 0~5
  outcome: Outcome;
  completedAt: string; // ISO
}

/** Undo 대상이 되는 게임 상태 부분 */
export interface GameSnapshot {
  teams: Team[];
  progress: Progress | null;
  results: Result[];
}

export interface UndoEntry {
  /** 관리 메뉴에 표시할 요약. 예: "믿음팀 도전 시작", "믿음팀 2번 문제에 3번 선택" */
  label: string;
  snapshot: GameSnapshot;
}

/** 저장 묶음 = 전체 영속 상태 (localStorage에 그대로 저장) */
export interface GameState {
  schemaVersion: number;
  contentVersion: string;
  questionSets: QuestionSet[];
  teams: Team[];
  progress: Progress | null;
  results: Result[];
  undoHistory: UndoEntry[];
}

// ───────── 리더보드 ─────────

export interface LeaderboardRow {
  rank: number; // 공동 순위, 다음 점수는 +1 (5,5,3,0 → 1,1,2,3)
  teamId: string;
  teamName: string;
  passedCount: number;
  cleared: boolean;
}

// ───────── 검증 ─────────

export interface ValidationIssue {
  /** 오류 위치. 예: "세트 set-1 > 문제 2 > 보기 4", "팀 믿음팀" */
  location: string;
  message: string;
}

// ───────── 연출 ─────────

/** intro: 꿈 인트로 (행사 첫 시작 때만, 엔진 phase와 무관하게 app이 재생) */
export type AnimationKind = 'intro' | 'correct' | 'wrong' | 'heaven' | 'inferno';

export type AnimationEndReason = 'ended' | 'skipped' | 'error' | 'cancelled';
