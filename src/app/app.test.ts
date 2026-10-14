import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AnimationEndReason, AnimationKind, GameState } from '../types';
import type { UiActions, UiState } from '../ui/ui';
import type { PlayContext } from '../animation/player';

// ───────── 가짜 UI · 연출 ─────────

interface PlayCall {
  kind: AnimationKind;
  ctx: PlayContext;
  resolve: (reason: AnimationEndReason) => void;
}

const fake = vi.hoisted(() => ({
  actions: null as UiActions | null,
  renders: [] as Array<{ state: GameState; ui: UiState }>,
  plays: [] as PlayCall[],
  current: null as PlayCall | null,
  player: {
    play: vi.fn(),
    skip: vi.fn(),
    cancel: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    isPlaying: vi.fn(),
    setVolume: vi.fn(),
    unlockAudio: vi.fn(),
  },
}));

vi.mock('../ui/ui', () => ({
  mountUi: (_root: HTMLElement, actions: UiActions) => {
    fake.actions = actions;
    return {
      render: (state: GameState, ui: UiState) => fake.renders.push({ state, ui: { ...ui } }),
      animationHost: document.createElement('div'),
    };
  },
}));

vi.mock('../animation/player', () => ({
  createAnimationPlayer: () => fake.player,
}));

import { bootstrap } from './app';
import { scriptureDraftOf } from '../core/engine';

function installPlayer(): void {
  const p = fake.player;
  Object.values(p).forEach((f) => f.mockReset());
  p.play.mockImplementation((kind: AnimationKind, ctx: PlayContext) => {
    if (fake.current) p.cancel(); // 실제 player 계약: 이전 재생이 남아 있으면 먼저 cancel
    return new Promise<AnimationEndReason>((resolve) => {
      const call: PlayCall = {
        kind,
        ctx,
        resolve: (reason) => {
          if (fake.current === call) fake.current = null;
          resolve(reason);
        },
      };
      fake.plays.push(call);
      fake.current = call;
    });
  });
  p.cancel.mockImplementation(() => fake.current?.resolve('cancelled'));
  p.isPlaying.mockImplementation(() => fake.current !== null);
  p.unlockAudio.mockResolvedValue(undefined);
}

// ───────── 도우미 ─────────

const flush = () => new Promise((r) => setTimeout(r, 0));
const actions = () => fake.actions!;
const last = () => fake.renders[fake.renders.length - 1];
const state = () => last().state;
const ui = () => last().ui;
const lastPlay = () => fake.plays[fake.plays.length - 1];

function question() {
  const s = state();
  const team = s.teams.find((t) => t.id === s.progress!.activeTeamId)!;
  return s.questionSets.find((q) => q.id === team.questionSetId)!.questions[s.progress!.questionIndex];
}
const correctId = () => question().correctChoiceId;
const wrongId = () => question().choices.find((c) => c.id !== question().correctChoiceId)!.id;

/** 현재 재생 중인 연출을 끝내고 다음 상태까지 반영 */
async function finish(reason: AnimationEndReason = 'ended'): Promise<void> {
  fake.current!.resolve(reason);
  await flush();
}

function boot(): void {
  fake.actions = null;
  fake.renders = [];
  fake.plays = [];
  fake.current = null;
  installPlayer();
  bootstrap(document.createElement('div'));
}

/** 관리 화면 저장: 팀 이름 + 지금 말씀 그대로 */
function setupTeams(names: string[]): void {
  actions().saveSetup({
    teamNames: names,
    scriptures: state().questionSets.map(scriptureDraftOf),
  });
}

/** 팀 2개 등록 → 시작 버튼 → team-1 도전 시작 → 꿈 인트로 끝 → 기차역에서 set-1 선택. 인트로 재생 기록은 지운다 */
async function bootAndStart(): Promise<void> {
  boot();
  setupTeams(['믿음팀', '소망팀']);
  actions().start();
  actions().startChallenge('team-1');
  expect(lastPlay().kind).toBe('intro');
  fake.current!.resolve('ended');
  for (let i = 0; i < 5; i++) await Promise.resolve(); // 가짜 타이머에서도 동작하도록 마이크로태스크만 비운다
  actions().selectTrack('set-1');
  fake.plays = [];
  Object.values(fake.player).forEach((f) => f.mockClear());
}

beforeEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});
afterEach(() => {
  vi.useRealTimers();
});

