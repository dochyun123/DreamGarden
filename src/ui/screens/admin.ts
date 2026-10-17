// 담당: dream-2a — 문제 화면 ⚙ 관리 메뉴와 확인 모달.
// 운영자용 톤(작은 글자, 왼쪽 정렬). 되돌리기는 오른쪽 위 ↶ 버튼(ui.ts)에도 있다.
import type { GameState } from '../../types';
import { lastUndoLabel } from '../../core/engine';
import type { UiState } from '../ui';
import type { Ctx, Screen } from '../context';
import { h } from '../dom';

type BtnKind = '' | 'primary' | 'warning' | 'danger-solid';
function cbtn(label: string, onClick: () => void, opts: { kind?: BtnKind; disabled?: boolean } = {}): HTMLButtonElement {
  return h('button', {
    class: `cbtn${opts.kind ? ` cbtn--${opts.kind}` : ''}`,
    attrs: { type: 'button', disabled: !!opts.disabled },
    on: { click: onClick },
  }, label);
}

function noticeBanner(ui: UiState): HTMLElement | null {
  if (!ui.notice) return null;
  return h('div', { class: 'c-notice', attrs: { role: 'alert' } }, h('b', null, '알림'), ui.notice);
}

function animating(state: GameState): boolean {
  const phase = state.progress?.phase;
  return !!phase && phase !== 'awaitingAnswer' && phase !== 'choosingTrack';
}

/** ⚙로 여는 작은 관리 메뉴: 되돌리기 · 연출 건너뛰기(멈췄을 때) · 전체화면 · 홈으로 · 닫기 */
export function createAdminMenu(ctx: Ctx): Screen {
  const a = ctx.actions;
  const body = h('div', { class: 'c-menu__body' });
  const panelEl = h('div', { class: 'c-menu', attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': '설정 메뉴' } },
    h('div', { class: 'c-menu__head' },
      h('h2', { class: 'c-title' }, '설정 메뉴'),
      h('button', {
        class: 'cbtn cbtn--icon',
        attrs: { type: 'button', 'aria-label': '닫기', title: '닫기' },
        on: { click: () => a.closeAdminMenu() },
      }, '✕'),
    ),
    body,
  );
  const el = h('div', {
    class: 'scrim scrim--console',
    on: { click: (e) => { if (e.target === el) a.closeAdminMenu(); } },
  }, panelEl);
  return {
    el,
    update(state, ui) {
      const undoLabel = lastUndoLabel(state);
      const showSkip = ui.animationStuck || animating(state);
      body.replaceChildren(...[
        noticeBanner(ui),
        h('div', { class: 'c-menu__list' },
          cbtn(undoLabel ? `↶ 되돌리기 — ${undoLabel}` : '↶ 되돌리기', () => a.undo(), { disabled: !undoLabel }),
          showSkip
            ? cbtn(ui.animationStuck ? '연출 건너뛰기 (멈춤)' : '연출 건너뛰기', () => a.skipAnimation(), { kind: ui.animationStuck ? 'warning' : '' })
            : null,
          cbtn(ui.isFullscreen ? '전체화면 사용 중' : '전체화면 켜기', () => a.enterFullscreen(), { disabled: ui.isFullscreen }),
          cbtn('홈으로', () => { a.closeAdminMenu(); a.setView('home'); }),
        ),
        h('div', { class: 'c-menu__foot' }, cbtn('닫기', () => a.closeAdminMenu(), { kind: 'primary' })),
      ].filter((x): x is HTMLElement => !!x));
    },
  };
}

/** 자체 확인 모달 (window.confirm 대신): 관리 화면 저장 → 기록 초기화 */
export function createConfirmModal(ctx: Ctx, confirm: NonNullable<Ctx['local']['confirm']>): HTMLElement {
  const cancel = () => { ctx.local.confirm = null; ctx.rerender(); };
  const cancelBtn = cbtn('취소', cancel);
  const el = h('div', { class: 'scrim scrim--console', on: { click: (e) => { if (e.target === el) cancel(); } } },
    h('div', { class: 'c-modal', attrs: { role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': 'confirm-title' } },
      h('h2', { class: 'c-title', attrs: { id: 'confirm-title' } }, '저장하면 기록이 초기화됩니다'),
      h('p', { class: 'c-hint' }, '진행 중인 도전과 모든 팀의 결과가 지워집니다.'),
      h('div', { class: 'c-row c-row--end' },
        cancelBtn,
        cbtn('초기화하고 저장', () => { ctx.local.confirm = null; confirm.onOk(); ctx.rerender(); }, { kind: 'danger-solid' }),
      ),
    ),
  );
  queueMicrotask(() => cancelBtn.focus());
  return el;
}
