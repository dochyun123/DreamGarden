// 담당: dream-f4 — 관리 콘솔. 상단 탭의 관리 화면, 문제 화면 ⚙ 관리 메뉴, 확인 모달.
// 게임 화면과 구분되는 운영자용 톤(작은 글자, 왼쪽 정렬, 얇은 구분선). 정답·말씀 원문은 '문제 세트 검수'에서만 표시한다.
// 되돌리기는 모든 게임 화면 오른쪽 위 ↶ 버튼(ui.ts)으로 옮겼다.
import type { GameState } from '../../types';
import type { UiActions, UiState } from '../ui';
import type { Ctx, Screen } from '../context';
import { h } from '../dom';
import { renderPrompt } from './question';

/** 편집(팀·문제 변경) 잠금 사유. null이면 편집 가능 */
export function editLockReason(state: GameState): string | null {
  if (state.progress) return '도전 진행 중에는 바꿀 수 없습니다.';
  if (state.results.length > 0) return '기록 초기화 후 바꿀 수 있습니다.';
  return null;
}

function noticeBanner(ui: UiState): HTMLElement | null {
  if (!ui.notice) return null;
  return h('div', { class: 'c-notice', attrs: { role: 'alert' } }, h('b', null, '알림'), ui.notice);
}

type BtnKind = '' | 'primary' | 'warning' | 'danger';
function cbtn(label: string, onClick: () => void, opts: { kind?: BtnKind; disabled?: boolean } = {}): HTMLButtonElement {
  return h('button', {
    class: `cbtn${opts.kind ? ` cbtn--${opts.kind}` : ''}`,
    attrs: { type: 'button', disabled: !!opts.disabled },
    on: { click: onClick },
  }, label);
}

/** 콘솔 한 섹션: 왼쪽 라벨 | 오른쪽 컨트롤 */
function section(label: string, ...children: (HTMLElement | string | null)[]): HTMLElement {
  return h('section', { class: 'c-section' },
    h('h3', { class: 'c-section__label' }, label),
    h('div', { class: 'c-section__body' }, ...children),
  );
}

function animating(state: GameState): boolean {
  return !!state.progress && state.progress.phase !== 'awaitingAnswer';
}

function activeTeamName(state: GameState): string | null {
  const p = state.progress;
  return p ? state.teams.find((t) => t.id === p.activeTeamId)?.name ?? null : null;
}

/** 진행 중인 팀의 문제 세트 id */
function activeSetId(state: GameState): string | null {
  const p = state.progress;
  if (!p) return null;
  return state.teams.find((t) => t.id === p.activeTeamId)?.questionSetId ?? null;
}

/** 음량 슬라이더 — 드래그 중 다시 그려지면 끊기므로 같은 요소를 계속 쓴다 */
function createVolume(a: UiActions): { el: HTMLElement; sync(ui: UiState): void } {
  const value = h('span', { class: 'c-volume__value' });
  const input = h('input', {
    attrs: { type: 'range', min: 0, max: 100, step: 5, 'aria-label': '음량' },
    on: {
      input: () => {
        value.textContent = `${input.value}%`;
        a.setVolume(Number(input.value) / 100);
      },
    },
  });
  return {
    el: h('div', { class: 'c-volume' }, h('span', { class: 'c-key' }, '음량'), input, value),
    sync(ui) {
      if (document.activeElement === input) return;
      const v = Math.round(ui.volume * 100);
      input.value = String(v);
      value.textContent = `${v}%`;
    },
  };
}

function fullscreenBtn(a: UiActions, ui: UiState): HTMLButtonElement {
  return cbtn(ui.isFullscreen ? '전체화면 사용 중' : '전체화면 켜기', () => a.enterFullscreen(), { disabled: ui.isFullscreen });
}

function skipBtn(a: UiActions, state: GameState, ui: UiState): HTMLButtonElement {
  return cbtn(ui.animationStuck ? '연출 건너뛰기 (멈춤)' : '연출 건너뛰기', () => a.skipAnimation(), {
    kind: ui.animationStuck ? 'warning' : '',
    disabled: !animating(state) && !ui.animationStuck,
  });
}

