// 담당: dream-f4 — 시작 화면. 버튼 클릭 = 전체화면 + 오디오 활성화 (actions.start)
import type { Ctx, Screen } from '../context';
import { h } from '../dom';

export function createStartScreen(ctx: Ctx): Screen {
  const button = h('button', {
    class: 'btn btn--primary btn--large',
    attrs: { type: 'button' },
    on: { click: () => ctx.actions.start() },
  });
  const el = h('section', { class: 'screen start' },
    h('h1', { class: 'start__title' },
      h('span', { class: 'start__title-main' }, '드리가든이 가을을 보내는 법'),
      h('span', { class: 'start__title-accent' }, '암송'),
    ),
    button,
  );
  return {
    el,
    update(_state, ui) {
      button.textContent = ui.hasSavedGame ? '▶ 이어하기' : '▶ 시작';
      queueMicrotask(() => button.focus());
    },
  };
}
