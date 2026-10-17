// 담당: dream-2a — 시작, home(게임 시작·팀 고르기), 관리(setup), 기차역, 문제 화면.
// UI는 상태를 직접 바꾸지 않는다. render()로 받은 상태를 그리고, 사용자 행동은 actions 호출로만 전달한다.
import type { GameState, ValidationIssue } from '../types';
import { lastUndoLabel, type SetupDraft } from '../core/engine';
import './fonts.css';
import './tokens.css';
import './ui.css';
import './pixel.css';
import type { Ctx, LocalUi, Screen } from './context';
import { h } from './dom';
import { undoIcon } from './icons';
import { createStartScreen } from './screens/start';
import { createSetupScreen } from './screens/setup';
import { createQuestionScreen } from './screens/question';
import { createStationScreen } from './screens/station';
import { createHomeScreen } from './screens/home';
import { createAdminMenu, createConfirmModal } from './screens/admin';

/**
 * setup: 관리(팀 수·팀 이름·말씀 10개 출처와 구절). home: 게임 시작 화면(→ 미도전 팀 고르기). question: 기차역·문제
 */
export type View = 'setup' | 'home' | 'question';

/** 영속되지 않는 화면 상태 (app이 소유) */
export interface UiState {
  /** 시작(전체화면+오디오) 버튼을 눌렀는가. false면 시작 화면만 표시 */
  started: boolean;
  /** 저장된 진행이 있어 '이어하기'로 시작해야 하는가 */
  hasSavedGame: boolean;
  view: View;
  /** 문제 화면 왼쪽 아래 관리 아이콘으로 연 메뉴. 열려 있으면 입력·연출 일시정지 */
  adminMenuOpen: boolean;
  /** 저장 실패 등 관리자 알림 */
  notice: string | null;
  /** 최근 검증 오류 (관리 화면 저장) */
  issues: ValidationIssue[];
  /** 연출 재생 오류로 대체 자막 중 → 관리자에게 '연출 건너뛰기' 노출 */
  animationStuck: boolean;
  isFullscreen: boolean;
  /** 꿈 인트로 재생 중 (행사 첫 시작 때만). 연출 오버레이가 화면 전체를 덮는다 */
  introPlaying: boolean;
}

export interface UiActions {
  start(): void; // 클릭 핸들러 안에서 호출됨 → 전체화면+오디오
  setView(view: Exclude<View, 'question'>): void;
  returnToChallenge(): void; // 진행 중 도전 화면으로
  /** 관리 화면 저장. 검증 통과 시 기록 초기화 + 팀·말씀 반영 후 home. 기록이 있으면 UI가 먼저 확인 모달을 띄운다 */
  saveSetup(draft: SetupDraft): void;
  startChallenge(teamId: string): void; // → progress.phase = 'choosingTrack' (기차역)
  selectTrack(questionSetId: string): void; // 기차역에서 말씀 선택 → 문제 시작
  selectChoice(choiceId: string): void;
  /** 문제 시간 제한 초과 → 오답과 같음. runId는 타이머를 시작한 문제 대기 단계 */
  timeOut(runId: number): void;
  openAdminMenu(): void;
  closeAdminMenu(): void;
  undo(): void;
  skipAnimation(): void;
  enterFullscreen(): void;
}

export interface UiHandle {
  render(state: GameState, ui: UiState): void;
  /** 연출 오버레이가 붙을 요소 (16:9 스테이지 내부) */
  animationHost: HTMLElement;
}

const STAGE_W = 1920;
const STAGE_H = 1080;

type ScreenKey = 'start' | 'setup' | 'home' | 'station' | 'question';

function screenKeyFor(state: GameState, ui: UiState): ScreenKey {
  if (!ui.started) return 'start';
  if (ui.view === 'setup') return 'setup';
  if (ui.view === 'question' && state.progress) return state.progress.phase === 'choosingTrack' ? 'station' : 'question';
  return 'home';
}