/** 관리 탭 메인 */
function createConsoleMain(ctx: Ctx): Screen {
  const a = ctx.actions;
  const el = h('div', { class: 'console' });
  const volume = createVolume(a);
  return {
    el,
    update(state, ui) {
      const team = activeTeamName(state);
      const done = state.teams.filter((t) => t.status === 'completed').length;
      const lock = editLockReason(state);
      const hasRecords = !!state.progress || state.results.length > 0 || state.undoHistory.length > 0;
      volume.sync(ui);

      el.replaceChildren(
        h('div', { class: 'c-status' },
          h('span', null, h('span', { class: 'c-key' }, '완료'), ` ${done} / ${state.teams.length}팀`),
          h('span', null, h('span', { class: 'c-key' }, '진행 중'), ` ${team ?? '없음'}`),
          h('span', null, h('span', { class: 'c-key' }, '문제 데이터'), ` ${state.contentVersion || '-'} · ${state.questionSets.length}세트`),
        ),
        noticeBanner(ui) ?? '',
        section('진행 제어',
          h('div', { class: 'c-row' },
            skipBtn(a, state, ui),
            cbtn('도전 화면으로', () => a.returnToChallenge(), { kind: 'primary', disabled: !state.progress }),
          ),
        ),
        section('소리 · 화면',
          volume.el,
          h('div', { class: 'c-row' }, fullscreenBtn(a, ui)),
        ),
        section('데이터',
          h('div', { class: 'c-row' },
            cbtn('문제 세트 검수', () => { ctx.local.adminSub = 'review'; ctx.rerender(); }, { disabled: state.questionSets.length === 0 }),
            cbtn('팀 · 문제 설정 변경', () => a.setView('setup'), { disabled: !!lock }),
          ),
          lock ? h('p', { class: 'c-hint c-hint--lock' }, '🔒 ', lock) : null,
        ),
        h('section', { class: 'c-section c-danger' },
          h('h3', { class: 'c-section__label' }, '위험 구역'),
          h('div', { class: 'c-section__body' },
            h('div', { class: 'c-row' },
              cbtn('전체 기록 초기화…', () => { ctx.local.confirm = { kind: 'reset' }; ctx.rerender(); }, { kind: 'danger', disabled: !hasRecords }),
              h('span', { class: 'c-hint' }, '진행·결과·되돌리기 기록 삭제'),
            ),
          ),
        ),
      );
    },
  };
}

/** 문제 세트 검수 — 표 형식, 실제 출제 순서 */
function createReview(ctx: Ctx): Screen {
  const el = h('div', { class: 'c-review' });
  return {
    el,
    update(state) {
      const sets = state.questionSets;
      const active = activeSetId(state);
      // 처음 열 때는 진행 중인 팀의 세트를 피해서 고른다
      const current = sets.find((s) => s.id === ctx.local.reviewSetId)
        ?? sets.find((s) => s.id !== active) ?? sets[0];
      if (!current) { el.replaceChildren(h('p', { class: 'c-hint' }, '문제 데이터가 없습니다')); return; }
      ctx.local.reviewSetId = current.id;
      const hidden = current.id === active && ctx.local.revealedSetId !== active;
      const ask = (setId: string) => { ctx.local.confirm = { kind: 'reveal', setId }; ctx.rerender(); };
      const teamsOf = (setId: string) => state.teams.filter((t) => t.questionSetId === setId).map((t) => t.name);

      const list = h('table', { class: 'c-table c-review__sets' },
        h('thead', null, h('tr', null, h('th', null, '세트'), h('th', null, '팀'))),
        h('tbody', null,
          sets.map((s) => h('tr', {
            class: s.id === current.id ? 'is-active' : '',
            on: {
              click: () => {
                if (s.id === active && ctx.local.revealedSetId !== active) { ask(s.id); return; }
                ctx.local.reviewSetId = s.id;
                ctx.rerender();
              },
            },
          },
            h('td', null, s.scriptureReference, s.id === active ? h('span', { class: 'c-live' }, '진행 중') : null),
            h('td', { class: 'c-dim' }, teamsOf(s.id).join(', ') || '—'),
          )),
        ),
      );

      const detail = hidden
        ? h('div', { class: 'c-review__detail' },
            h('p', { class: 'c-hint' }, '진행 중인 팀의 정답은 가려져 있습니다.'),
            h('div', { class: 'c-row' }, cbtn('정답 보기…', () => ask(current.id), { kind: 'warning' })),
          )
        : h('div', { class: 'c-review__detail' },
            h('div', { class: 'c-scripture' },
              h('b', null, current.scriptureReference),
              h('p', null, current.scriptureText),
            ),
            h('table', { class: 'c-table c-review__q' },
              h('thead', null, h('tr', null, h('th', null, '#'), h('th', null, '문제'), h('th', null, '보기'), h('th', null, '정답'))),
              h('tbody', null,
                current.questions.map((q, qi) => {
                  const ci = q.choices.findIndex((c) => c.id === q.correctChoiceId);
                  return h('tr', null,
                    h('td', { class: 'c-num' }, qi + 1),
                    h('td', null, ...renderPrompt(q.prompt)),
                    h('td', null,
                      h('ol', { class: 'c-choices' },
                        q.choices.map((c) => h('li', { class: c.id === q.correctChoiceId ? 'is-correct' : '' }, c.text)))),
                    h('td', { class: 'c-answer' }, ci >= 0 ? `${ci + 1}번` : '—'),
                  );
                }),
              ),
            ),
          );

      el.replaceChildren(list, detail);
    },
  };
}

