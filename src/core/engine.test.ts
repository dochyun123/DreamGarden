import { describe, expect, it } from 'vitest';
import sample from '../../data/sample-content.json';
import type { ContentFile, GameState } from '../types';
import {
  availableSetIds, completeAnimation, createInitialState, saveSetup, getCurrentQuestion, lastUndoLabel, registerTeams,
  replaceContent, resetRecords, resumeRun, selectChoice, selectTrack, startChallenge, undo,
} from './engine';

const content = sample as ContentFile;

function setup(teamCount = 3): GameState {
  const drafts = Array.from({ length: teamCount }, (_, i) => ({
    name: `팀${i + 1}`,
  }));
  return registerTeams(createInitialState(content), drafts);
}

/** 도전 시작 + 기차역에서 team-N → set-N 선택. 시작이 거부되면 그대로 반환 */
function begin(state: GameState, teamId: string): GameState {
  const s = startChallenge(state, teamId);
  if (s === state) return s;
  return selectTrack(s, `set-${teamId.split('-')[1]}`);
}

/** 샘플 데이터 규칙: 모든 문제의 정답은 2번 보기 */
function correctId(state: GameState): string {
  return getCurrentQuestion(state)!.correctChoiceId;
}
function wrongId(state: GameState): string {
  const q = getCurrentQuestion(state)!;
  return q.choices.find((c) => c.id !== q.correctChoiceId)!.id;
}

/** 답을 고르고 연출이 끝날 때까지 진행. 지나간 phase 목록을 기록한다. */
function answer(state: GameState, choiceId: string, phases: string[] = []): GameState {
  let s = selectChoice(state, choiceId);
  while (s.progress && s.progress.phase !== 'awaitingAnswer') {
    phases.push(s.progress.phase);
    s = completeAnimation(s, s.progress.runId);
  }
  return s;
}

function deepFreeze<T>(v: T): T {
  if (v && typeof v === 'object') {
    Object.values(v).forEach(deepFreeze);
    Object.freeze(v);
  }
  return v;
}

describe('기본 동작', () => {
  it('샘플 데이터 정답 규칙과 일치한다', () => {
    const q = content.questionSets[0].questions;
    q.forEach((question) => {
      expect(question.correctChoiceId).toBe(question.choices[1].id);
    });
  });

  it('팀 등록: id 순서, 이름 trim, notStarted', () => {
    const s = registerTeams(createInitialState(content), [
      { name: ' 믿음팀 ' },
      { name: '소망팀' },
    ]);
    expect(s.teams).toEqual([
      { id: 'team-1', name: '믿음팀', questionSetId: null, status: 'notStarted' },
      { id: 'team-2', name: '소망팀', questionSetId: null, status: 'notStarted' },
    ]);
  });

  it('도전 시작: 목숨 3, 통과 0, 기차역(말씀 선택) 대기, 팀 inProgress', () => {
    const s = startChallenge(setup(), 'team-1');
    expect(s.progress).toMatchObject({
      activeTeamId: 'team-1', questionIndex: 0, lives: 3, passedCount: 0,
      phase: 'choosingTrack', selectedChoiceId: null,
    });
    expect(s.teams[0]).toMatchObject({ status: 'inProgress', questionSetId: null });
    expect(lastUndoLabel(s)).toBe('팀1 도전 시작');
    expect(getCurrentQuestion(s)).toBeNull();
    expect(completeAnimation(s, s.progress!.runId)).toBe(s);
    expect(selectChoice(s, 's1-q1-c1')).toBe(s);
  });

  it('말씀 선택: 팀에 세트 연결, 첫 문제 대기, runId 증가', () => {
    const s0 = startChallenge(setup(), 'team-1');
    const s = selectTrack(s0, 'set-3');
    expect(s.teams[0].questionSetId).toBe('set-3');
    expect(s.progress).toMatchObject({ phase: 'awaitingAnswer', questionIndex: 0 });
    expect(s.progress!.runId).toBe(s0.progress!.runId + 1);
    expect(getCurrentQuestion(s)!.id).toBe('s3-q1');
    expect(lastUndoLabel(s)).toBe(`팀1 ${content.questionSets[2].scriptureReference} 선택`);
    expect(selectTrack(s, 'set-4')).toBe(s); // 이미 골랐으면 무시
  });

  it('다른 팀이 고른 말씀·없는 말씀은 고를 수 없고, 되돌리면 길이 다시 열린다', () => {
    let s = startChallenge(setup(), 'team-1');
    s = selectTrack(s, 'set-1');
    for (let i = 0; i < 3; i++) s = answer(s, wrongId(s));
    s = startChallenge(s, 'team-2');
    expect(availableSetIds(s)).not.toContain('set-1');
    expect(selectTrack(s, 'set-1')).toBe(s);
    expect(selectTrack(s, 'set-99')).toBe(s);
    s = selectTrack(s, 'set-2');
    expect(availableSetIds(s)).not.toContain('set-2');
    s = undo(s);
    expect(s.progress!.phase).toBe('choosingTrack');
    expect(s.teams[1].questionSetId).toBeNull();
    expect(availableSetIds(s)).toContain('set-2');
    expect(availableSetIds(s)).not.toContain('set-1');
  });

  it('열린 길이 없으면 도전을 시작하지 않는다', () => {
    const one: ContentFile = { ...content, questionSets: content.questionSets.slice(0, 1) };
    let s = registerTeams(createInitialState(one), [{ name: 'a' }, { name: 'b' }]);
    s = selectTrack(startChallenge(s, 'team-1'), 'set-1');
    for (let i = 0; i < 3; i++) s = answer(s, wrongId(s));
    expect(startChallenge(s, 'team-2')).toBe(s);
  });

  it('입력 state를 변경하지 않는다', () => {
    let s = deepFreeze(begin(setup(), 'team-1'));
    s = deepFreeze(selectChoice(s, wrongId(s)));
    s = deepFreeze(completeAnimation(s, s.progress!.runId));
    s = deepFreeze(undo(s));
    s = deepFreeze(resumeRun(s));
    expect(s.progress!.phase).toBe('awaitingAnswer');
  });

  it('진행 중에는 다른 팀 시작·팀 재등록·문제 교체를 거부한다', () => {
    const s = begin(setup(), 'team-1');
    expect(begin(s, 'team-2')).toBe(s);
    expect(registerTeams(s, [{ name: 'x' }])).toBe(s);
    expect(replaceContent(s, content)).toBe(s);
  });

  it('알 수 없는 팀·보기는 무시한다', () => {
    const s0 = setup();
    expect(begin(s0, 'team-99')).toBe(s0);
    const s = begin(s0, 'team-1');
    expect(selectChoice(s, 's2-q1-c1')).toBe(s);
  });

  it('runId가 다른 연출 완료 신호는 무시한다', () => {
    let s = begin(setup(), 'team-1');
    s = selectChoice(s, correctId(s));
    expect(completeAnimation(s, s.progress!.runId - 1)).toBe(s);
    expect(completeAnimation(s, s.progress!.runId + 1)).toBe(s);
  });
});

