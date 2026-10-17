// 담당: dream-2a — home(게임 시작 화면). 시작 화면 장면 그대로 + 큰 '게임 시작' 버튼.
// 누르면 아직 도전하지 않은 팀 버튼이 펼쳐지고, 팀을 누르면 startChallenge. 진행 중인 도전이 있으면 '도전으로 돌아가기'.
// 구석의 작은 ⚙ 관리 → setup.
import type { GameState } from '../../types';
import type { Ctx, Screen } from '../context';
import { h } from '../dom';
import { gearIcon } from '../icons';
import { pixelTrain, titleScene } from './start';

export function createHomeScreen(ctx: Ctx): Screen {
  const a = ctx.actions;
  const actionsBox = h('div', { class: 'home__actions' });
  const manage = h('button', {
    class: 'home__manage',
    attrs: { type: 'button', 'aria-label': '설정', title: '설정' },
    on: { click: () => { ctx.local.pickingTeam = false; a.setView('setup'); } },
  }, gearIcon(), h('span', null, '설정'));
  const el = h('section', { class: 'screen start home' }, ...titleScene(), actionsBox, pixelTrain(), manage);

  const pick = (on: boolean) => () => { ctx.local.pickingTeam = on; ctx.rerender(); };

  function mainButtons(state: GameState): HTMLElement[] {
    const p = state.progress;
    if (p) {
      const team = state.teams.find((t) => t.id === p.activeTeamId);
      return [h('button', { class: 'g-btn g-btn--lamp', attrs: { type: 'button' }, on: { click: () => a.returnToChallenge() } },
        `▶ ${team?.name ?? ''} 도전으로 돌아가기`)];
    }
    if (state.teams.length === 0) {
      return [h('button', { class: 'g-btn g-btn--lamp', attrs: { type: 'button' }, on: { click: () => a.setView('setup') } }, '팀 등록하기')];
    }
    const left = state.teams.filter((t) => t.status === 'notStarted').length;
    if (left === 0) return [h('div', { class: 'home__done g-plate' }, '모든 팀 완료')];
    return [h('button', { class: 'g-btn g-btn--lamp', attrs: { type: 'button' }, on: { click: pick(true) } }, '▶ 게임 시작')];
  }

  function teamButtons(state: GameState): HTMLElement[] {
    return [
      h('div', { class: `home__teams${state.teams.length > 8 ? ' is-wide' : ''}` },
        state.teams.map((t) => {
          const done = t.status !== 'notStarted';
          return h('button', {
            class: `g-btn home__team${done ? ' is-done' : ''}`,
            attrs: { type: 'button', disabled: done, 'aria-label': done ? `${t.name} (완료)` : t.name },
            on: { click: () => { ctx.local.pickingTeam = false; a.startChallenge(t.id); } },
          }, t.name);
        }),
      ),
      h('button', { class: 'g-btn home__back', attrs: { type: 'button' }, on: { click: pick(false) } }, '◀ 뒤로'),
    ];
  }

  return {
    el,
    update(state) {
      const picking = ctx.local.pickingTeam && !state.progress && state.teams.some((t) => t.status === 'notStarted');
      if (!picking) ctx.local.pickingTeam = false;
      el.classList.toggle('is-picking', picking);
      actionsBox.replaceChildren(...(picking ? teamButtons(state) : mainButtons(state)));
    },
  };
}
