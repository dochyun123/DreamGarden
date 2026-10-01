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

/** 팀 2개 등록 → 시작 버튼 → team-1 도전 시작 */
function bootAndStart(): void {
  boot();
  actions().registerTeams([
    { name: '믿음팀', questionSetId: 'set-1' },
    { name: '소망팀', questionSetId: 'set-2' },
  ]);
  actions().start();
  actions().startChallenge('team-1');
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
  it('처음 실행: 저장이 없으면 setup 화면, 팀 등록 후 teams', () => {
    boot();
    expect(ui()).toMatchObject({ view: 'setup', started: false, hasSavedGame: false, notice: null });
    actions().registerTeams([{ name: ' ', questionSetId: 'set-1' }]);
    expect(ui().issues).toHaveLength(1);
    expect(state().teams).toEqual([]);
    actions().registerTeams([{ name: '믿음팀', questionSetId: 'set-1' }]);
    expect(ui()).toMatchObject({ view: 'teams', issues: [] });
  });

  it('① 시작 → 도전 시작 → 정답 → play(correct) → ended → 다음 문제 대기', async () => {
    bootAndStart();
    expect(ui().view).toBe('question');
    expect(state().progress).toMatchObject({ phase: 'awaitingAnswer', questionIndex: 0 });
    expect(fake.player.play).not.toHaveBeenCalled();

    actions().selectChoice(correctId());
    expect(state().progress).toMatchObject({ phase: 'correct', passedCount: 1 });
    expect(fake.player.play).toHaveBeenCalledTimes(1);
    expect(lastPlay().kind).toBe('correct');
    expect(lastPlay().ctx).toEqual({ teamName: '믿음팀', livesBefore: 3, livesAfter: 3 });

    // 연출 중 추가 클릭은 무시
    actions().selectChoice(wrongId());
    expect(state().progress).toMatchObject({ phase: 'correct', lives: 3 });

    await finish();
    expect(state().progress).toMatchObject({ phase: 'awaitingAnswer', questionIndex: 1, passedCount: 1 });
    expect(fake.player.play).toHaveBeenCalledTimes(1);
    expect(ui().view).toBe('question');
  });

  it('② 연출 중 관리 메뉴 열기 → pause, 닫기 → resume, 메뉴가 열린 동안 답 입력 무시', async () => {
    bootAndStart();
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
    bootAndStart();
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
    bootAndStart();
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
    expect(ui().view).toBe('teams');
    expect(state().results).toEqual([expect.objectContaining({ teamId: 'team-1', passedCount: 0, outcome: 'failed' })]);
    expect(state().teams[0].status).toBe('completed');

    actions().startChallenge('team-1'); // 완료 팀 재도전 불가
    expect(state().progress).toBeNull();
    expect(ui().view).toBe('teams');
  });

  it('⑤ 연출 중 새로고침 → 이어하기 → 같은 연출 재생, 목숨·점수·기록 중복 없음', async () => {
    bootAndStart();
    for (let i = 0; i < 4; i++) {
      actions().selectChoice(correctId());
      await finish();
    }
    actions().selectChoice(correctId()); // 5번째 정답 연출 중 새로고침
    expect(lastPlay().kind).toBe('correct');

    boot(); // 같은 localStorage로 다시 bootstrap
    expect(ui()).toMatchObject({ started: false, hasSavedGame: true, view: 'teams' });
    expect(fake.player.play).not.toHaveBeenCalled();
    expect(state().progress).toMatchObject({ phase: 'correct', passedCount: 5 });

    actions().start();
    expect(ui()).toMatchObject({ started: true, hasSavedGame: false, view: 'question' });
    expect(lastPlay().kind).toBe('correct');
    expect(state().progress).toMatchObject({ passedCount: 5, lives: 3 });
    expect(state().results).toHaveLength(1);

    await finish();
    expect(lastPlay().kind).toBe('heaven');
    await finish();
    expect(state().progress).toBeNull();
    expect(state().results).toEqual([expect.objectContaining({ passedCount: 5, outcome: 'clear' })]);
    expect(ui().view).toBe('teams');
  });

  it('⑤-2 오답 연출 중 새로고침 → 목숨 중복 차감 없음', async () => {
    bootAndStart();
    actions().selectChoice(wrongId());
    boot();
    actions().start();
    expect(lastPlay().kind).toBe('wrong');
    expect(lastPlay().ctx).toMatchObject({ livesBefore: 3, livesAfter: 2 });
    await finish();
    expect(state().progress).toMatchObject({ phase: 'awaitingAnswer', lives: 2, questionIndex: 0 });
  });

  it('⑥ save 실패 → notice 설정, adminMenuOpen=true, 연출 시작하지 않음', () => {
    bootAndStart();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    actions().selectChoice(correctId());
    expect(ui().notice).toContain('저장에 실패');
    expect(ui().adminMenuOpen).toBe(true);
    expect(fake.player.play).not.toHaveBeenCalled();
  });

  it('⑥-2 저장된 데이터가 손상되면 새로 시작하고 notice로 알린다', () => {
    window.localStorage.setItem('malsseum-quiz/v1', '{broken');
    boot();
    expect(ui().view).toBe('setup');
    expect(ui().notice).toContain('불러오지 못해');
  });

  it('⑦ 연출 중 teams로 이동 → pause, returnToChallenge → resume', async () => {
    bootAndStart();
    actions().selectChoice(correctId());
    actions().setView('teams');
    expect(fake.player.pause).toHaveBeenCalledTimes(1);
    expect(ui().view).toBe('teams');

    actions().startChallenge('team-2'); // 진행 중 도전이 있으면 새 팀 시작 불가
    expect(state().progress!.activeTeamId).toBe('team-1');

    actions().setView('leaderboard');
    actions().returnToChallenge();
    expect(ui().view).toBe('question');
    expect(fake.player.resume).toHaveBeenCalledTimes(1);
    expect(fake.player.play).toHaveBeenCalledTimes(1);

    await finish();
    expect(state().progress).toMatchObject({ phase: 'awaitingAnswer', questionIndex: 1 });
  });

  it('전체 기록 초기화 → 연출 취소, 팀 유지, 진행·결과·Undo 제거', async () => {
    bootAndStart();
    actions().selectChoice(wrongId());
    actions().resetRecords();
    expect(fake.player.cancel).toHaveBeenCalled();
    expect(state()).toMatchObject({ progress: null, results: [], undoHistory: [] });
    expect(state().teams.map((t) => t.status)).toEqual(['notStarted', 'notStarted']);
    expect(ui().view).toBe('teams');
    await flush();
    expect(state().progress).toBeNull();
  });
});
