// 담당: dream-f4 — 관리 기능. 상단 탭의 관리 화면과 문제 화면 관리 메뉴(오버레이)가 같은 컴포넌트를 쓴다.
// 정답·말씀 원문은 '문제 세트 검수' 하위 화면에서만 표시한다.
import type { GameState } from '../../types';
import { lastUndoLabel } from '../../core/engine';
import type { UiState } from '../ui';
import type { Ctx, Screen } from '../context';
import { h } from '../dom';
import { renderPrompt } from './question';

type Mode = 'page' | 'menu';

/** 편집(팀·문제 변경) 잠금 사유. null이면 편집 가능 */
export function editLockReason(state: GameState): string | null {
  if (state.progress) return '진행 중인 도전이 있어 팀·문제를 바꿀 수 없습니다.';
  if (state.results.length > 0) return '완료 기록이 있어 잠겨 있습니다. 전체 기록 초기화 후 바꿀 수 있습니다.';
  return null;
}

export function noticeBanner(ui: UiState): HTMLElement | null {
  if (!ui.notice) return null;
  return h('div', { class: 'notice', attrs: { role: 'alert' } }, h('span', { class: 'notice__icon' }, '!'), ui.notice);
}

function panel(title: string, desc: string | null, ...children: (HTMLElement | null)[]): HTMLElement {
  return h('section', { class: 'panel' },
    h('h3', { class: 'panel__title' }, title),
    desc ? h('p', { class: 'panel__desc' }, desc) : null,
    ...children,
  );
}

function widePanel(title: string, desc: string | null, ...children: (HTMLElement | null)[]): HTMLElement {
  const el = panel(title, desc, ...children);
  el.classList.add('panel--wide');
  return el;
}

/** 공용 관리 컨트롤 묶음 */
function createAdminControls(ctx: Ctx, mode: Mode): Screen {
  const el = h('div', { class: 'admin' });
  const a = ctx.actions;

  // 음량 슬라이더는 드래그 중 다시 그려지면 끊기므로 계속 재사용한다
  const volumeValue = h('span', { class: 'volume__value' });
  const volumeInput = h('input', {
    attrs: { type: 'range', min: 0, max: 100, step: 5, 'aria-label': '음량' },
    on: {
      input: () => {
        volumeValue.textContent = `${volumeInput.value}%`;
        a.setVolume(Number(volumeInput.value) / 100);
      },
    },
  });
  const volumeRow = h('div', { class: 'volume' }, h('span', null, '음량'), volumeInput, volumeValue);

  return {
    el,
    update(state, ui) {
      const p = state.progress;
      const animating = !!p && p.phase !== 'awaitingAnswer';
      const label = lastUndoLabel(state);
      const lock = editLockReason(state);
      const parts: (HTMLElement | null)[] = [];

      if (ui.animationStuck || animating) {
        parts.push(h('div', { class: 'notice notice--stuck panel--wide' },
          h('span', null, ui.animationStuck ? '연출이 재생되지 않고 있습니다. 건너뛰고 진행하세요.' : '연출 재생 중입니다.'),
          h('button', {
            class: `btn ${ui.animationStuck ? 'btn--warning' : ''}`,
            attrs: { type: 'button' },
            on: { click: () => a.skipAnimation() },
          }, '연출 건너뛰기 ▶▶'),
        ));
      }

      parts.push(panel('되돌리기', '도전 시작과 답 선택을 한 단계씩 되돌립니다.',
        h('div', { class: `undo-label${label ? '' : ' is-empty'}` }, label ? `마지막 행동: ${label}` : '되돌릴 행동이 없습니다'),
        h('div', { class: 'panel__row' },
          h('button', {
            class: 'btn btn--primary',
            attrs: { type: 'button', disabled: !label },
            on: { click: () => a.undo() },
          }, '↶ 직전 행동 되돌리기'),
        ),
      ));

      if (document.activeElement !== volumeInput) {
        const v = Math.round(ui.volume * 100);
        volumeInput.value = String(v);
        volumeValue.textContent = `${v}%`;
      }
      parts.push(panel('소리 · 화면', null,
        volumeRow,
        h('div', { class: 'panel__row' },
          h('button', {
            class: 'btn',
            attrs: { type: 'button', disabled: ui.isFullscreen },
            on: { click: () => a.enterFullscreen() },
          }, ui.isFullscreen ? '전체화면 사용 중' : '전체화면 다시 켜기'),
        ),
      ));

      if (mode === 'menu') {
        const go = (fn: () => void) => () => { a.closeAdminMenu(); fn(); };
        parts.push(widePanel('이동', '현재 도전은 그대로 보존됩니다.',
          h('div', { class: 'panel__row' },
            ui.view !== 'question' && p
              ? h('button', { class: 'btn btn--primary', attrs: { type: 'button' }, on: { click: go(() => a.returnToChallenge()) } }, '도전 화면으로')
              : null,
            h('button', { class: 'btn', attrs: { type: 'button' }, on: { click: go(() => a.setView('teams')) } }, '팀 선택'),
            h('button', { class: 'btn', attrs: { type: 'button' }, on: { click: go(() => a.setView('leaderboard')) } }, '리더보드'),
            h('button', { class: 'btn', attrs: { type: 'button' }, on: { click: go(() => a.setView('admin')) } }, '관리 화면'),
          ),
        ));
      } else {
        parts.push(panel('문제 · 팀', `문제 데이터 ${state.questionSets.length}세트 · 팀 ${state.teams.length}개 · 버전 ${state.contentVersion || '-'}`,
          h('div', { class: 'panel__row' },
            h('button', {
              class: 'btn',
              attrs: { type: 'button', disabled: state.questionSets.length === 0 },
              on: { click: () => { ctx.local.adminSub = 'review'; ctx.rerender(); } },
            }, '문제 세트 검수'),
            h('button', {
              class: 'btn',
              attrs: { type: 'button', disabled: !!lock },
              on: { click: () => a.setView('setup') },
            }, '팀 · 문제 설정 변경'),
          ),
          lock ? h('div', { class: 'lock-note' }, '🔒 ', lock) : null,
        ));
        const hasRecords = !!p || state.results.length > 0 || state.undoHistory.length > 0;
        parts.push(panel('전체 기록 초기화', '진행·결과·되돌리기 기록을 지웁니다. 팀명과 문제 연결은 유지됩니다.',
          h('div', { class: 'panel__row' },
            h('button', {
              class: 'btn btn--danger',
              attrs: { type: 'button', disabled: !hasRecords },
              on: { click: () => { ctx.local.confirm = { kind: 'reset' }; ctx.rerender(); } },
            }, '기록 초기화…'),
          ),
        ));
      }

      el.replaceChildren(...parts.filter((x): x is HTMLElement => !!x));
    },
  };
}

