// 담당: dream-20 — 정오 판정, 목숨·통과 수, 상태 전이, Undo 스냅샷.
// 모든 함수는 순수 함수: 입력 state를 변경하지 않고 새 state를 반환한다.
// 허용되지 않는 동작(잘못된 phase, 완료 팀 선택 등)은 state를 그대로 반환한다(throw 금지).
import {
  CHOICES_PER_QUESTION, QUESTIONS_PER_SET, SCHEMA_VERSION, STARTING_LIVES,
} from '../types';
import type {
  AnimationKind, ContentFile, GameSnapshot, GameState, Phase, Question, QuestionSet, Team,
} from '../types';

/** 연습게임 문제 (요한복음 3:16) — 팀 선택 화면의 '연습게임'. 기록에 남지 않는다 */
export const PRACTICE_NAME = '연습게임';
export const PRACTICE_SET: QuestionSet = {
  id: 'practice',
  scriptureReference: '요한복음 3:16',
  scriptureText: '하나님이 세상을 이처럼 사랑하사 독생자를 주셨으니 이는 그를 믿는 자마다 멸망하지 않고 영생을 얻게 하려 하심이라',
  questions: [
    {
      id: 'p-q1',
      prompt: '하나님이 세상을 이처럼 사랑하사 ___를 주셨으니 이는 그를 믿는 자마다 멸망하지 않고 ___을 얻게 하려 하심이라',
      choices: [['율법'], ['독생자'], ['성령'], ['선지자'], ['천사']].map(([text], i) => ({ id: `p-q1-c${i + 1}`, text })),
      correctChoiceId: 'p-q1-c2',
    },
    {
      id: 'p-q2',
      prompt: '하나님이 세상을 이처럼 사랑하사 독생자를 주셨으니 이는 그를 믿는 자마다 멸망하지 않고 ___을 얻게 하려 하심이라',
      choices: [['평안'], ['축복'], ['지혜'], ['영생'], ['은혜']].map(([text], i) => ({ id: `p-q2-c${i + 1}`, text })),
      correctChoiceId: 'p-q2-c4',
    },
  ],
};

export interface TeamDraft {
  name: string;
}

/** 빈 게임 상태. 팀 없음. */
export function createInitialState(content: ContentFile): GameState {
  return {
    schemaVersion: SCHEMA_VERSION,
    contentVersion: content.contentVersion,
    questionSets: clone(content.questionSets),
    teams: [],
    progress: null,
    results: [],
    undoHistory: [],
  };
}

/** 문제 데이터 교체. progress가 있거나 results가 있으면 거부(그대로 반환). 팀이 고른 말씀(questionSetId)은 기록이 없으므로 모두 비어 있다. */
export function replaceContent(state: GameState, content: ContentFile): GameState {
  if (state.progress || state.results.length > 0) return state;
  return {
    ...state,
    contentVersion: content.contentVersion,
    questionSets: clone(content.questionSets),
    undoHistory: [],
  };
}

/** 팀 등록/재구성. progress·results가 비어 있을 때만 허용. id는 "team-1".. 순서대로. Undo 이력 초기화. */
export function registerTeams(state: GameState, drafts: TeamDraft[]): GameState {
  if (state.progress || state.results.length > 0) return state;
  const teams: Team[] = drafts.map((d, i) => ({
    id: `team-${i + 1}`,
    name: d.name.trim(),
    questionSetId: null,
    status: 'notStarted',
  }));
  return { ...state, teams, undoHistory: [] };
}

/** 관리 화면의 문제 하나: 문장(빈칸 "___"), 보기 5개, 정답 번호(1~5, 0 = 아직 안 고름) */
export interface QuestionDraft {
  prompt: string;
  choices: string[];
  answer: number;
}

export interface ScriptureDraft {
  scriptureReference: string;
  scriptureText: string;
  questions: QuestionDraft[];
}

/** 관리 화면 저장 내용: 팀 이름들 + 갈림길 순서대로 말씀(출처·구절·문제) */
export interface SetupDraft {
  teamNames: string[];
  scriptures: ScriptureDraft[];
}

/** 빈칸 표기 통일: 밑줄·대시 2개 이상("__", "———")을 "___"로 */
export function normalizePrompt(prompt: string): string {
  return prompt.trim().replace(/[_—–]{2,}/g, '___');
}

export function scriptureDraftOf(set: QuestionSet): ScriptureDraft {
  return {
    scriptureReference: set.scriptureReference,
    scriptureText: set.scriptureText,
    questions: set.questions.map((q) => ({
      prompt: q.prompt,
      choices: q.choices.map((c) => c.text),
      answer: q.choices.findIndex((c) => c.id === q.correctChoiceId) + 1,
    })),
  };
}