// ───────── 흐름 ─────────

describe('app 통합', () => {
  it('처음 실행: 저장이 없으면 setup 화면, 관리 저장 후 home', async () => {
    boot();
    expect(ui()).toMatchObject({ view: 'setup', started: false, hasSavedGame: false, notice: null });
    setupTeams([' ']);
    expect(ui().issues).toHaveLength(1);
    expect(state().teams).toEqual([]);
    actions().saveSetup({ teamNames: ['믿음팀'], scriptures: state().questionSets.map((s) => ({ ...scriptureDraftOf(s), scriptureReference: '요한복음 3:16', scriptureText: ' ' })) });
    expect(ui().issues).toHaveLength(state().questionSets.length); // 구절 빈칸
    actions().saveSetup({
      teamNames: ['믿음팀'],
      scriptures: state().questionSets.map((s, i) => ({ ...scriptureDraftOf(s), scriptureReference: ` 출처${i + 1} `, scriptureText: `구절${i + 1}` })),
    });
    expect(ui()).toMatchObject({ view: 'home', issues: [] });
    expect(state().teams.map((t) => t.name)).toEqual(['믿음팀']);
    expect(state().questionSets[2]).toMatchObject({ scriptureReference: '출처3', scriptureText: '구절3' });
    expect(state().questionSets[2].questions).toHaveLength(4); // 문제는 그대로
  });

  it('① 시작 → 도전 시작 → 정답 → play(correct) → ended → 다음 문제 대기', async () => {
    await bootAndStart();
    expect(ui().view).toBe('question');
    expect(state().progress).toMatchObject({ phase: 'awaitingAnswer', questionIndex: 0 });
    expect(fake.player.play).not.toHaveBeenCalled();

    actions().selectChoice(correctId());
    expect(state().progress).toMatchObject({ phase: 'correct', passedCount: 1 });
    expect(fake.player.play).toHaveBeenCalledTimes(1);
    expect(lastPlay().kind).toBe('correct');
    expect(lastPlay().ctx).toEqual({ teamName: '믿음팀', scriptureReference: '데살로니가후서 2:15', livesBefore: 3, livesAfter: 3 });

    // 연출 중 추가 클릭은 무시
    actions().selectChoice(wrongId());
    expect(state().progress).toMatchObject({ phase: 'correct', lives: 3 });

    await finish();
    expect(state().progress).toMatchObject({ phase: 'awaitingAnswer', questionIndex: 1, passedCount: 1 });
    expect(fake.player.play).toHaveBeenCalledTimes(1);
    expect(ui().view).toBe('question');
  });

  it('② 연출 중 관리 메뉴 열기 → pause, 닫기 → resume, 메뉴가 열린 동안 답 입력 무시', async () => {
    await bootAndStart();
    actions().selectChoice(wrongId());
    expect(lastPlay().kind).toBe('wrong');
    expect(lastPlay().ctx).toMatchObject({ livesBefore: 3, livesAfter: 2 });

    actions().openAdminMenu();
    expect(fake.player.pause).toHaveBeenCalledTimes(1);
    expect(ui().adminMenuOpen).toBe(true);

    actions().closeAdminMenu();
    expect(fake.player.resume).toHaveBeenCalledTimes(1);
    expect(fake.player.play).toHaveBeenCalledTimes(1); // 처음부터 다시 재생하지 않음

    await finish();
    actions().openAdminMenu();
    actions().selectChoice(correctId());
    expect(state().progress).toMatchObject({ phase: 'awaitingAnswer', passedCount: 0 });
  });

  it('③ 연출 중 undo → cancel, 늦게 온 ended는 무시, 같은 문제 대기로 복원', async () => {
    await bootAndStart();
    actions().selectChoice(correctId());
    await finish();
    actions().selectChoice(wrongId());
    const stale = lastPlay();
    expect(stale.kind).toBe('wrong');

    actions().openAdminMenu();
    actions().undo();
    expect(fake.player.cancel).toHaveBeenCalled();
    expect(state().progress).toMatchObject({ phase: 'awaitingAnswer', questionIndex: 1, lives: 3, passedCount: 1 });
    expect(ui().view).toBe('question');

    const before = state();
    stale.resolve('ended'); // 이미 'cancelled'로 끝났지만 늦은 신호를 흉내
    await flush();
    expect(state()).toBe(before);
    expect(JSON.parse(window.localStorage.getItem('malsseum-quiz/v1')!).progress).toMatchObject({
      phase: 'awaitingAnswer', questionIndex: 1, lives: 3,
    });

    actions().closeAdminMenu();
    expect(fake.player.play).toHaveBeenCalledTimes(2); // 복원 후 새 연출 없음
    actions().selectChoice(correctId());
    expect(state().progress).toMatchObject({ phase: 'correct', passedCount: 2 });
  });

  it('④ 마지막 오답 → wrong → inferno → 끝나면 teams 화면, 결과 1개', async () => {
    await bootAndStart();
    for (let i = 0; i < 2; i++) {
      actions().selectChoice(wrongId());
      await finish();
      expect(state().progress!.phase).toBe('awaitingAnswer');
    }
    actions().selectChoice(wrongId());
    expect(lastPlay().kind).toBe('wrong');
    expect(state().results).toHaveLength(1);
    await finish();
    expect(lastPlay().kind).toBe('inferno');
    expect(ui().view).toBe('question');
    await finish();

    expect(fake.plays.map((p) => p.kind)).toEqual(['wrong', 'wrong', 'wrong', 'inferno']);
    expect(state().progress).toBeNull();
    expect(ui().view).toBe('home');
    expect(state().results).toEqual([expect.objectContaining({ teamId: 'team-1', passedCount: 0, outcome: 'failed' })]);
    expect(state().teams[0].status).toBe('completed');

    actions().startChallenge('team-1'); // 완료 팀 재도전 불가
    expect(state().progress).toBeNull();
    expect(ui().view).toBe('home');
  });

  it('⑤ 연출 중 새로고침 → 이어하기 → 같은 연출 재생, 목숨·점수·기록 중복 없음', async () => {
    await bootAndStart();
    for (let i = 0; i < 3; i++) {
      actions().selectChoice(correctId());
      await finish();
    }
    actions().selectChoice(correctId()); // 4번째 정답 연출 중 새로고침
    expect(lastPlay().kind).toBe('correct');

    boot(); // 같은 localStorage로 다시 bootstrap
    expect(ui()).toMatchObject({ started: false, hasSavedGame: true, view: 'home' });
    expect(fake.player.play).not.toHaveBeenCalled();
    expect(state().progress).toMatchObject({ phase: 'correct', passedCount: 4 });

    actions().start();
    expect(ui()).toMatchObject({ started: true, hasSavedGame: false, view: 'question' });
    expect(lastPlay().kind).toBe('correct');
    expect(state().progress).toMatchObject({ passedCount: 4, lives: 3 });
    expect(state().results).toHaveLength(1);

    await finish();
    expect(lastPlay().kind).toBe('heaven');
    await finish();
    expect(state().progress).toBeNull();
    expect(state().results).toEqual([expect.objectContaining({ passedCount: 4, outcome: 'clear' })]);
    expect(ui().view).toBe('home');
  });

  it('⑤-2 오답 연출 중 새로고침 → 목숨 중복 차감 없음', async () => {
    await bootAndStart();
    actions().selectChoice(wrongId());
    boot();
    actions().start();
    expect(lastPlay().kind).toBe('wrong');
    expect(lastPlay().ctx).toMatchObject({ livesBefore: 3, livesAfter: 2 });
    await finish();
    expect(state().progress).toMatchObject({ phase: 'awaitingAnswer', lives: 2, questionIndex: 0 });
  });

  it('⑥ save 실패 → notice 설정, adminMenuOpen=true, 연출 시작하지 않음', async () => {
    await bootAndStart();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    actions().selectChoice(correctId());
    expect(ui().notice).toContain('저장에 실패');
    expect(ui().adminMenuOpen).toBe(true);
    expect(fake.player.play).not.toHaveBeenCalled();
  });

  it('⑥-2 저장된 데이터가 손상되면 새로 시작하고 notice로 알린다', async () => {
    window.localStorage.setItem('malsseum-quiz/v1', '{broken');
    boot();
    expect(ui().view).toBe('setup');
    expect(ui().notice).toContain('불러오지 못해');
  });

  it('⑦ 연출 중 home으로 이동 → pause, returnToChallenge → resume', async () => {
    await bootAndStart();
    actions().selectChoice(correctId());
    actions().setView('home');
    expect(fake.player.pause).toHaveBeenCalledTimes(1);
    expect(ui().view).toBe('home');

    actions().startChallenge('team-2'); // 진행 중 도전이 있으면 새 팀 시작 불가
    expect(state().progress!.activeTeamId).toBe('team-1');

    actions().setView('setup');
    actions().returnToChallenge();
    expect(ui().view).toBe('question');
    expect(fake.player.resume).toHaveBeenCalledTimes(1);
    expect(fake.player.play).toHaveBeenCalledTimes(1);

    await finish();
    expect(state().progress).toMatchObject({ phase: 'awaitingAnswer', questionIndex: 1 });
  });

  it('관리 저장 → 연출 취소, 진행·결과·Undo 제거, 팀 재등록, 다음 첫 도전에 인트로', async () => {
    await bootAndStart();
    actions().selectChoice(wrongId());
    setupTeams(['믿음팀', '소망팀']);
    expect(fake.player.cancel).toHaveBeenCalled();
    expect(state()).toMatchObject({ progress: null, results: [], undoHistory: [] });
    expect(state().teams.map((t) => t.status)).toEqual(['notStarted', 'notStarted']);
    expect(ui().view).toBe('home');
    actions().startChallenge('team-1');
    expect(lastPlay().kind).toBe('intro');
    await flush(); // 취소된 오답 연출의 늦은 신호가 새 도전을 바꾸지 않는다
    expect(state().progress).toMatchObject({ activeTeamId: 'team-1', phase: 'choosingTrack', lives: 3 });
  });
});

