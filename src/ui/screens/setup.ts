// 담당: dream-2a — 관리 화면: 팀 수(±) · 팀 이름 · 말씀 1~10개(출처·구절·문제 4개, 추가·삭제) → 저장 하나.
// 기존 값으로 미리 채운다. 기록(진행·결과)이 있으면 확인 모달을 거쳐 saveSetup을 부른다 (app이 기록 초기화 후 home으로).
import type { GameState } from '../../types';
import { TRACK_COUNT } from '../../types';
import { emptyScriptureDraft, scriptureDraftOf } from '../../core/engine';
import type { ScriptureDraft } from '../../core/engine';
import type { Ctx, Screen, SetupForm } from '../context';
import { h } from '../dom';

const DEFAULT_TEAM_COUNT = 8;
/** 오류 상자는 처음 몇 건만 — 많아도 말씀 목록을 가리지 않게 */
const MAX_ISSUES = 3;

function formFrom(state: GameState): SetupForm {
  return {
    teamNames: state.teams.length
      ? state.teams.map((t) => t.name)
      : Array.from({ length: Math.min(DEFAULT_TEAM_COUNT, state.questionSets.length) }, () => ''),
    scriptures: state.questionSets.map(scriptureDraftOf),
  };
}

/** 팀 수 상한 = 말씀(갈림길) 수. 팀이 더 많으면 저장 검증에서 거부된다 */
function maxTeams(form: SetupForm): number {
  return Math.max(1, form.scriptures.length);
}

function hasRecords(state: GameState): boolean {
  return !!state.progress || state.results.length > 0;
}