export function emptyScriptureDraft(): ScriptureDraft {
  return {
    scriptureReference: '',
    scriptureText: '',
    questions: Array.from({ length: QUESTIONS_PER_SET }, () => ({
      prompt: '', choices: Array.from({ length: CHOICES_PER_QUESTION }, () => ''), answer: 0,
    })),
  };
}

/**
 * 관리 화면 저장. 기록을 먼저 초기화(진행·결과·Undo 제거)한 뒤
 * 말씀 목록을 draft로 통째로 바꾸고(id는 순서대로 다시 매김) 팀을 다시 등록한다. 검증은 validateSetup이 먼저 한다.
 */
export function saveSetup(state: GameState, draft: SetupDraft): GameState {
  const questionSets: QuestionSet[] = draft.scriptures.map((d, si) => ({
    id: `set-${si + 1}`,
    scriptureReference: d.scriptureReference.trim(),
    scriptureText: d.scriptureText.trim(),
    questions: d.questions.map((q, qi) => {
      const qid = `s${si + 1}-q${qi + 1}`;
      return {
        id: qid,
        prompt: normalizePrompt(q.prompt),
        choices: q.choices.map((text, ci) => ({ id: `${qid}-c${ci + 1}`, text: text.trim() })),
        correctChoiceId: `${qid}-c${q.answer}`,
      };
    }),
  }));
  return registerTeams({ ...resetRecords(state), questionSets }, draft.teamNames.map((name) => ({ name })));
}

/** 미도전 팀 도전 시작. 다른 팀이 진행 중이면 거부. 시작 전 스냅샷을 undo에 쌓는다. lives=3, passed=0, phase=choosingTrack(기차역), runId+1 */
export function startChallenge(state: GameState, teamId: string): GameState {
  if (state.progress) return state;
  const team = state.teams.find((t) => t.id === teamId);
  if (!team || team.status !== 'notStarted') return state;
  if (availableSetIds(state).length === 0) return state;

  return {
    ...pushUndo(state, `${team.name} 도전 시작`),
    teams: state.teams.map((t) => (t.id === teamId ? { ...t, status: 'inProgress', questionSetId: null } : t)),
    progress: {
      activeTeamId: teamId,
      questionIndex: 0,
      lives: STARTING_LIVES,
      passedCount: 0,
      phase: 'choosingTrack',
      selectedChoiceId: null,
      runId: maxKnownRunId(state) + 1,
    },
  };
}

/** 연습게임 시작: 기차역 없이 바로 문제. 진행 중인 도전이 있으면 거부. */
export function startPractice(state: GameState): GameState {
  if (state.progress) return state;
  return {
    ...pushUndo(state, `${PRACTICE_NAME} 시작`),
    progress: {
      activeTeamId: '',
      practice: true,
      questionIndex: 0,
      lives: STARTING_LIVES,
      passedCount: 0,
      phase: 'awaitingAnswer',
      selectedChoiceId: null,
      runId: maxKnownRunId(state) + 1,
    },
  };
}

/** 현재 도전의 말씀 세트 (연습게임이면 PRACTICE_SET) */
export function activeSet(state: GameState): QuestionSet | undefined {
  const p = state.progress;
  if (!p) return undefined;
  if (p.practice) return PRACTICE_SET;
  const team = state.teams.find((t) => t.id === p.activeTeamId);
  return team?.questionSetId ? state.questionSets.find((s) => s.id === team.questionSetId) : undefined;
}

/** 현재 도전 이름 (팀 이름 또는 '연습게임') */
export function activeName(state: GameState): string {
  const p = state.progress;
  if (!p) return '';
  return p.practice ? PRACTICE_NAME : state.teams.find((t) => t.id === p.activeTeamId)?.name ?? '';
}

/** 현재 도전의 문제 수 (연습게임 2, 평소 4) */
export function activeQuestionCount(state: GameState): number {
  return state.progress?.practice ? PRACTICE_SET.questions.length : QUESTIONS_PER_SET;
}

