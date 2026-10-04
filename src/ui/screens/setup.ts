// 담당: dream-f4 — 초기 설정: 문제 JSON/CSV 가져오기 → 팀 수(기본 8) → 팀명 → 등록
// 말씀(세트)은 팀이 기차역 갈림길에서 직접 고르므로 여기서 연결하지 않는다.
import type { GameState } from '../../types';
import { TRACK_COUNT } from '../../types';
import type { UiState } from '../ui';
import type { Ctx, Screen, SetupRowDraft } from '../context';
import { MAX_TEAMS } from '../context';
import { h } from '../dom';
import { brand } from '../brand';
import { editLockReason } from './admin';

const DEFAULT_TEAM_COUNT = 8;

function initialDraft(state: GameState): NonNullable<Ctx['local']['setup']> {
  if (state.teams.length > 0) {
    return {
      count: state.teams.length,
      rows: state.teams.map((t) => ({ name: t.name })),
      parseError: null,
    };
  }
  return { count: DEFAULT_TEAM_COUNT, rows: [], parseError: null };
}

/** 빈 행 채우기 */
function normalizeRows(rows: SetupRowDraft[], count: number): void {
  while (rows.length < count) rows.push({ name: '' });
}

/** UTF-8 우선, 실패하면 CP949(엑셀 기본 'CSV' 저장)로 다시 읽는다 */
function decodeText(buf: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder('euc-kr').decode(buf);
  }
}

