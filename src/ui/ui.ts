// 담당: dream-f4 — 시작, 초기 설정, 팀 선택, 문제, 리더보드, 관리 화면.
// UI는 상태를 직접 바꾸지 않는다. render()로 받은 상태를 그리고, 사용자 행동은 actions 호출로만 전달한다.
import type { GameState, ValidationIssue } from '../types';
import type { TeamDraft } from '../core/engine';
import './tokens.css';
import './ui.css';
import type { Ctx, LocalUi, Screen } from './context';
import { h } from './dom';
import { createStartScreen } from './screens/start';
import { createSetupScreen } from './screens/setup';
import { createQuestionScreen } from './screens/question';
import { createTeamsBody } from './screens/teams';
import { createLeaderboardBody } from './screens/leaderboard';
import { createAdminBody, createAdminMenu, createConfirmModal } from './screens/admin';

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

const STAGE_W = 1920;
const STAGE_H = 1080;

type ScreenKey = 'start' | 'setup' | 'question' | 'tabs';
type TabView = 'teams' | 'leaderboard' | 'admin';

function screenKeyFor(state: GameState, ui: UiState): ScreenKey {
  if (!ui.started) return 'start';
  if (ui.view === 'setup') return 'setup';
  if (ui.view === 'question' && state.progress) return 'question';
  return 'tabs';
}

/** 상단 탭(팀 선택/리더보드/관리) + 본문 */
function createTabsScreen(ctx: Ctx): Screen {
  const bodies: Record<TabView, Screen> = {
    teams: createTeamsBody(ctx),
    leaderboard: createLeaderboardBody(),
    admin: createAdminBody(ctx),
  };
  const labels: Record<TabView, string> = { teams: '팀 선택', leaderboard: '리더보드', admin: '관리' };
  let shown: TabView | null = null;

  const tabButtons = (Object.keys(labels) as TabView[]).map((v) =>
    h('button', {
      class: 'tab',
      data: { view: v },
      attrs: { type: 'button', role: 'tab' },
      on: {
        click: () => {
          if (v === 'admin') ctx.local.adminSub = 'main';
          ctx.actions.setView(v);
        },
      },
    }, labels[v]),
  );
  const right = h('div', { class: 'topbar__right' });
  const slot = h('div', { class: 'tab-body' });
  slot.style.cssText = 'flex:1;min-height:0;display:flex;flex-direction:column;';
  const el = h('section', { class: 'screen' },
    h('header', { class: 'topbar' },
      h('div', { class: 'topbar__brand' }, '말씀 암송 ', h('b', null, '퀴즈쇼')),
      h('nav', { class: 'tabs', attrs: { role: 'tablist' } }, tabButtons),
      right,
    ),
    slot,
  );

  return {
    el,
    update(state, ui) {
      const view: TabView = ui.view === 'leaderboard' || ui.view === 'admin' ? ui.view : 'teams';
      for (const b of tabButtons) {
        const active = b.dataset.view === view;
        b.classList.toggle('is-active', active);
        b.setAttribute('aria-selected', String(active));
        b.querySelector('.badge-dot')?.remove();
        if (b.dataset.view === 'admin' && (ui.notice || ui.animationStuck)) b.append(h('span', { class: 'badge-dot' }));
      }

      const p = state.progress;
      const team = p && state.teams.find((t) => t.id === p.activeTeamId);
      right.replaceChildren(
        p
          ? h('div', { class: 'resume-banner' },
              h('span', { class: 'live-dot' }),
              `${team?.name ?? ''} 도전 중`,
              h('button', {
                class: 'btn btn--small btn--primary',
                attrs: { type: 'button' },
                on: { click: () => ctx.actions.returnToChallenge() },
              }, '도전으로 돌아가기'),
            )
          : '',
      );

      const body = bodies[view];
      if (shown !== view) {
        // 관리 화면을 새로 열 때마다 진행 팀 정답 공개 확인을 다시 받는다
        if (view === 'admin') ctx.local.revealedSetId = null;
        shown = view;
        body.el.classList.remove('screen-enter');
        slot.replaceChildren(body.el);
        void body.el.offsetWidth;
        body.el.classList.add('screen-enter');
      }
      body.update(state, ui);
    },
  };
}

export function mountUi(root: HTMLElement, actions: UiActions): UiHandle {
  root.classList.add('ui-root');
  const stage = h('div', { class: 'stage' });
  const screenLayer = h('div', { class: 'screen-layer' });
  screenLayer.style.cssText = 'position:absolute;inset:0;';
  /** 연출 오버레이 — 화면 위, 관리 메뉴 아래 */
  const animationHost = h('div', { class: 'anim-host' });
  const overlay = h('div', { class: 'layer-overlay' });
  stage.append(screenLayer, animationHost, overlay);
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

  const local: LocalUi = {
    teamsPage: 0,
    adminSub: 'main',
    reviewSetId: null,
    confirm: null,
    revealedSetId: null,
    lock: null,
    setup: null,
  };
  const ctx: Ctx = { actions, local, rerender: () => { if (last) render(last.state, last.ui); } };

  const factories: Record<ScreenKey, () => Screen> = {
    start: () => createStartScreen(ctx),
    setup: () => { local.setup = null; return createSetupScreen(ctx); },
    question: () => createQuestionScreen(ctx),
    tabs: () => createTabsScreen(ctx),
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
    const confirmKey = confirm ? JSON.stringify(confirm) : '';
    if (confirmModal && confirmModal.key !== confirmKey) { confirmModal.el.remove(); confirmModal = null; }
    if (confirm && !confirmModal) {
      confirmModal = { key: confirmKey, el: createConfirmModal(ctx, confirm, state) };
      overlay.append(confirmModal.el);
    }

    stage.classList.toggle('is-paused', ui.adminMenuOpen);
    stage.dataset.view = key === 'tabs' ? ui.view : key;
  }

  return { render, animationHost };
}