/** 기차역에서 말씀(세트) 선택. phase가 choosingTrack이고 다른 팀이 고르지 않은 세트일 때만. 선택 전 스냅샷 push → phase=awaitingAnswer, runId+1 */
export function selectTrack(state: GameState, questionSetId: string): GameState {
  const progress = state.progress;
  if (!progress || progress.phase !== 'choosingTrack') return state;
  if (!availableSetIds(state).includes(questionSetId)) return state;
  const team = state.teams.find((t) => t.id === progress.activeTeamId);
  const set = state.questionSets.find((s) => s.id === questionSetId);
  if (!team || !set) return state;

  return {
    ...pushUndo(state, `${team.name} ${set.scriptureReference} 선택`),
    teams: state.teams.map((t) => (t.id === team.id ? { ...t, questionSetId } : t)),
    progress: { ...progress, phase: 'awaitingAnswer', runId: progress.runId + 1 },
  };
}

/** 아직 어떤 팀도 고르지 않았고, 패자부활전에서 풀지도 않았고, 문제가 4개인 세트 id (기차역에서 열린 길) */
export function availableSetIds(state: GameState): string[] {
  const taken = new Set(state.teams.map((t) => t.questionSetId).filter((id): id is string => id !== null));
  for (const id of state.revivalDoneSetIds ?? []) taken.add(id);
  return state.questionSets
    .filter((s) => !taken.has(s.id) && s.questions.length === QUESTIONS_PER_SET)
    .map((s) => s.id);
}

/**
 * 보기 선택. phase가 awaitingAnswer일 때만 동작.
 * 선택 전 스냅샷 push → 판정 → passedCount 또는 lives를 한 번만 갱신 → phase=correct|wrong, runId+1.
 * 마지막 판정(5번째 정답 또는 목숨 0)이면 team.status=completed, results에 기록 추가까지 이 시점에 한다.
 */
export function selectChoice(state: GameState, choiceId: string): GameState {
  const progress = state.progress;
  if (!progress || progress.phase !== 'awaitingAnswer') return state;
  const question = getCurrentQuestion(state);
  if (!question) return state;
  const choiceIndex = question.choices.findIndex((c) => c.id === choiceId);
  if (choiceIndex < 0) return state;

  const label = `${activeName(state)} ${progress.questionIndex + 1}번 문제에 ${choiceIndex + 1}번 선택`;
  return judge(state, choiceId === question.correctChoiceId, choiceId, label);
}

/**
 * 시간 초과 — 오답과 똑같이 처리한다 (selectedChoiceId=null).
 * runId가 현재 문제 대기 단계와 다르면(늦게 도착한 타이머) 무시.
 */
export function timeOut(state: GameState, runId: number): GameState {
  const progress = state.progress;
  if (!progress || progress.phase !== 'awaitingAnswer' || progress.runId !== runId) return state;
  if (!getCurrentQuestion(state)) return state;
  return judge(state, false, null, `${activeName(state)} ${progress.questionIndex + 1}번 문제 시간 초과`);
}

function judge(state: GameState, isCorrect: boolean, choiceId: string | null, label: string): GameState {
  const progress = state.progress!;
  const passedCount = isCorrect ? progress.passedCount + 1 : progress.passedCount;
  const lives = isCorrect ? progress.lives : Math.max(0, progress.lives - 1);
  const finished = isCorrect ? passedCount >= activeQuestionCount(state) : lives === 0;

  const next: GameState = {
    ...pushUndo(state, label),
    progress: {
      ...progress,
      passedCount,
      lives,
      phase: isCorrect ? 'correct' : 'wrong',
      selectedChoiceId: choiceId,
      runId: progress.runId + 1,
    },
  };
  if (!finished || progress.practice) return next; // 연습게임은 기록에 남기지 않는다
  const team = state.teams.find((t) => t.id === progress.activeTeamId)!;

  return {
    ...next,
    teams: state.teams.map((t) => (t.id === team.id ? { ...t, status: 'completed' } : t)),
    results: [
      ...state.results,
      {
        teamId: team.id,
        passedCount,
        outcome: isCorrect ? 'clear' : 'failed',
        completedAt: new Date().toISOString(),
      },
    ],
  };
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
  const progress = state.progress;
  if (!progress || progress.runId !== runId) return state;

  const moveTo = (phase: Phase, questionIndex = progress.questionIndex): GameState => ({
    ...state,
    progress: {
      ...progress,
      phase,
      questionIndex,
      selectedChoiceId: phase === 'awaitingAnswer' ? null : progress.selectedChoiceId,
      runId: progress.runId + 1,
    },
  });

  switch (progress.phase) {
    case 'choosingTrack':
    case 'awaitingAnswer':
      return state;
    case 'correct': {
      const total = activeQuestionCount(state);
      if (progress.passedCount >= total && progress.practice) return endPractice(state); // 연습게임은 천국 없이 처음으로
      return progress.passedCount >= total
        ? moveTo('heaven')
        : moveTo('awaitingAnswer', Math.min(progress.questionIndex + 1, total - 1));
    }
    case 'wrong':
      if (progress.lives > 0) return moveTo('awaitingAnswer');
      return progress.practice ? endPractice(state) : moveTo('inferno'); // 연습게임은 불구덩이 없이 처음으로
    case 'heaven':
    case 'inferno':
      return progress.practice ? endPractice(state) : { ...state, progress: null };
  }
}