export function createSetupScreen(ctx: Ctx): Screen {
  let state: GameState | null = null;
  let ui: UiState | null = null;
  let rowsKey = '';

  const fileInput = h('input', {
    class: 'sr-only',
    attrs: { type: 'file', accept: '.json,.csv,application/json,text/csv', tabindex: -1 },
    on: { change: () => void importFile() },
  });
  const contentInfo = h('div', { class: 'content-info' });
  const importBtn = h('button', {
    class: 'btn btn--block btn--stacked',
    attrs: { type: 'button' },
    on: { click: () => fileInput.click() },
  },
    h('span', { class: 'btn__label' }, '📂 문제 파일 가져오기'),
    h('span', { class: 'btn__sub' }, 'JSON · CSV'),
  );
  const countValue = h('div', { class: 'stepper__value', attrs: { 'aria-live': 'polite' } });
  const minus = h('button', { class: 'btn', attrs: { type: 'button', 'aria-label': '팀 수 줄이기' }, on: { click: () => setCount(-1) } }, '−');
  const plus = h('button', { class: 'btn', attrs: { type: 'button', 'aria-label': '팀 수 늘리기' }, on: { click: () => setCount(1) } }, '+');
  const lockNote = h('div', { class: 'lock-note' });
  const issues = h('div');
  const rows = h('div', { class: 'team-rows' });
  const submit = h('button', {
    class: 'btn btn--primary btn--large',
    attrs: { type: 'button' },
    on: { click: () => register() },
  }, '등록 완료');
  const cancel = h('button', {
    class: 'btn',
    attrs: { type: 'button' },
    on: { click: () => ctx.actions.setView(state?.teams.length ? 'teams' : 'admin') },
  }, '취소');

  const el = h('section', { class: 'screen' },
    h('header', { class: 'topbar' },
      brand(),
      h('h1', { class: 'page__title' }, '초기 설정'),
      h('div', { class: 'topbar__right' }, cancel),
    ),
    h('div', { class: 'page' },
      h('div', { class: 'setup' },
        h('div', { class: 'setup__side' },
          h('section', { class: 'panel' },
            h('h3', { class: 'panel__title' }, '1. 문제 데이터'),
            contentInfo,
            h('div', { class: 'panel__row' }, importBtn, fileInput),
            h('p', { class: 'panel__desc' },
              h('a', { class: 'link', attrs: { href: './content-template.csv', download: true } }, 'CSV 템플릿 받기')),
          ),
          h('section', { class: 'panel' },
            h('h3', { class: 'panel__title' }, '2. 팀 수'),
            h('div', { class: 'stepper' }, minus, countValue, plus),
          ),
          lockNote,
          issues,
          h('div', { class: 'setup__actions' }, submit),
        ),
        h('div', { class: 'setup__main' },
          h('div', { class: 'page__head' }, h('h3', { class: 'panel__title' }, '3. 팀 이름')),
          rows,
        ),
      ),
    ),
  );

  function draft() {
    if (!ctx.local.setup) ctx.local.setup = initialDraft(state!);
    return ctx.local.setup;
  }

  function setCount(d: number): void {
    const dr = draft();
    dr.count = Math.min(MAX_TEAMS, Math.max(1, dr.count + d));
    ctx.rerender();
  }

  async function importFile(): Promise<void> {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (!file) return;
    const dr = draft();
    const text = decodeText(await file.arrayBuffer());
    if (/\.csv$/i.test(file.name)) {
      // CSV는 문자열 그대로 넘기고 해석은 app이 한다
      dr.parseError = null;
      ctx.actions.importContent(text);
      ctx.rerender();
      return;
    }
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch (e) {
      dr.parseError = `${file.name}: JSON 형식이 아닙니다 (${e instanceof Error ? e.message : String(e)})`;
      ctx.rerender();
      return;
    }
    dr.parseError = null;
    ctx.actions.importContent(json);
    ctx.rerender();
  }

  function register(): void {
    const dr = draft();
    ctx.actions.registerTeams(
      dr.rows.slice(0, dr.count).map((r) => ({ name: r.name.trim() })),
    );
  }

  function buildRows(locked: boolean): void {
    const dr = draft();
    rows.replaceChildren(
      ...dr.rows.slice(0, dr.count).map((r, i) => {
        const nameInput = h('input', {
          class: 'field',
          attrs: { type: 'text', value: r.name, placeholder: `팀 ${i + 1} 이름`, maxlength: 20, disabled: locked, 'aria-label': `팀 ${i + 1} 이름` },
          on: { input: () => { r.name = nameInput.value; } },
        });
        return h('div', { class: 'team-row' }, h('div', { class: 'team-row__num' }, i + 1), nameInput);
      }),
    );
  }

  return {
    el,
    update(s, u) {
      state = s;
      ui = u;
      const dr = draft();
      const sets = s.questionSets;
      const lock = editLockReason(s);
      const locked = !!lock;
      normalizeRows(dr.rows, dr.count);

      contentInfo.replaceChildren(
        h('b', null, sets.length ? `말씀 ${sets.length} / ${TRACK_COUNT}개 불러옴` : '불러온 문제가 없습니다'),
        sets.length > 0 && sets.length !== TRACK_COUNT ? `기차역 갈림길은 ${TRACK_COUNT}개입니다` : '',
      );
      importBtn.disabled = locked;
      minus.disabled = locked || dr.count <= 1;
      plus.disabled = locked || dr.count >= MAX_TEAMS;
      countValue.textContent = String(dr.count);
      lockNote.replaceChildren(lock ? `🔒 ${lock}` : '');
      cancel.hidden = s.teams.length === 0;
      submit.disabled = locked || sets.length === 0;

      // 입력 중 포커스를 잃지 않도록 행 구성이 바뀔 때만 다시 만든다
      const key = `${dr.count}|${locked}`;
      if (key !== rowsKey) {
        rowsKey = key;
        buildRows(locked);
      }

      const all = [
        ...(dr.parseError ? [{ location: '파일', message: dr.parseError }] : []),
        ...(ui?.issues ?? []),
      ];
      issues.replaceChildren(
        all.length
          ? h('div', { class: 'issues', attrs: { role: 'alert' } },
              h('p', { class: 'issues__title' }, `확인할 문제 ${all.length}건`),
              h('ul', null, all.map((x) => h('li', null, h('b', null, x.location), x.message))),
            )
          : '',
      );
    },
  };
}