// ───────── 회귀 테스트 (3차 보고 버그 1~3) ─────────

describe('회귀: app.ts 버그 수정', () => {
  const failSaves = () =>
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
  const saved = () => JSON.parse(window.localStorage.getItem('malsseum-quiz/v1')!) as GameState;

  it('버그3: 저장 실패 → 상태 반영 안 함, 메뉴를 닫아도 play 없음, 저장이 회복되면 다시 진행하고 notice 지움', async () => {
    await bootAndStart();
    const spy = failSaves();
    actions().selectChoice(correctId());
    expect(ui()).toMatchObject({ adminMenuOpen: true });
    expect(ui().notice).toContain('저장에 실패');
    expect(state().progress).toMatchObject({ phase: 'awaitingAnswer', passedCount: 0 });

    actions().closeAdminMenu();
    expect(fake.player.play).not.toHaveBeenCalled();
    expect(state().progress!.phase).toBe('awaitingAnswer');

    spy.mockRestore();
    actions().selectChoice(correctId());
    expect(state().progress).toMatchObject({ phase: 'correct', passedCount: 1 });
    expect(saved().progress).toMatchObject({ phase: 'correct', passedCount: 1 });
    expect(ui().notice).toBeNull();
    expect(fake.player.play).toHaveBeenCalledTimes(1);
  });

  it('버그3: 연출 완료 저장 실패 → 단계 유지, 메뉴를 닫으면 같은 연출을 다시 재생해 재시도', async () => {
    await bootAndStart();
    actions().selectChoice(correctId());
    const spy = failSaves();
    await finish();
    expect(state().progress).toMatchObject({ phase: 'correct', questionIndex: 0 });
    expect(ui().adminMenuOpen).toBe(true);

    spy.mockRestore();
    actions().closeAdminMenu();
    expect(fake.plays.map((p) => p.kind)).toEqual(['correct', 'correct']);
    await finish();
    expect(state().progress).toMatchObject({ phase: 'awaitingAnswer', questionIndex: 1, passedCount: 1 });
    expect(ui().notice).toBeNull();
  });

  it('버그1: undoHistory가 빈 연출 단계에서 undo → 연출을 취소하지 않고 정상 종료', async () => {
    await bootAndStart();
    actions().selectChoice(correctId());
    const data = saved();
    data.undoHistory = [];
    window.localStorage.setItem('malsseum-quiz/v1', JSON.stringify(data));

    boot();
    actions().start();
    actions().openAdminMenu();
    actions().undo();
    actions().closeAdminMenu();
    await flush();
    expect(fake.player.cancel).not.toHaveBeenCalled();
    expect(fake.plays).toHaveLength(1);

    await finish();
    expect(state().progress).toMatchObject({ phase: 'awaitingAnswer', questionIndex: 1, passedCount: 1 });
  });

  it('버그1: 같은 runId 연출을 다시 재생해도 이전 재생의 늦은 cancelled가 새 재생을 끊지 않음', async () => {
    await bootAndStart();
    actions().selectChoice(wrongId());
    const first = lastPlay();
    const spy = failSaves();
    setupTeams(['믿음팀', '소망팀']); // cancel → 저장 실패로 상태 유지 → 같은 runId
    actions().closeAdminMenu(); // 같은 연출 재재생 (이전 Promise의 then은 아직 실행 전)
    spy.mockRestore();
    expect(fake.plays).toHaveLength(2);
    expect(lastPlay()).not.toBe(first);

    await flush(); // 이전 재생의 'cancelled' 처리
    await finish();
    expect(state().progress).toMatchObject({ phase: 'awaitingAnswer', lives: 2 });
  });

  it('버그2: 메뉴를 연 채 12초가 지나도 animationStuck=false, 닫으면 다시 12초 감시', async () => {
    vi.useFakeTimers();
    await bootAndStart();
    actions().selectChoice(correctId());
    actions().openAdminMenu();
    actions().openAdminMenu(); // 메뉴가 열린 동안 다른 update가 와도 pause는 한 번만
    vi.advanceTimersByTime(13_000);
    expect(ui().animationStuck).toBe(false);
    expect(fake.player.pause).toHaveBeenCalledTimes(1);

    actions().closeAdminMenu();
    actions().closeAdminMenu();
    expect(fake.player.resume).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(11_000);
    expect(ui().animationStuck).toBe(false);
    vi.advanceTimersByTime(2_000);
    expect(ui().animationStuck).toBe(true);
  });

  it('꿈 인트로: 첫 도전에서만, 재생 중 말씀 선택 무시, 첫 시작을 undo하면 인트로 취소 후 다음 시작에 다시 재생', async () => {
    boot();
    setupTeams(['믿음팀', '소망팀']);
    actions().start();
    actions().startChallenge('team-1');
    expect(ui().introPlaying).toBe(true);
    expect(lastPlay().kind).toBe('intro');
    expect(state().progress!.phase).toBe('choosingTrack');
    actions().selectTrack('set-1'); // 인트로 중에는 무시
    expect(state().progress!.phase).toBe('choosingTrack');

    actions().undo(); // 도전 시작 취소 → 인트로도 취소
    expect(ui().introPlaying).toBe(false);
    expect(fake.player.cancel).toHaveBeenCalled();
    expect(state().progress).toBeNull();

    // 첫 도전 시작을 취소했으므로 다시 시작하면 인트로를 다시 보여준다
    actions().startChallenge('team-1');
    expect(ui().introPlaying).toBe(true);
    expect(lastPlay().kind).toBe('intro');
    fake.current!.resolve('ended');
    for (let i = 0; i < 5; i++) await Promise.resolve();
    expect(ui().introPlaying).toBe(false);

    // 말씀 선택만 되돌리면(도전은 유지) 인트로는 다시 나오지 않는다
    actions().selectTrack('set-1');
    actions().undo();
    expect(state().progress!.phase).toBe('choosingTrack');
    expect(ui().introPlaying).toBe(false);
    actions().selectTrack('set-1');
    expect(state().progress!.phase).toBe('awaitingAnswer');
    expect(state().teams[0].questionSetId).toBe('set-1');
  });

  it('두 번째 팀은 인트로 없이 기차역, 고른 길은 다시 고를 수 없다', async () => {
    await bootAndStart();
    for (let i = 0; i < 3; i++) {
      actions().selectChoice(wrongId());
      await finish();
    }
    await finish(); // inferno
    actions().startChallenge('team-2');
    expect(fake.plays.map((p) => p.kind)).not.toContain('intro');
    actions().selectTrack('set-1');
    expect(state().progress!.phase).toBe('choosingTrack');
    actions().selectTrack('set-2');
    expect(state().progress!.phase).toBe('awaitingAnswer');
  });

  it('엔딩은 클릭을 기다리므로 12초가 지나도 animationStuck=false', async () => {
    vi.useFakeTimers();
    await bootAndStart();
    for (let i = 0; i < 3; i++) {
      actions().selectChoice(wrongId());
      fake.current!.resolve('ended');
      for (let j = 0; j < 5; j++) await Promise.resolve();
    }
    expect(lastPlay().kind).toBe('inferno');
    vi.advanceTimersByTime(30_000);
    expect(ui().animationStuck).toBe(false);
  });
});