/** 진행 중인 팀의 문제 세트 id */
function activeSetId(state: GameState): string | null {
  const p = state.progress;
  if (!p) return null;
  return state.teams.find((t) => t.id === p.activeTeamId)?.questionSetId ?? null;
}

/** 문제 세트 검수 — 실제 출제 순서대로, 정답 표시 */
function createReview(ctx: Ctx): Screen {
  const el = h('div', { class: 'review' });
  return {
    el,
    update(state) {
      const sets = state.questionSets;
      const active = activeSetId(state);
      // 처음 열 때는 진행 중인 팀의 세트를 피해서 고른다
      const current = sets.find((s) => s.id === ctx.local.reviewSetId)
        ?? sets.find((s) => s.id !== active) ?? sets[0];
      if (!current) { el.replaceChildren(h('div', { class: 'empty' }, '문제 데이터가 없습니다')); return; }
      ctx.local.reviewSetId = current.id;
      const hidden = current.id === active && ctx.local.revealedSetId !== active;
      const askReveal = () => { ctx.local.confirm = { kind: 'reveal', setId: current.id }; ctx.rerender(); };
      const teamsOf = (setId: string) => state.teams.filter((t) => t.questionSetId === setId).map((t) => t.name);

      el.replaceChildren(
        h('div', { class: 'review__list' },
          sets.map((s) => {
            const teams = teamsOf(s.id);
            return h('button', {
              class: `review__item${s.id === current.id ? ' is-active' : ''}`,
              attrs: { type: 'button' },
              on: {
                click: () => {
                  if (s.id === active && ctx.local.revealedSetId !== active) {
                    ctx.local.confirm = { kind: 'reveal', setId: s.id };
                  } else {
                    ctx.local.reviewSetId = s.id;
                  }
                  ctx.rerender();
                },
              },
            },
              h('b', null, s.scriptureReference, s.id === active ? h('span', { class: 'tag tag--live' }, '진행 중') : null),
              h('span', null, `${s.id} · ${teams.length ? teams.join(', ') : '연결된 팀 없음'}`),
            );
          }),
        ),
        hidden
          ? h('div', { class: 'review__detail' },
              h('div', { class: 'empty' },
                '진행 중인 팀의 세트라 정답을 가려 두었습니다',
                h('button', { class: 'btn btn--warning', attrs: { type: 'button' }, on: { click: askReveal } }, '정답 보기…'),
              ),
            )
          : h('div', { class: 'review__detail' },
          h('div', { class: 'review__scripture' },
            h('h3', null, current.scriptureReference),
            h('p', null, current.scriptureText),
          ),
          current.questions.map((q, qi) =>
            h('div', { class: 'review__q' },
              h('p', { class: 'review__q-prompt' }, `${qi + 1}. `, ...renderPrompt(q.prompt)),
              h('ol', { class: 'review__choices' },
                q.choices.map((c, ci) =>
                  h('li', { class: c.id === q.correctChoiceId ? 'is-correct' : '' },
                    h('b', null, `${ci + 1}`),
                    c.text,
                    c.id === q.correctChoiceId ? ' ✔ 정답' : '',
                  ),
                ),
              ),
            ),
          ),
        ),
      );
    },
  };
}

