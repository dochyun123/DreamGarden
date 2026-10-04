// 담당: dream-f4 — 지하 기차역: 갈림길(말씀) 10개 중 하나 고르기 (phase 'choosingTrack')
// 표지판에는 말씀 출처만 보인다. 다른 팀이 이미 고른 갈림길은 셔터가 내려가 고를 수 없다.
import type { GameState } from '../../types';
import type { UiState } from '../ui';
import type { Ctx, Screen } from '../context';
import { h } from '../dom';
import { gearIcon } from '../icons';

export function createStationScreen(ctx: Ctx): Screen {
  let state: GameState | null = null;
  let ui: UiState | null = null;
  /** 클릭 즉시 잠금 (연타 방지). 다음 render에서 풀린다 — 문제 화면 보기 잠금과 같은 방식 */
  let locked = false;
  let signsKey = '';

  const teamName = h('h1', { class: 'st-team g-plate' });
  const signs = h('div', { class: 'st-signs', attrs: { role: 'group', 'aria-label': '갈림길' } });
  const fab = h('button', {
    class: 'admin-fab',
    attrs: { type: 'button', 'aria-label': '관리 메뉴', title: '관리 메뉴' },
    on: { click: () => ctx.actions.openAdminMenu() },
  }, gearIcon());

  const el = h('section', { class: 'screen station' },
    h('div', { class: 'st-bg', attrs: { 'aria-hidden': 'true' } },
      h('div', { class: 'st-lamps' }),
      h('div', { class: 'st-platform' }),
      h('div', { class: 'st-rails' }),
    ),
    h('header', { class: 'st-head' }, teamName, h('p', { class: 'st-hint' }, '말씀을 고르세요')),
    signs,
    fab,
  );

  function isOpen(): boolean {
    return !locked && state?.progress?.phase === 'choosingTrack' && !ui?.adminMenuOpen;
  }

  function onPick(setId: string, btn: HTMLButtonElement): void {
    if (!isOpen() || btn.disabled) return;
    locked = true;
    btn.classList.add('is-picked');
    signs.classList.add('is-locked');
    ctx.actions.selectTrack(setId);
  }

  function buildSigns(s: GameState, activeTeamId: string): void {
    signs.replaceChildren(
      ...s.questionSets.map((set, i) => {
        const taken = s.teams.some((t) => t.id !== activeTeamId && t.questionSetId === set.id);
        const btn: HTMLButtonElement = h('button', {
          class: `st-sign${taken ? ' is-taken' : ''}`,
          attrs: { type: 'button', disabled: taken, 'aria-label': `${i + 1}번 갈림길 ${set.scriptureReference}${taken ? ' (선택됨)' : ''}` },
          on: { click: () => onPick(set.id, btn) },
        },
          h('span', { class: 'st-sign__num' }, i + 1),
          h('span', { class: 'st-sign__ref' }, set.scriptureReference),
          h('span', { class: 'st-sign__lamp' }),
        );
        return btn;
      }),
    );
  }

  return {
    el,
    update(s, u) {
      state = s;
      ui = u;
      locked = false;
      const p = s.progress;
      if (!p) return;
      teamName.textContent = s.teams.find((t) => t.id === p.activeTeamId)?.name ?? '';
      // 다른 팀의 선택이 바뀔 때만 다시 그린다
      const key = `${p.activeTeamId}|${s.questionSets.map((x) => x.id).join(',')}|${s.teams.map((t) => t.questionSetId ?? '').join(',')}`;
      if (key !== signsKey) {
        signsKey = key;
        buildSigns(s, p.activeTeamId);
      }
      signs.classList.toggle('is-locked', !isOpen());
      for (const b of signs.querySelectorAll('.is-picked')) b.classList.remove('is-picked');
      fab.classList.toggle('is-alert', u.animationStuck);
      fab.classList.toggle('has-notice', !!u.notice && !u.animationStuck);
    },
  };
}