describe('기획서 8장 검수 기준', () => {
  it('5문제 연속 정답 → 문제마다 자동 진행, 마지막에 heaven, clear 기록 1개', () => {
    let s = begin(setup(), 'team-1');
    const phases: string[] = [];
    for (let i = 0; i < 5; i++) {
      expect(s.progress!.questionIndex).toBe(i);
      s = answer(s, correctId(s), phases);
    }
    expect(phases).toEqual(['correct', 'correct', 'correct', 'correct', 'correct', 'heaven']);
    expect(s.progress).toBeNull();
    expect(s.teams[0].status).toBe('completed');
    expect(s.results).toHaveLength(1);
    expect(s.results[0]).toMatchObject({ teamId: 'team-1', passedCount: 5, outcome: 'clear' });
  });

  it('마지막 정답 판정 시점에 기록·완료 상태를 저장하고 questionIndex는 4를 유지', () => {
    let s = begin(setup(), 'team-1');
    for (let i = 0; i < 4; i++) s = answer(s, correctId(s));
    s = selectChoice(s, correctId(s));
    expect(s.progress).toMatchObject({ phase: 'correct', passedCount: 5, questionIndex: 4 });
    expect(s.results).toHaveLength(1);
    expect(s.teams[0].status).toBe('completed');
    s = completeAnimation(s, s.progress!.runId);
    expect(s.progress).toMatchObject({ phase: 'heaven', questionIndex: 4 });
    expect(s.results).toHaveLength(1);
  });

  it('첫 문제 3회 오답 → 같은 문제, 목숨 3→2→1→0, inferno는 마지막에만, 기록 0', () => {
    let s = begin(setup(), 'team-1');
    const lives: number[] = [s.progress!.lives];
    const allPhases: string[][] = [];
    for (let i = 0; i < 3; i++) {
      expect(getCurrentQuestion(s)!.id).toBe('s1-q1');
      const phases: string[] = [];
      s = selectChoice(s, wrongId(s));
      lives.push(s.progress!.lives);
      s = answer(s, '', phases); // 이미 선택됨: 연출만 진행
      allPhases.push(['wrong', ...phases]);
    }
    expect(lives).toEqual([3, 2, 1, 0]);
    expect(allPhases[0]).not.toContain('inferno');
    expect(allPhases[1]).not.toContain('inferno');
    expect(allPhases[2]).toContain('inferno');
    expect(s.progress).toBeNull();
    expect(s.results).toEqual([expect.objectContaining({ passedCount: 0, outcome: 'failed' })]);
  });

  it('3번째 문제에서 탈락 → 기록 2', () => {
    let s = begin(setup(), 'team-1');
    s = answer(s, correctId(s));
    s = answer(s, correctId(s));
    for (let i = 0; i < 3; i++) s = answer(s, wrongId(s));
    expect(s.results).toEqual([expect.objectContaining({ teamId: 'team-1', passedCount: 2, outcome: 'failed' })]);
    expect(s.teams[0].status).toBe('completed');
  });

  it('같은 오답을 다시 선택하면 목숨을 다시 차감한다', () => {
    let s = begin(setup(), 'team-1');
    const wrong = wrongId(s);
    s = answer(s, wrong);
    expect(s.progress!.lives).toBe(2);
    s = answer(s, wrong);
    expect(s.progress!.lives).toBe(1);
    expect(s.progress!.questionIndex).toBe(0);
  });

  it('빠른 중복 클릭 → 첫 클릭만 판정, 연출 중 입력 무시', () => {
    let s = begin(setup(), 'team-1');
    s = selectChoice(s, wrongId(s));
    expect(selectChoice(s, wrongId(s))).toBe(s);
    expect(selectChoice(s, correctId(s))).toBe(s);
    expect(s.progress!.lives).toBe(2);
    expect(s.undoHistory).toHaveLength(3); // 도전 시작, 말씀 선택, 답 선택
  });

  it('완료된 팀은 다시 도전할 수 없다', () => {
    let s = begin(setup(), 'team-1');
    for (let i = 0; i < 3; i++) s = answer(s, wrongId(s));
    expect(begin(s, 'team-1')).toBe(s);
  });

  it('완료 판정 되돌리기 → 기록 삭제, 팀 inProgress, 이전 목숨·문제·통과 수 복원, 이전 runId 연출 완료 무시', () => {
    let s = begin(setup(), 'team-1');
    s = answer(s, correctId(s));
    s = answer(s, correctId(s));
    s = answer(s, wrongId(s));
    s = answer(s, wrongId(s));
    const before = s.progress!;
    s = selectChoice(s, wrongId(s)); // 마지막 오답
    expect(s.results).toHaveLength(1);
    const staleRunId = s.progress!.runId;

    s = undo(s);
    expect(s.results).toEqual([]);
    expect(s.teams[0].status).toBe('inProgress');
    expect(s.progress).toMatchObject({
      questionIndex: before.questionIndex, lives: 1, passedCount: 2, phase: 'awaitingAnswer',
    });
    expect(s.progress!.runId).toBeGreaterThan(staleRunId);
    expect(completeAnimation(s, staleRunId)).toBe(s);

    // 불구덩이 연출 중 되돌리기도 동일
    let t = selectChoice(s, wrongId(s));
    t = completeAnimation(t, t.progress!.runId);
    expect(t.progress!.phase).toBe('inferno');
    const infernoRun = t.progress!.runId;
    t = undo(t);
    expect(t.results).toEqual([]);
    expect(t.progress!.phase).toBe('awaitingAnswer');
    expect(completeAnimation(t, infernoRun)).toBe(t);
  });

  it('여러 단계 되돌리기 → 도전 시작까지 차례로 복원, 이전 팀의 답까지 계속 되돌린다', () => {
    const history: GameState[] = [];
    let s = setup();
    const act = (next: GameState) => { history.push(s); s = next; };

    act(startChallenge(s, 'team-1'));
    act(selectTrack(s, 'set-1'));
    act(answer(s, correctId(s)));
    act(answer(s, wrongId(s)));
    act(answer(s, correctId(s)));
    for (let i = 0; i < 2; i++) act(answer(s, wrongId(s)));
    expect(s.progress).toBeNull(); // team-1 종료 (기록 2)
    act(startChallenge(s, 'team-2'));
    act(selectTrack(s, 'set-2'));
    act(answer(s, wrongId(s)));

    const strip = (x: GameState) => ({
      teams: x.teams,
      results: x.results,
      progress: x.progress && { ...x.progress, runId: 0 },
    });
    expect(lastUndoLabel(s)).toBe('팀2 1번 문제에 1번 선택');
    while (history.length > 0) {
      const expected = history.pop()!;
      const prevRun = s.progress?.runId ?? 0;
      s = undo(s);
      expect(strip(s)).toEqual(strip(expected));
      if (s.progress) expect(s.progress.runId).toBeGreaterThan(prevRun);
    }
    expect(s.teams.every((t) => t.status === 'notStarted')).toBe(true);
    expect(s.undoHistory).toEqual([]);
    expect(undo(s)).toBe(s);
  });

  it('team-2 시작을 되돌리면 notStarted, 이어서 team-1 마지막 답 직전으로 복원', () => {
    let s = begin(setup(), 'team-1');
    for (let i = 0; i < 3; i++) s = answer(s, wrongId(s));
    s = begin(s, 'team-2');
    s = undo(s); // 말씀 선택 취소
    expect(s.progress!.phase).toBe('choosingTrack');
    s = undo(s); // 도전 시작 취소
    expect(s.teams[1].status).toBe('notStarted');
    expect(s.progress).toBeNull();
    expect(lastUndoLabel(s)).toBe('팀1 1번 문제에 1번 선택');
    s = undo(s);
    expect(s.teams[0].status).toBe('inProgress');
    expect(s.results).toEqual([]);
    expect(s.progress).toMatchObject({ activeTeamId: 'team-1', lives: 1, phase: 'awaitingAnswer' });
  });

  it('연출 중 새로고침 → 저장/로드 후 resumeRun 해도 점수·목숨·기록 중복 없음', () => {
    let s = begin(setup(), 'team-1');
    for (let i = 0; i < 4; i++) s = answer(s, correctId(s));
    s = selectChoice(s, correctId(s)); // 마지막 정답 연출 중
    const oldRun = s.progress!.runId;

    let loaded = resumeRun(JSON.parse(JSON.stringify(s)) as GameState);
    expect(loaded.progress).toMatchObject({ phase: 'correct', passedCount: 5, lives: 3 });
    expect(completeAnimation(loaded, oldRun)).toBe(loaded); // 새로고침 전 콜백 무시
    loaded = completeAnimation(loaded, loaded.progress!.runId);
    expect(loaded.progress!.phase).toBe('heaven');

    // heaven 연출 중 또 새로고침
    loaded = resumeRun(JSON.parse(JSON.stringify(loaded)) as GameState);
    loaded = completeAnimation(loaded, loaded.progress!.runId);
    expect(loaded.progress).toBeNull();
    expect(loaded.results).toHaveLength(1);
    expect(loaded.results[0]).toMatchObject({ passedCount: 5, outcome: 'clear' });

    // 오답 연출 중 새로고침
    let w = begin(loaded, 'team-2');
    w = selectChoice(w, wrongId(w));
    w = resumeRun(JSON.parse(JSON.stringify(w)) as GameState);
    w = completeAnimation(w, w.progress!.runId);
    expect(w.progress).toMatchObject({ lives: 2, phase: 'awaitingAnswer' });
  });

  it('전체 기록 초기화 → 팀명 유지, 고른 말씀 해제, 진행·결과·Undo 제거', () => {
    let s = begin(setup(), 'team-1');
    for (let i = 0; i < 3; i++) s = answer(s, wrongId(s));
    s = begin(s, 'team-2');
    s = answer(s, correctId(s));
    const r = resetRecords(s);
    expect(r.progress).toBeNull();
    expect(r.results).toEqual([]);
    expect(r.undoHistory).toEqual([]);
    expect(r.teams).toEqual(s.teams.map((t) => ({ ...t, status: 'notStarted', questionSetId: null })));
    expect(r.questionSets).toEqual(s.questionSets);
    // 초기화 후 팀 재구성 가능
    expect(registerTeams(r, [{ name: '새팀' }]).teams).toHaveLength(1);
  });
});

describe('관리 화면 저장', () => {
  it('기록 초기화 + 말씀 출처·구절 교체(문제 유지) + 팀 재등록', () => {
    let s = begin(setup(), 'team-1');
    for (let i = 0; i < 3; i++) s = answer(s, wrongId(s));
    s = begin(s, 'team-2');
    const scriptures = s.questionSets.map((_, i) => ({ scriptureReference: ` 출처${i + 1} `, scriptureText: `구절${i + 1}` }));
    const r = saveSetup(s, { teamNames: ['가', '나'], scriptures });
    expect(r.progress).toBeNull();
    expect(r.results).toEqual([]);
    expect(r.undoHistory).toEqual([]);
    expect(r.teams).toEqual([
      { id: 'team-1', name: '가', questionSetId: null, status: 'notStarted' },
      { id: 'team-2', name: '나', questionSetId: null, status: 'notStarted' },
    ]);
    expect(r.questionSets[0]).toMatchObject({ scriptureReference: '출처1', scriptureText: '구절1' });
    expect(r.questionSets[0].questions).toEqual(s.questionSets[0].questions);
  });
});