/** 상단 탭의 관리 화면 */
export function createAdminBody(ctx: Ctx): Screen {
  const el = h('div', { class: 'page' });
  const controls = createAdminControls(ctx, 'page');
  const review = createReview(ctx);
  return {
    el,
    update(state, ui) {
      if (ctx.local.adminSub === 'review') {
        review.update(state, ui);
        el.replaceChildren(
          h('div', { class: 'page__head' },
            h('h2', { class: 'page__title' }, '문제 세트 검수'),
            h('button', {
              class: 'btn btn--small',
              attrs: { type: 'button' },
              on: { click: () => { ctx.local.adminSub = 'main'; ctx.rerender(); } },
            }, '← 관리로 돌아가기'),
          ),
          review.el,
        );
        return;
      }
      controls.update(state, ui);
      el.replaceChildren(
        h('div', { class: 'page__head' }, h('h2', { class: 'page__title' }, '관리')),
        noticeBanner(ui) ?? '',
        controls.el,
      );
    },
  };
}

/** 문제 화면 등에서 여는 관리 메뉴 오버레이 */
export function createAdminMenu(ctx: Ctx): Screen {
  const controls = createAdminControls(ctx, 'menu');
  const notice = h('div');
  const sheet = h('div', { class: 'sheet', attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': '관리 메뉴' } },
    h('div', { class: 'sheet__head' },
      h('div', null,
        h('h2', { class: 'sheet__title' }, '관리 메뉴'),
        h('div', { class: 'sheet__sub' }, '메뉴가 열려 있는 동안 답 입력과 연출이 멈춥니다.'),
      ),
      h('button', {
        class: 'btn btn--primary',
        attrs: { type: 'button' },
        on: { click: () => ctx.actions.closeAdminMenu() },
      }, '닫고 계속하기 ✕'),
    ),
    notice,
    controls.el,
  );
  const el = h('div', {
    class: 'scrim',
    on: { click: (e) => { if (e.target === el) ctx.actions.closeAdminMenu(); } },
  }, sheet);
  return {
    el,
    update(state, ui) {
      notice.replaceChildren(noticeBanner(ui) ?? '');
      controls.update(state, ui);
    },
  };
}

/** 자체 확인 모달 (window.confirm 대신): 전체 기록 초기화, 진행 팀 정답 공개 */
export function createConfirmModal(ctx: Ctx, confirm: NonNullable<Ctx['local']['confirm']>, state: GameState): HTMLElement {
  const cancel = () => { ctx.local.confirm = null; ctx.rerender(); };
  let title: string;
  let body: (string | HTMLElement)[];
  let okLabel: string;
  let okClass: string;
  let onOk: () => void;
  if (confirm.kind === 'reset') {
    title = '전체 기록을 초기화할까요?';
    body = [
      '모든 팀의 진행 상황, 결과, 되돌리기 기록이 지워지고 모든 팀이 미도전으로 돌아갑니다.', h('br'),
      '팀명과 문제 연결은 유지됩니다. 이 작업은 되돌릴 수 없습니다.',
    ];
    okLabel = '초기화';
    okClass = 'btn--danger-solid';
    onOk = () => { ctx.local.confirm = null; ctx.actions.resetRecords(); ctx.rerender(); };
  } else {
    const p = state.progress;
    const team = p ? state.teams.find((t) => t.id === p.activeTeamId)?.name : null;
    title = '진행 중인 팀의 정답이 화면에 표시됩니다. 계속할까요?';
    body = [`${team ?? '진행 중인 팀'}의 문제 세트입니다. TV에 연결되어 있다면 참가자에게 정답이 보일 수 있습니다.`];
    okLabel = '정답 보기';
    okClass = 'btn--warning';
    const setId = confirm.setId;
    onOk = () => {
      ctx.local.confirm = null;
      ctx.local.revealedSetId = setId;
      ctx.local.reviewSetId = setId;
      ctx.rerender();
    };
  }
  const cancelBtn = h('button', { class: 'btn', attrs: { type: 'button' }, on: { click: cancel } }, '취소');
  const el = h('div', { class: 'scrim', on: { click: (e) => { if (e.target === el) cancel(); } } },
    h('div', { class: `modal modal--${confirm.kind}`, attrs: { role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': 'confirm-title' } },
      h('h2', { class: 'modal__title', attrs: { id: 'confirm-title' } }, title),
      h('p', { class: 'modal__body' }, ...body),
      h('div', { class: 'modal__actions' },
        cancelBtn,
        h('button', { class: `btn ${okClass}`, attrs: { type: 'button' }, on: { click: onOk } }, okLabel),
      ),
    ),
  );
  queueMicrotask(() => cancelBtn.focus());
  return el;
}