/** 상단 탭의 관리 화면 */
export function createAdminBody(ctx: Ctx): Screen {
  const el = h('div', { class: 'page page--console' });
  const main = createConsoleMain(ctx);
  const review = createReview(ctx);
  return {
    el,
    update(state, ui) {
      if (ctx.local.adminSub === 'review') {
        review.update(state, ui);
        el.replaceChildren(
          h('div', { class: 'c-head' },
            cbtn('← 관리', () => { ctx.local.adminSub = 'main'; ctx.rerender(); }),
            h('h2', { class: 'c-title' }, '문제 세트 검수'),
          ),
          review.el,
        );
        return;
      }
      main.update(state, ui);
      el.replaceChildren(main.el);
    },
  };
}

/** 문제 화면 ⚙로 여는 작은 관리 메뉴 (어느 화면에서든 adminMenuOpen이면 표시) */
export function createAdminMenu(ctx: Ctx): Screen {
  const a = ctx.actions;
  const volume = createVolume(a);
  const body = h('div', { class: 'c-menu__body' });
  const panelEl = h('div', { class: 'c-menu', attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': '관리 메뉴' } },
    h('div', { class: 'c-menu__head' },
      h('h2', { class: 'c-title' }, '관리 메뉴'),
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
      volume.sync(ui);
      const go = (fn: () => void) => () => { a.closeAdminMenu(); fn(); };
      body.replaceChildren(...[
        noticeBanner(ui),
        animating(state) || ui.animationStuck
          ? section('연출', h('div', { class: 'c-row' }, skipBtn(a, state, ui)))
          : null,
        section('소리 · 화면', volume.el, h('div', { class: 'c-row' }, fullscreenBtn(a, ui))),
        section('이동',
          h('div', { class: 'c-row' },
            ui.view !== 'question' && state.progress ? cbtn('도전 화면으로', go(() => a.returnToChallenge()), { kind: 'primary' }) : null,
            cbtn('팀 선택', go(() => a.setView('teams'))),
            cbtn('리더보드', go(() => a.setView('leaderboard'))),
            cbtn('관리 화면', go(() => a.setView('admin'))),
          ),
        ),
        h('div', { class: 'c-menu__foot' }, cbtn('닫고 계속하기', () => a.closeAdminMenu(), { kind: 'primary' })),
      ].filter((x): x is HTMLElement => !!x));
    },
  };
}

/** 자체 확인 모달 (window.confirm 대신): 전체 기록 초기화, 진행 팀 정답 공개 */
export function createConfirmModal(ctx: Ctx, confirm: NonNullable<Ctx['local']['confirm']>): HTMLElement {
  const cancel = () => { ctx.local.confirm = null; ctx.rerender(); };
  let title: string;
  let body: (string | HTMLElement)[];
  let okLabel: string;
  let okClass: string;
  let onOk: () => void;
  if (confirm.kind === 'reset') {
    title = '전체 기록을 초기화할까요?';
    body = ['팀명과 문제는 유지됩니다.'];
    okLabel = '초기화';
    okClass = 'cbtn--danger-solid';
    onOk = () => { ctx.local.confirm = null; ctx.actions.resetRecords(); ctx.rerender(); };
  } else {
    title = '진행 중인 팀의 정답이 화면에 표시됩니다. 계속할까요?';
    body = [];
    okLabel = '정답 보기';
    okClass = 'cbtn--warning';
    const setId = confirm.setId;
    onOk = () => {
      ctx.local.confirm = null;
      ctx.local.revealedSetId = setId;
      ctx.local.reviewSetId = setId;
      ctx.rerender();
    };
  }
  const cancelBtn = h('button', { class: 'cbtn', attrs: { type: 'button' }, on: { click: cancel } }, '취소');
  const el = h('div', { class: 'scrim scrim--console', on: { click: (e) => { if (e.target === el) cancel(); } } },
    h('div', { class: `c-modal c-modal--${confirm.kind}`, attrs: { role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': 'confirm-title' } },
      h('h2', { class: 'c-title', attrs: { id: 'confirm-title' } }, title),
      body.length ? h('p', { class: 'c-hint' }, ...body) : null,
      h('div', { class: 'c-row c-row--end' },
        cancelBtn,
        h('button', { class: `cbtn ${okClass}`, attrs: { type: 'button' }, on: { click: onOk } }, okLabel),
      ),
    ),
  );
  queueMicrotask(() => cancelBtn.focus());
  return el;
}
