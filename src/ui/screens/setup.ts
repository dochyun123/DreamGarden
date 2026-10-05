// 담당: dream-2a — 관리 화면: 팀 수(±) · 팀 이름 · 말씀 10개(출처 한 줄 + 구절 여러 줄) → 저장 하나.
// 기존 값으로 미리 채운다. 기록(진행·결과)이 있으면 확인 모달을 거쳐 saveSetup을 부른다 (app이 기록 초기화 후 home으로).
import type { GameState } from '../../types';
import type { Ctx, Screen, SetupForm } from '../context';
import { h } from '../dom';

const DEFAULT_TEAM_COUNT = 8;
/** 오류 상자는 처음 몇 건만 — 많아도 말씀 목록을 가리지 않게 */
const MAX_ISSUES = 3;

function formFrom(state: GameState): SetupForm {
  return {
    teamNames: state.teams.length
      ? state.teams.map((t) => t.name)
      : Array.from({ length: Math.min(DEFAULT_TEAM_COUNT, maxTeams(state)) }, () => ''),
    scriptures: state.questionSets.map((s) => ({ scriptureReference: s.scriptureReference, scriptureText: s.scriptureText })),
  };
}

/** 팀 수 상한 = 말씀(갈림길) 수. 팀이 더 많으면 저장 검증에서 거부된다 */
function maxTeams(state: GameState): number {
  return Math.max(1, state.questionSets.length);
}

function hasRecords(state: GameState): boolean {
  return !!state.progress || state.results.length > 0;
}

export function createSetupScreen(ctx: Ctx): Screen {
  let state: GameState | null = null;
  let teamsKey = '';
  let scripturesKey = '';

  const countValue = h('div', { class: 'stepper__value', attrs: { 'aria-live': 'polite' } });
  const minus = h('button', { class: 'btn', attrs: { type: 'button', 'aria-label': '팀 수 줄이기' }, on: { click: () => setCount(-1) } }, '−');
  const plus = h('button', { class: 'btn', attrs: { type: 'button', 'aria-label': '팀 수 늘리기' }, on: { click: () => setCount(1) } }, '+');
  const teamRows = h('div', { class: 'team-rows' });
  const scriptureRows = h('div', { class: 'scripture-rows' });
  const issues = h('div');
  const save = h('button', { class: 'btn btn--primary btn--large', attrs: { type: 'button' }, on: { click: () => onSave() } }, '저장');
  const cancel = h('button', { class: 'btn', attrs: { type: 'button' }, on: { click: () => ctx.actions.setView('home') } }, '취소');

  const el = h('section', { class: 'screen' },
    h('header', { class: 'topbar' },
      h('div'),
      h('h1', { class: 'page__title' }, '관리'),
      h('div', { class: 'topbar__right' }, cancel),
    ),
    h('div', { class: 'page' },
      h('div', { class: 'setup' },
        h('div', { class: 'setup__side' },
          h('section', { class: 'panel' },
            h('h3', { class: 'panel__title' }, '팀 수'),
            h('div', { class: 'stepper' }, minus, countValue, plus),
          ),
          h('section', { class: 'panel setup__teams' },
            h('h3', { class: 'panel__title' }, '팀 이름'),
            teamRows,
          ),
        ),
        h('div', { class: 'setup__main' },
          h('h3', { class: 'panel__title' }, '말씀'),
          scriptureRows,
          issues,
          h('div', { class: 'setup__actions' }, save),
        ),
      ),
    ),
  );

  function form(): SetupForm {
    if (!ctx.local.setup) ctx.local.setup = formFrom(state!);
    return ctx.local.setup;
  }

  function setCount(d: number): void {
    const names = form().teamNames;
    const next = Math.min(maxTeams(state!), Math.max(1, names.length + d));
    while (names.length < next) names.push('');
    names.length = next;
    ctx.rerender();
  }

  function onSave(): void {
    const f = form();
    const draft = { teamNames: f.teamNames.map((n) => n.trim()), scriptures: f.scriptures.map((s) => ({ ...s })) };
    const go = () => ctx.actions.saveSetup(draft);
    if (state && hasRecords(state)) {
      ctx.local.confirm = { kind: 'save', onOk: go };
      ctx.rerender();
    } else {
      go();
    }
  }

  function buildTeams(): void {
    const names = form().teamNames;
    teamRows.replaceChildren(...names.map((name, i) => {
      const input = h('input', {
        class: 'field',
        attrs: { type: 'text', value: name, placeholder: `팀 ${i + 1}`, maxlength: 20, 'aria-label': `팀 ${i + 1} 이름` },
        on: { input: () => { names[i] = input.value; } },
      });
      return h('div', { class: 'team-row' }, h('div', { class: 'team-row__num' }, i + 1), input);
    }));
  }

  function buildScriptures(): void {
    const list = form().scriptures;
    scriptureRows.replaceChildren(...list.map((s, i) => {
      const ref = h('input', {
        class: 'field',
        attrs: { type: 'text', value: s.scriptureReference, placeholder: '출처 (예: 시편 23:1)', maxlength: 40, 'aria-label': `말씀 ${i + 1} 출처` },
        on: { input: () => { s.scriptureReference = ref.value; } },
      });
      const text = h('textarea', {
        class: 'field field--area',
        attrs: { rows: 2, placeholder: '구절', 'aria-label': `말씀 ${i + 1} 구절` },
        on: { input: () => { s.scriptureText = text.value; } },
      });
      text.value = s.scriptureText;
      return h('div', { class: 'scripture-row' }, h('div', { class: 'team-row__num' }, i + 1), ref, text);
    }));
  }

  return {
    el,
    update(s, ui) {
      state = s;
      const f = form();
      const n = f.teamNames.length;
      countValue.textContent = String(n);
      minus.disabled = n <= 1;
      plus.disabled = n >= maxTeams(s);
      cancel.hidden = s.teams.length === 0;

      // 입력 중 포커스를 잃지 않도록 행 구성이 바뀔 때만 다시 만든다
      if (String(n) !== teamsKey) { teamsKey = String(n); buildTeams(); }
      const sk = String(f.scriptures.length);
      if (sk !== scripturesKey) { scripturesKey = sk; buildScriptures(); }

      const list = ui.issues;
      issues.replaceChildren(
        list.length
          ? h('div', { class: 'issues', attrs: { role: 'alert' } },
              h('p', { class: 'issues__title' }, `확인할 것 ${list.length}건`),
              h('ul', null,
                list.slice(0, MAX_ISSUES).map((x) => h('li', null, h('b', null, x.location), x.message)),
                list.length > MAX_ISSUES ? h('li', { class: 'issues__more' }, `외 ${list.length - MAX_ISSUES}건`) : null,
              ),
            )
          : '',
      );
    },
  };
}
