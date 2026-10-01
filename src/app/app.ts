// 담당: dream-3c (리드) — 모듈 연결, UiState 관리, 연출 재생 루프, 저장 호출.
import sampleContent from '../../data/sample-content.json';
import { createAnimationPlayer } from '../animation/player';
import { parseContentFile, validateTeamDrafts } from '../content/validator';
import * as engine from '../core/engine';
import { createGameStorage, type GameStorage } from '../storage/storage';
import type { ContentFile, GameState } from '../types';
import { mountUi, type UiActions, type UiState } from '../ui/ui';

/** 연출이 이 시간보다 길어지면 관리자에게 '연출 건너뛰기'를 강조한다 */
const ANIMATION_WATCHDOG_MS = 12_000;

export function bootstrap(root: HTMLElement): void {
  const storage = createGameStorage(window.localStorage);
  const loaded = loadState(storage);
  let state = loaded.state;

  const ui: UiState = {
    started: false,
    hasSavedGame: state.progress !== null,
    view: state.teams.length > 0 ? 'teams' : 'setup',
    adminMenuOpen: false,
    volume: 0.8,
    notice: loaded.notice,
    issues: [],
    animationStuck: false,
    isFullscreen: false,
  };

  /** 현재 재생 중인 연출의 runId (없으면 null) */
  let playingRunId: number | null = null;
  let watchdog: ReturnType<typeof setTimeout> | undefined;

  const actions: UiActions = {
    start() {
      enterFullscreen();
      void player.unlockAudio();
      ui.started = true;
      if (state.progress) {
        // 새로고침 후 이어하기: 중단된 연출을 처음부터 다시 재생 (점수는 다시 계산하지 않음)
        commit(engine.resumeRun(state));
        ui.view = 'question';
      }
      ui.hasSavedGame = false;
      update();
    },
    setView(view) {
      ui.view = view;
      update();
    },
    returnToChallenge() {
      if (state.progress) ui.view = 'question';
      update();
    },
    importContent(json) {
      const { content, issues } = parseContentFile(json);
      ui.issues = issues;
      if (content) {
        const next = engine.replaceContent(state, content);
        if (next === state) ui.notice = '진행 중이거나 기록이 있으면 문제 데이터를 바꿀 수 없습니다. 기록 초기화 후 다시 시도하세요.';
        else commit(next);
      }
      update();
    },
    registerTeams(drafts) {
      const issues = validateTeamDrafts(drafts, contentOf(state));
      ui.issues = issues;
      if (issues.length === 0) {
        const next = engine.registerTeams(state, drafts);
        if (next === state) ui.notice = '진행 중이거나 기록이 있으면 팀 구성을 바꿀 수 없습니다.';
        else {
          commit(next);
          ui.view = 'teams';
        }
      }
      update();
    },
    startChallenge(teamId) {
      const next = engine.startChallenge(state, teamId);
      if (next !== state) {
        commit(next);
        ui.view = 'question';
      }
      update();
    },
    selectChoice(choiceId) {
      if (!ui.started || ui.adminMenuOpen || ui.view !== 'question') return;
      commit(engine.selectChoice(state, choiceId));
      update();
    },
    openAdminMenu() {
      ui.adminMenuOpen = true;
      update();
    },
    closeAdminMenu() {
      ui.adminMenuOpen = false;
      update();
    },
    undo() {
      cancelAnimation();
      const next = engine.undo(state);
      if (next !== state) {
        commit(next);
        if (state.progress) ui.view = 'question';
        else if (ui.view === 'question') ui.view = 'teams';
      }
      update();
    },
    skipAnimation() {
      player.skip();
    },
    setVolume(volume) {
      ui.volume = Math.min(1, Math.max(0, volume));
      player.setVolume(ui.volume);
      update();
    },
    enterFullscreen() {
      enterFullscreen();
    },
    resetRecords() {
      cancelAnimation();
      commit(engine.resetRecords(state));
      ui.view = 'teams';
      update();
    },
  };

  const handle = mountUi(root, actions);
  const player = createAnimationPlayer(handle.animationHost);
  player.setVolume(ui.volume);

  document.addEventListener('fullscreenchange', () => {
    ui.isFullscreen = document.fullscreenElement !== null;
    update();
  });

  update();

  // ───────── 내부 ─────────

  /** 새 상태 반영 + 저장. 저장 실패 시 관리 메뉴를 열어 진행을 멈추고 알린다. */
  function commit(next: GameState): void {
    if (next === state) return;
    state = next;
    try {
      storage.save(state);
    } catch (err) {
      ui.notice = `저장에 실패했습니다. 진행을 멈췄습니다. (${err instanceof Error ? err.message : String(err)})`;
      ui.adminMenuOpen = true;
    }
  }

  function update(): void {
    if (!state.progress && ui.view === 'question') ui.view = 'teams';
    handle.render(state, ui);
    syncAnimation();
  }

  /** 상태의 phase와 실제 재생 중인 연출을 맞춘다. 판정은 하지 않고 완료 신호만 엔진에 전달. */
  function syncAnimation(): void {
    const progress = state.progress;
    const kind = progress ? engine.animationForPhase(progress.phase) : null;
    const paused = !ui.started || ui.adminMenuOpen || ui.view !== 'question';

    if (!progress || !kind) {
      if (playingRunId !== null) cancelAnimation();
      return;
    }
    if (playingRunId === progress.runId) {
      if (paused) player.pause();
      else player.resume();
      return;
    }
    if (playingRunId !== null) cancelAnimation();
    if (paused) return; // 메뉴를 닫거나 문제 화면으로 돌아오면 재생

    const runId = progress.runId;
    const team = state.teams.find((t) => t.id === progress.activeTeamId);
    playingRunId = runId;
    clearTimeout(watchdog);
    watchdog = setTimeout(() => {
      if (playingRunId === runId) {
        ui.animationStuck = true;
        handle.render(state, ui);
      }
    }, ANIMATION_WATCHDOG_MS);

    void player
      .play(kind, {
        teamName: team?.name ?? '',
        livesBefore: kind === 'wrong' ? progress.lives + 1 : progress.lives,
        livesAfter: progress.lives,
      })
      .then((reason) => {
        if (playingRunId !== runId) return; // 이미 다른 연출로 대체됨
        playingRunId = null;
        clearTimeout(watchdog);
        ui.animationStuck = false;
        if (reason === 'cancelled') return;
        // runId가 다르면 엔진이 무시한다 (Undo 후 늦게 도착한 신호)
        commit(engine.completeAnimation(state, runId));
        update();
      });
  }

  function cancelAnimation(): void {
    playingRunId = null;
    clearTimeout(watchdog);
    ui.animationStuck = false;
    player.cancel();
  }
}

function loadState(storage: GameStorage): { state: GameState; notice: string | null } {
  const result = storage.load();
  if (result.kind === 'ok') return { state: result.state, notice: null };
  const initial = engine.createInitialState(sampleContent as ContentFile);
  if (result.kind === 'incompatible') {
    return { state: initial, notice: `저장된 기록을 불러오지 못해 새로 시작합니다. (${result.reason})` };
  }
  return { state: initial, notice: null };
}

function contentOf(state: GameState): ContentFile {
  return { contentVersion: state.contentVersion, questionSets: state.questionSets };
}

function enterFullscreen(): void {
  if (document.fullscreenElement) return;
  document.documentElement.requestFullscreen?.().catch(() => {
    /* 사용자 제스처가 없거나 거부되면 무시 — 관리 메뉴에서 다시 시도 */
  });
}
