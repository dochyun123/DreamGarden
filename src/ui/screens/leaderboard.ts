// 담당: dream-f4 — 리더보드 (완료 팀만, 공동 순위)
import { QUESTIONS_PER_SET } from '../../types';
import { computeLeaderboard } from '../../core/leaderboard';
import type { Screen } from '../context';
import { h } from '../dom';

export function createLeaderboardBody(): Screen {
  const el = h('div', { class: 'page' });
  return {
    el,
    update(state) {
      const rows = computeLeaderboard(state);
      const head = h('div', { class: 'page__head' },
        h('h2', { class: 'page__title' }, '리더보드'),
        h('div', { class: 'page__meta' }, `완료 ${rows.length} / ${state.teams.length}팀`),
      );
      if (rows.length === 0) {
        el.replaceChildren(head, h('div', { class: 'empty' }, '아직 도전을 마친 팀이 없습니다'));
        return;
      }
      el.replaceChildren(
        head,
        h('div', { class: `board${rows.length > 8 ? ' board--compact' : ''}` },
          h('div', { class: 'board__head' }, h('span', null, '순위'), h('span', null, '팀'), h('span', null, '통과'), h('span', null, '결과')),
          h('div', { class: 'board__rows' },
            rows.map((r) =>
              h('div', { class: `board__row${r.rank === 1 ? ' is-top' : ''}` },
                h('span', { class: 'board__rank' }, `${r.rank}위`),
                h('span', null, r.teamName),
                h('span', { class: 'board__score' },
                  h('span', { class: 'pips' },
                    Array.from({ length: QUESTIONS_PER_SET }, (_, i) => h('span', { class: `pip${i < r.passedCount ? ' is-on' : ''}` }))),
                  `${r.passedCount}문제`,
                ),
                h('span', null, h('span', { class: `tag ${r.cleared ? 'tag--clear' : 'tag--failed'}` }, r.cleared ? '클리어' : '탈락')),
              ),
            ),
          ),
        ),
      );
    },
  };
}