export function mountUi(root: HTMLElement, actions: UiActions): UiHandle {
  root.classList.add('ui-root');
  const stage = h('div', { class: 'stage' });
  const screenLayer = h('div', { class: 'screen-layer' });
  screenLayer.style.cssText = 'position:absolute;inset:0;';
  /** 연출 오버레이 — 화면 위, 관리 메뉴 아래 */
  const animationHost = h('div', { class: 'anim-host' });
  const overlay = h('div', { class: 'layer-overlay' });
  const modalLayer = h('div', { class: 'layer-overlay layer-modal' });
  /** 오른쪽 위 ↶ 되돌리기 — 연출(z50)과 관리 메뉴(z80) 위, 확인 모달(z95) 아래 */
  const undoBtn = h('button', {
    class: 'undo-fab',
    attrs: { type: 'button', 'aria-label': '되돌리기' },
    on: { click: () => { if (!undoBtn.disabled) actions.undo(); } },
  }, undoIcon());
  stage.append(screenLayer, animationHost, overlay, undoBtn, modalLayer);
  root.replaceChildren(stage);

  // 16:9 비율 유지 — 남는 영역은 .ui-root 배경
  const fit = () => {
    const w = root.clientWidth || window.innerWidth;
    const hgt = root.clientHeight || window.innerHeight;
    stage.style.setProperty('--stage-scale', String(Math.min(w / STAGE_W, hgt / STAGE_H)));
  };
  fit();
  window.addEventListener('resize', fit);
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(fit).observe(root);

  let last: { state: GameState; ui: UiState } | null = null;
  let current: { key: ScreenKey; screen: Screen } | null = null;
  let menu: Screen | null = null;
  let confirmModal: { key: string; el: HTMLElement } | null = null;

  const local: LocalUi = { confirm: null, lock: null, setup: null, pickingTeam: false };
  const ctx: Ctx = { actions, local, rerender: () => { if (last) render(last.state, last.ui); } };

  const factories: Record<ScreenKey, () => Screen> = {
    start: () => createStartScreen(ctx),
    setup: () => { local.setup = null; return createSetupScreen(ctx); },
    station: () => createStationScreen(ctx),
    question: () => createQuestionScreen(ctx),
    home: () => createHomeScreen(ctx),
  };

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !last) return;
    if (local.confirm) { local.confirm = null; ctx.rerender(); }
    else if (last.ui.adminMenuOpen) actions.closeAdminMenu();
  });

  function render(state: GameState, ui: UiState): void {
    last = { state, ui };
    const key = screenKeyFor(state, ui);
    if (!current || current.key !== key) {
      current = { key, screen: factories[key]() };
      current.screen.el.classList.add('screen-enter');
      screenLayer.replaceChildren(current.screen.el);
    }
    current.screen.update(state, ui);

    // 관리 메뉴: view와 관계없이 adminMenuOpen이면 표시 (시작 화면 제외)
    const menuOpen = ui.started && ui.adminMenuOpen;
    if (menuOpen) {
      if (!menu) { menu = createAdminMenu(ctx); overlay.append(menu.el); }
      menu.update(state, ui);
    } else if (menu) {
      menu.el.remove();
      menu = null;
    }

    const confirm = ui.started ? local.confirm : null;
    const confirmKey = confirm ? confirm.kind : '';
    if (confirmModal && confirmModal.key !== confirmKey) { confirmModal.el.remove(); confirmModal = null; }
    if (confirm && !confirmModal) {
      confirmModal = { key: confirmKey, el: createConfirmModal(ctx, confirm) };
      modalLayer.append(confirmModal.el);
    }

    const label = lastUndoLabel(state);
    undoBtn.hidden = !ui.started || ui.introPlaying || key === 'setup' || key === 'start';
    undoBtn.disabled = !label;
    undoBtn.title = label ? `되돌리기: ${label}` : '되돌릴 행동이 없습니다';

    stage.classList.toggle('is-paused', ui.adminMenuOpen);
    // 꿈 인트로: 연출 오버레이만 보이고 아래 화면은 감춘다 (차분한 배경만)
    stage.classList.toggle('is-intro', ui.started && ui.introPlaying);
    stage.dataset.view = key;
  }

  return { render, animationHost };
}
