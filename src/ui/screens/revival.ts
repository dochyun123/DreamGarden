// 패자부활전 — 모든 팀이 끝났는데 고르지 않은 말씀이 남았을 때.
// 1) 기차역처럼 남은 말씀 고르기 → 2) 문제를 시간 제한 없이 보여주고 '정답 공개'를 누르면 정답 표시 → '다음 문제'.
// 점수·목숨·연출 없음. 진행 중인 위치는 저장하지 않고(ctx.local.revival), 끝까지 푼 말씀만 저장해 다시 못 고르게 한다.
import type { GameState, QuestionSet } from '../../types';
import { revivalSetIds } from '../../core/engine';
import type { Ctx, Screen } from '../context';
import { h } from '../dom';
import { renderPrompt } from './question';

const LONG_PROMPT = 60;
const LONG_CHOICE = 26;

export function createRevivalScreen(ctx: Ctx): Screen {
  const el = h('section', { class: 'screen revival' });
  let key = '';

  const exit = (label: string) => h('button', {
    class: 'home__manage revival__exit',
    attrs: { type: 'button' },
    on: { click: () => { ctx.local.revival = null; ctx.actions.setView('home'); } },
  }, label);

  function renderPick(state: GameState): void {
    const open = new Set(revivalSetIds(state));
    el.className = 'screen revival station';
    el.replaceChildren(
      h('div', { class: 'st-bg', attrs: { 'aria-hidden': 'true' } },
        h('div', { class: 'st-lamps' }), h('div', { class: 'st-platform' }), h('div', { class: 'st-rails' })),
      h('header', { class: 'st-head' },
        h('h1', { class: 'st-team g-plate' }, '패자부활전'),
        h('p', { class: 'st-hint' }, '말씀을 고르세요')),
      h('div', { class: 'st-signs', attrs: { role: 'group', 'aria-label': '남은 말씀' } },
        ...state.questionSets.map((set, i) => {
          const taken = !open.has(set.id);
          return h('button', {
            class: `st-sign${taken ? ' is-taken' : ''}`,
            attrs: { type: 'button', disabled: taken, 'aria-label': `${i + 1}번 ${set.scriptureReference}${taken ? ' (끝남)' : ''}` },
            on: { click: () => { ctx.local.revival = { setId: set.id, index: 0, revealed: false }; ctx.rerender(); } },
          },
            h('span', { class: 'st-sign__num' }, i + 1),
            h('span', { class: 'st-sign__ref' }, set.scriptureReference),
            h('span', { class: 'st-sign__lamp' }));
        })),
      exit('◀ 나가기'),
    );
  }

  function renderQuestion(set: QuestionSet, index: number, revealed: boolean): void {
    const q = set.questions[index];
    const total = set.questions.length;
    const last = index >= total - 1;
    const next = () => {
      if (!revealed) ctx.local.revival = { setId: set.id, index, revealed: true };
      else if (!last) ctx.local.revival = { setId: set.id, index: index + 1, revealed: false };
      else { ctx.local.revival = null; ctx.actions.finishRevival(set.id); return; }
      ctx.rerender();
    };
    const longest = Math.max(...q.choices.map((c) => c.text.length));

    el.className = 'screen revival question';
    el.replaceChildren(
      h('div', { class: 'cab', attrs: { 'aria-hidden': 'true' } }, h('div', { class: 'cab__view' })),
      h('header', { class: 'q-head' },
        h('div', { class: 'q-left' },
          h('div', { class: 'q-round g-plate' },
            h('div', { class: 'q-round__label' }, `문제 ${index + 1} / ${total}`),
            h('div', { class: 'q-round__bar' }, ...Array.from({ length: total }, (_, i) =>
              h('span', { class: `q-round__cell${i < index ? ' is-done' : i === index ? ' is-now' : ''}` }))))),
        h('h1', { class: 'q-team g-plate' }, '패자부활전'),
        h('button', { class: 'g-btn g-btn--lamp revival__next', attrs: { type: 'button' }, on: { click: next } },
          !revealed ? '정답 공개' : last ? '완료 ▶' : '다음 문제 ▶')),
      h('div', { class: 'q-body q-enter' },
        h('div', { class: 'q-instruction' }, set.scriptureReference),
        h('p', { class: `q-prompt${q.prompt.length > LONG_PROMPT ? ' is-long' : ''}` }, '“', ...renderPrompt(q.prompt), '”')),
      h('div', { class: `choices revival__choices${revealed ? ' is-revealed' : ''}${longest > LONG_CHOICE ? ' is-long' : ''}` },
        ...q.choices.map((c, i) => h('div', { class: `choice${revealed && c.id === q.correctChoiceId ? ' is-answer' : ''}` },
          h('span', { class: 'choice__num' }, i + 1),
          h('span', { class: 'choice__text' }, c.text)))),
      exit('◀ 그만하기'),
    );
  }

  return {
    el,
    update(state) {
      const r = ctx.local.revival;
      const set = r ? state.questionSets.find((s) => s.id === r.setId) : undefined;
      if (r && set?.questions[r.index]) {
        const k = `q|${r.setId}|${r.index}|${r.revealed}`;
        if (k !== key) { key = k; renderQuestion(set, r.index, r.revealed); }
        return;
      }
      ctx.local.revival = null;
      if (revivalSetIds(state).length === 0) { ctx.actions.setView('home'); return; }
      const k = `pick|${(state.revivalDoneSetIds ?? []).join(',')}`;
      if (k !== key) { key = k; renderPick(state); }
    },
  };
}
