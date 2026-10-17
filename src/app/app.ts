// 담당: dream-3c (리드) — 모듈 연결, UiState 관리, 연출 재생 루프, 저장 호출.
import sampleContent from '../../data/sample-content.json';
import { createAnimationPlayer } from '../animation/player';
import { validateSetup } from '../content/validator';
import * as engine from '../core/engine';
import { createGameStorage, type GameStorage } from '../storage/storage';
import type { AnimationKind, ContentFile, GameState } from '../types';
import { mountUi, type UiActions, type UiState } from '../ui/ui';

/** 음량 조절은 없앴다 — 고정 */
const VOLUME = 0.8;

/** 연출이 이 시간보다 길어지면 관리자에게 '연출 건너뛰기'를 강조한다 */
const ANIMATION_WATCHDOG_MS = 12_000;

export function bootstrap(root: HTMLElement): void {
  const storage = createGameStorage(window.localStorage);
  const loaded = loadState(storage);
  let state = loaded.state;

  const ui: UiState = {
    started: false,
    hasSavedGame: state.progress !== null,
    view: state.teams.length > 0 ? 'home' : 'setup',
    adminMenuOpen: false,
    notice: loaded.notice,
    issues: [],
    animationStuck: false,
    isFullscreen: false,
    introPlaying: false,
  };
  /** 꿈 인트로를 이 페이지에서 이미 보여줬는가 — 행사 첫 도전 시작 때 한 번만 */
  let introShown = false;

  /**
   * 현재 재생 중인 연출 (없으면 null). token은 play 호출마다 고유 — 같은 runId 재재생 시 이전 콜백 구분용.
   * runId가 'intro'면 꿈 인트로 (엔진 진행과 무관).
   */
  let playing: { token: number; runId: number | 'intro' } | null = null;
  let nextToken = 0;
  let playerPaused = false;
  let watchdog: ReturnType<typeof setTimeout> | undefined;
  /** 저장 실패 상태. 저장이 다시 성공할 때까지 notice 유지 */
  let saveFailed = false;

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
    saveSetup(draft) {
      const issues = validateSetup(draft);
      ui.issues = issues;
      if (issues.length === 0) {
        cancelAnimation();
        ui.introPlaying = false;
        if (commit(engine.saveSetup(state, draft))) {
          introShown = false; // 기록이 새로 시작되므로 첫 도전에서 인트로를 다시 보여준다
          ui.view = 'home';
        }
      }
      update();
    },
    startChallenge(teamId) {
      const first = state.results.length === 0;
      const next = engine.startChallenge(state, teamId);
      if (next !== state && commit(next)) {
        ui.view = 'question';
        // 행사 첫 도전: 꿈 인트로 → 눈을 떠보니 기차역
        if (first && !introShown) {
          introShown = true;
          ui.introPlaying = true;
        }
      }
      update();
    },
    selectTrack(questionSetId) {
      if (!ui.started || ui.adminMenuOpen || ui.introPlaying || ui.view !== 'question') return;
      commit(engine.selectTrack(state, questionSetId));
      update();
    },
    selectChoice(choiceId) {
      if (!ui.started || ui.adminMenuOpen || ui.view !== 'question') return;
      commit(engine.selectChoice(state, choiceId));
      update();
    },
    timeOut(runId) {
      if (!ui.started || ui.adminMenuOpen || ui.view !== 'question') return;
      commit(engine.timeOut(state, runId));
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
      const next = engine.undo(state);
      if (next !== state) {
        cancelAnimation();
        ui.introPlaying = false;
        commit(next);
        // 첫 도전 시작을 취소했다면(아직 아무 기록도 없음) 다음 시작 때 인트로를 다시 보여준다
        if (!state.progress && state.results.length === 0) introShown = false;
        if (state.progress) ui.view = 'question';
        else if (ui.view === 'question') ui.view = 'home';
      }
      update();
    },
    skipAnimation() {
      player.skip();
    },
    enterFullscreen() {
      enterFullscreen();
    },
  };

  const handle = mountUi(root, actions);
  const player = createAnimationPlayer(handle.animationHost);
  player.setVolume(VOLUME);

  document.addEventListener('fullscreenchange', () => {
    ui.isFullscreen = document.fullscreenElement !== null;
    update();
  });

  update();

  // ───────── 내부 ─────────

  /**
   * 새 상태 반영 + 저장. 성공하면 true.
   * 저장 실패 시 이전 상태로 되돌리고(메모리와 저장소 불일치 방지) 관리 메뉴를 열어 진행을 멈춘다.
   */
  function commit(next: GameState): boolean {
    if (next === state) return true;
    try {
      storage.save(next);
    } catch (err) {
      saveFailed = true;
      ui.notice = `저장에 실패해 마지막 행동을 반영하지 않고 진행을 멈췄습니다. 원인을 해결한 뒤 다시 시도하세요. (${err instanceof Error ? err.message : String(err)})`;
      ui.adminMenuOpen = true;
      return false;
    }
    state = next;
    if (saveFailed) {
      saveFailed = false;
      ui.notice = null;
    }
    return true;
  }

  function update(): void {
    if (!state.progress && ui.view === 'question') ui.view = 'home';
    handle.render(state, ui);
    syncAnimation();
  }

  /** 상태의 phase(또는 꿈 인트로)와 실제 재생 중인 연출을 맞춘다. 판정은 하지 않고 완료 신호만 엔진에 전달. */
  function syncAnimation(): void {
    const progress = state.progress;
    let kind: AnimationKind | null = null;
    let runId: number | 'intro' | null = null;
    if (ui.introPlaying) {
      kind = 'intro';
      runId = 'intro';
    } else if (progress) {
      kind = engine.animationForPhase(progress.phase);
      runId = progress.runId;
    }
    const paused = !ui.started || ui.adminMenuOpen || ui.view !== 'question';

    if (!kind || runId === null) {
      if (playing) cancelAnimation();
      return;
    }
    if (playing?.runId === runId) {
      if (paused && !playerPaused) {
        player.pause();
        clearTimeout(watchdog); // 일시정지 중에는 '멈춤' 판정하지 않음
      } else if (!paused && playerPaused) {
        player.resume();
        armWatchdog(playing.token, kind);
      }
      playerPaused = paused;
      return;
    }
    if (playing) cancelAnimation();
    if (paused) return; // 메뉴를 닫거나 문제 화면으로 돌아오면 재생

    const token = ++nextToken;
    const team = progress && state.teams.find((t) => t.id === progress.activeTeamId);
    playing = { token, runId };
    playerPaused = false;
    armWatchdog(token, kind);

    void player
      .play(kind, {
        teamName: team?.name ?? '',
        scriptureReference: state.questionSets.find((s) => s.id === team?.questionSetId)?.scriptureReference,
        livesBefore: progress ? (kind === 'wrong' ? progress.lives + 1 : progress.lives) : 0,
        livesAfter: progress?.lives ?? 0,
      })
      .then((reason) => {
        if (playing?.token !== token) return; // 취소됐거나 다른 재생으로 대체됨
        playing = null;
        clearTimeout(watchdog);
        ui.animationStuck = false;
        if (reason === 'cancelled') return;
        if (runId === 'intro') ui.introPlaying = false;
        // runId가 다르면 엔진이 무시한다 (Undo 후 늦게 도착한 신호)
        else commit(engine.completeAnimation(state, runId));
        update();
      });
  }

  /** 재생(또는 재개) 시점부터 일정 시간 안에 끝나지 않으면 관리자에게 건너뛰기를 강조 */
  function armWatchdog(token: number, kind: AnimationKind): void {
    clearTimeout(watchdog);
    // 인트로·엔딩은 대사 후 클릭을 기다리므로 '멈춤' 판정하지 않는다
    if (kind === 'intro' || kind === 'heaven' || kind === 'inferno') return;
    watchdog = setTimeout(() => {
      if (playing?.token === token) {
        ui.animationStuck = true;
        handle.render(state, ui);
      }
    }, ANIMATION_WATCHDOG_MS);
  }

  function cancelAnimation(): void {
    playing = null;
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


function enterFullscreen(): void {
  if (document.fullscreenElement) return;
  document.documentElement.requestFullscreen?.().catch(() => {
    /* 사용자 제스처가 없거나 거부되면 무시 — 관리 메뉴에서 다시 시도 */
  });
}