/** 새로고침 후 이어하기: runId만 +1 (현재 phase의 연출을 처음부터 다시 재생하도록). */
export function resumeRun(state: GameState): GameState {
  if (!state.progress) return state;
  return { ...state, progress: { ...state.progress, runId: state.progress.runId + 1 } };
}

/** 직전 행동 되돌리기. 스냅샷 복원 + runId는 (기존 runId+1)로 설정해 진행 중 연출 신호를 무효화. 복원된 phase가 연출 단계면 awaitingAnswer 직전 상태가 스냅샷이므로 그대로 사용. */
export function undo(state: GameState): GameState {
  const entry = state.undoHistory[state.undoHistory.length - 1];
  if (!entry) return state;
  const { teams, progress, results } = clone(entry.snapshot);
  return {
    ...state,
    teams,
    // 진행이 끝나 progress가 null이어도 runId가 과거 값으로 되돌아가지 않도록 알려진 최대값보다 크게 한다.
    progress: progress ? { ...progress, runId: maxKnownRunId(state) + 1 } : null,
    results,
    undoHistory: state.undoHistory.slice(0, -1),
  };
}

/** 관리 메뉴용 "마지막 행동 요약". 없으면 null. */
export function lastUndoLabel(state: GameState): string | null {
  return state.undoHistory[state.undoHistory.length - 1]?.label ?? null;
}

/** 전체 기록 초기화: progress·results·undo 제거, 모든 팀 notStarted, 고른 말씀 해제. 팀명은 유지. */
export function resetRecords(state: GameState): GameState {
  return {
    ...state,
    teams: state.teams.map((t) => ({ ...t, status: 'notStarted', questionSetId: null })),
    progress: null,
    results: [],
    undoHistory: [],
    revivalDoneSetIds: [],
  };
}

/** 패자부활전에서 풀 수 있는 말씀: 진행 중인 도전이 없을 때 언제든, 어떤 팀도 고르지 않았고 패자부활전에서도 아직 안 푼 세트 */
export function revivalSetIds(state: GameState): string[] {
  if (state.progress) return [];
  return availableSetIds(state);
}

/** 패자부활전에서 말씀 하나를 끝까지 풀었다 → 다시 고를 수 없게 표시 */
export function finishRevival(state: GameState, setId: string): GameState {
  if (!revivalSetIds(state).includes(setId)) return state;
  return { ...state, revivalDoneSetIds: [...(state.revivalDoneSetIds ?? []), setId] };
}

/** 현재 화면에 보여줄 문제. progress 없으면 null. */
export function getCurrentQuestion(state: GameState): Question | null {
  const progress = state.progress;
  if (!progress) return null;
  return activeSet(state)?.questions[progress.questionIndex] ?? null;
}

/** phase에 해당하는 연출. awaitingAnswer·choosingTrack이면 null. */
export function animationForPhase(phase: Phase): AnimationKind | null {
  return phase === 'awaitingAnswer' || phase === 'choosingTrack' ? null : phase;
}

// ───────── 내부 도우미 ─────────

/** 연습게임 끝 → 처음 화면. 연습 중 쌓인 되돌리기 이력도 지운다 (실제 기록과 섞이지 않게) */
function endPractice(state: GameState): GameState {
  return { ...state, progress: null, undoHistory: state.undoHistory.filter((u) => !u.label.startsWith(PRACTICE_NAME)) };
}

function pushUndo(state: GameState, label: string): GameState {
  const snapshot: GameSnapshot = clone({
    teams: state.teams,
    progress: state.progress,
    results: state.results,
  });
  return { ...state, undoHistory: [...state.undoHistory, { label, snapshot }] };
}

/** 현재 진행과 Undo 이력에 남은 runId 중 최대값. progress가 null이 된 뒤에도 runId를 단조 증가시키기 위해 쓴다. */
function maxKnownRunId(state: GameState): number {
  let max = state.progress?.runId ?? 0;
  for (const entry of state.undoHistory) {
    const runId = entry.snapshot.progress?.runId;
    if (runId !== undefined && runId > max) max = runId;
  }
  return max;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