export function createSetupScreen(ctx: Ctx): Screen {
  let state: GameState | null = null;
  let teamsKey = '';
  /** 말씀 추가·삭제 때마다 증가 → 말씀 목록을 다시 만든다 */
  let scripturesVersion = 0;
  let builtVersion = -1;
  /** 펼쳐 둔 말씀 (다시 만들어도 유지) */
  const opened = new WeakSet<ScriptureDraft>();
  let radioSeq = 0;

  const countValue = h('div', { class: 'stepper__value', attrs: { 'aria-live': 'polite' } });
  const minus = h('button', { class: 'btn', attrs: { type: 'button', 'aria-label': '팀 수 줄이기' }, on: { click: () => setCount(-1) } }, '−');
  const plus = h('button', { class: 'btn', attrs: { type: 'button', 'aria-label': '팀 수 늘리기' }, on: { click: () => setCount(1) } }, '+');
  const teamRows = h('div', { class: 'team-rows' });
  const scriptureRows = h('div', { class: 'scripture-rows' });
  const scriptureTitle = h('h3', { class: 'panel__title' });
  const addScripture = h('button', { class: 'btn btn--small', attrs: { type: 'button' }, on: { click: () => onAdd() } }, '+ 말씀 추가');
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
          h('div', { class: 'setup__head' }, scriptureTitle, h('span', { class: 'setup__hint' }, '보기 앞 ● = 정답'), addScripture),
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
    const next = Math.min(maxTeams(form()), Math.max(1, names.length + d));
    while (names.length < next) names.push('');
    names.length = next;
    ctx.rerender();
  }

  function onSave(): void {
    const f = form();
    const draft = { teamNames: f.teamNames.map((n) => n.trim()), scriptures: structuredClone(f.scriptures) };
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

  function onAdd(): void {
    const list = form().scriptures;
    if (list.length >= TRACK_COUNT) return;
    const d = emptyScriptureDraft();
    list.push(d);
    opened.add(d);
    scripturesVersion++;
    ctx.rerender();
    const card = scriptureRows.lastElementChild as HTMLElement | null;
    card?.scrollIntoView({ block: 'nearest' });
    card?.querySelector<HTMLInputElement>('input')?.focus();
  }

  function onRemove(d: ScriptureDraft): void {
    const list = form().scriptures;
    list.splice(list.indexOf(d), 1);
    scripturesVersion++;
    ctx.rerender();
  }

  function buildScriptures(): void {
    const list = form().scriptures;
    scriptureRows.replaceChildren(...list.map((s, i) => {
      const summaryRef = h('span', { class: 'scripture-card__ref' });
      const showRef = () => { summaryRef.textContent = s.scriptureReference.trim() || '새 말씀'; };
      showRef();
      const ref = h('input', {
        class: 'field',
        attrs: { type: 'text', value: s.scriptureReference, placeholder: '출처 (예: 시편 23:1)', maxlength: 40, 'aria-label': `말씀 ${i + 1} 출처` },
        on: { input: () => { s.scriptureReference = ref.value; showRef(); } },
      });
      const text = h('textarea', {
        class: 'field field--area',
        attrs: { rows: 2, placeholder: '구절', 'aria-label': `말씀 ${i + 1} 구절` },
        on: { input: () => { s.scriptureText = text.value; } },
      });
      text.value = s.scriptureText;
      const remove = h('button', { class: 'btn btn--small btn--ghost', attrs: { type: 'button' }, on: { click: () => onRemove(s) } }, '이 말씀 삭제');

      const card = h('details', { class: 'scripture-card', on: { toggle: () => { if (card.open) opened.add(s); else opened.delete(s); } } },
        h('summary', { class: 'scripture-card__summary' }, h('span', { class: 'team-row__num' }, i + 1), summaryRef),
        h('div', { class: 'scripture-row' }, ref, text),
        s.questions.map((q, qi) => questionEditor(q, `말씀 ${i + 1} 문제 ${qi + 1}`, qi + 1)),
        h('div', { class: 'scripture-card__foot' }, remove),
      );
      card.open = opened.has(s);
      return card;
    }));
  }

  /** 문제 하나: 문장 + 보기 5칸, 보기 앞 동그라미로 정답 선택 */
  function questionEditor(q: ScriptureDraft['questions'][number], label: string, num: number): HTMLElement {
    const name = `answer-${radioSeq++}`;
    const prompt = h('input', {
      class: 'field',
      attrs: { type: 'text', value: q.prompt, placeholder: '문장 — 빈칸은 ___ (예: 네 ___를 다하라)', 'aria-label': `${label} 문장` },
      on: { input: () => { q.prompt = prompt.value; } },
    });
    return h('div', { class: 'q-edit' },
      h('div', { class: 'q-edit__num' }, `문제 ${num}`),
      prompt,
      h('div', { class: 'q-edit__choices' }, q.choices.map((c, ci) => {
        const radio = h('input', {
          attrs: { type: 'radio', name, 'aria-label': `${label} 정답 ${ci + 1}번` },
          on: { change: () => { q.answer = ci + 1; } },
        });
        radio.checked = q.answer === ci + 1;
        const input = h('input', {
          class: 'field',
          attrs: { type: 'text', value: c, placeholder: `보기 ${ci + 1}`, 'aria-label': `${label} 보기 ${ci + 1}` },
          on: { input: () => { q.choices[ci] = input.value; } },
        });
        return h('div', { class: 'q-edit__choice', attrs: { title: '동그라미 = 정답' } }, radio, input);
      })),
    );
  }

  return {
    el,
    update(s, ui) {
      state = s;
      const f = form();
      const n = f.teamNames.length;
      countValue.textContent = String(n);
      minus.disabled = n <= 1;
      plus.disabled = n >= maxTeams(f);
      cancel.hidden = s.teams.length === 0;

      // 입력 중 포커스를 잃지 않도록 행 구성이 바뀔 때만 다시 만든다
      if (String(n) !== teamsKey) { teamsKey = String(n); buildTeams(); }
      if (builtVersion !== scripturesVersion) { builtVersion = scripturesVersion; buildScriptures(); }
      scriptureTitle.textContent = `말씀 ${f.scriptures.length}/${TRACK_COUNT}`;
      addScripture.disabled = f.scriptures.length >= TRACK_COUNT;

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
