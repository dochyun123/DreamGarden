// 담당: dream-f4 — 팀 선택 (4×2 카드, 페이지 나눔)
import type { GameState, Team } from '../../types';
import type { Ctx, Screen } from '../context';
import { TEAMS_PER_PAGE } from '../context';
import { h } from '../dom';

export function createTeamsBody(ctx: Ctx): Screen {
  const el = h('div', { class: 'page' });

  function card(state: GameState, team: Team, index: number): HTMLElement {
    const p = state.progress;
    const busy = !!p && p.activeTeamId !== team.id;
    const num = h('div', { class: 'team-card__num' }, `${index + 1}팀`);
    const name = h('div', { class: 'team-card__name' }, team.name);

    if (team.status === 'completed') {
      const r = state.results.find((x) => x.teamId === team.id);
      const passed = r?.passedCount ?? 0;
      const outcome = r?.outcome ?? 'failed';
      return h(
        'div',
        { class: `team-card team-card--completed is-${outcome}`, attrs: { 'aria-disabled': 'true' } },
        h('div', null, num, name),
        h('div', { class: 'team-card__status' }, `도전 완료 · ${passed}문제 통과`),
      );
    }

    if (team.status === 'inProgress') {
      return h(
        'button',
        {
          class: 'team-card team-card--inProgress',
          attrs: { type: 'button' },
          on: { click: () => ctx.actions.returnToChallenge() },
        },
        h('div', null, num, name),
        h('div', null,
          h('div', { class: 'team-card__status' }, '● 진행 중'),
          h('div', { class: 'team-card__cta' }, '눌러서 이어서 진행'),
        ),
      );
    }

    return h(
      'button',
      {
        class: 'team-card team-card--notStarted',
        attrs: { type: 'button', disabled: busy },
        on: { click: () => { if (!state.progress) ctx.actions.startChallenge(team.id); } },
      },
      h('div', null, num, name),
      h('div', null,
        h('div', { class: 'team-card__status' }, '미도전'),
        h('div', { class: 'team-card__cta' }, busy ? '진행 중인 도전이 끝나면 선택할 수 있어요' : '눌러서 도전 시작'),
      ),
    );
  }

  return {
    el,
    update(state) {
      const teams = state.teams;
      if (teams.length === 0) {
        el.replaceChildren(
          h('div', { class: 'empty' },
            '등록된 팀이 없습니다',
            h('button', {
              class: 'btn btn--primary',
              attrs: { type: 'button' },
              on: { click: () => ctx.actions.setView('setup') },
            }, '초기 설정으로'),
          ),
        );
        return;
      }

      const pages = Math.ceil(teams.length / TEAMS_PER_PAGE);
      const page = Math.min(Math.max(ctx.local.teamsPage, 0), pages - 1);
      ctx.local.teamsPage = page;
      const start = page * TEAMS_PER_PAGE;
      const visible = teams.slice(start, start + TEAMS_PER_PAGE);
      const done = teams.filter((t) => t.status === 'completed').length;

      const go = (d: number) => () => { ctx.local.teamsPage = page + d; ctx.rerender(); };
      const pager = pages > 1
        ? h('nav', { class: 'pager', attrs: { 'aria-label': '팀 페이지' } },
            h('button', { class: 'btn btn--small', attrs: { type: 'button', disabled: page === 0 }, on: { click: go(-1) } }, '◀ 이전'),
            h('div', { class: 'pager__dots' },
              Array.from({ length: pages }, (_, i) => h('span', { class: `pager__dot${i === page ? ' is-active' : ''}` }))),
            h('button', { class: 'btn btn--small', attrs: { type: 'button', disabled: page === pages - 1 }, on: { click: go(1) } }, '다음 ▶'),
          )
        : null;

      el.replaceChildren(
        h('div', { class: 'page__head' },
          h('h2', { class: 'page__title' }, '도전할 팀을 선택하세요'),
          h('div', { class: 'page__meta' }, `완료 ${done} / ${teams.length}팀`),
        ),
        h('div', { class: 'team-grid' }, visible.map((t, i) => card(state, t, start + i))),
        pager ?? '',
      );
    },
  };
}
