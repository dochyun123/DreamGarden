// 담당: dream-f4 — 시작 화면. 버튼 클릭 = 전체화면 + 오디오 활성화 (actions.start)
import type { Ctx, Screen } from '../context';
import { h } from '../dom';

export function createStartScreen(ctx: Ctx): Screen {
  const button = h('button', {
    class: 'btn btn--primary btn--large',
    attrs: { type: 'button' },
    on: { click: () => ctx.actions.start() },
  });
  const hint = h('div', { class: 'start__hint' });
  const el = h('section', { class: 'screen start' },
    h('div', { class: 'start__eyebrow' }, '말씀 암송'),
    h('h1', { class: 'start__title' }, '말씀 퀴즈쇼'),
    h('div', { class: 'start__sub' }, '말씀 하나, 다섯 문제, 목숨 세 개!'),
    button,
    hint,
  );
  return {
    el,
    update(_state, ui) {
      button.textContent = ui.hasSavedGame ? '▶ 이어하기' : '▶ 시작';
      hint.textContent = ui.hasSavedGame
        ? '저장된 진행을 불러와 멈춘 곳부터 이어서 진행합니다 · 전체화면으로 전환됩니다'
        : '버튼을 누르면 전체화면으로 전환되고 소리가 켜집니다';
      queueMicrotask(() => button.focus());
    },
  };
}
