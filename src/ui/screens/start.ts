// 담당: dream-2a — 시작 화면. 버튼 클릭 = 전체화면 + 오디오 활성화 (actions.start). 밤하늘·제목·지하철 장면은 home과 같이 쓴다
import type { Ctx, Screen } from '../context';
import { h } from '../dom';

const NS = 'http://www.w3.org/2000/svg';

/** 픽셀 지하철 (옆모습, 1칸 = 1 viewBox 단위). 창문에 불이 켜진 객차 2량 + 선로 */
export function pixelTrain(): SVGSVGElement {
  const r = (x: number, y: number, w: number, hh: number, fill: string) =>
    `<rect x="${x}" y="${y}" width="${w}" height="${hh}" fill="${fill}"/>`;
  let out = '';
  // 선로: 침목 + 레일
  for (let x = 0; x < 240; x += 6) out += r(x, 37, 3, 2, '#2a2650');
  out += r(0, 36, 240, 1, '#8a84b8');
  for (let car = 0; car < 2; car++) {
    const x0 = 20 + car * 104;
    out += r(x0, 12, 100, 22, '#05040f'); // 외곽선
    out += r(x0 + 1, 13, 98, 20, '#3b74d6'); // 차체
    out += r(x0 + 1, 13, 98, 2, '#5b8ff0'); // 지붕 하이라이트
    out += r(x0 + 1, 27, 98, 2, '#ffd25a'); // 띠
    out += r(x0 + 1, 31, 98, 2, '#1f4fa8');
    for (let i = 0; i < 6; i++) out += r(x0 + 5 + i * 16, 17, 9, 7, '#ffd25a') + r(x0 + 5 + i * 16, 17, 9, 2, '#fff1b0');
    out += r(x0 + 10, 34, 6, 3, '#05040f') + r(x0 + 84, 34, 6, 3, '#05040f'); // 바퀴
  }
  // 앞머리 + 전조등
  out += r(124 + 100, 14, 4, 20, '#05040f') + r(124 + 99, 15, 4, 18, '#3b74d6') + r(124 + 101, 28, 2, 2, '#ffffff');
  const el = document.createElementNS(NS, 'svg');
  el.setAttribute('viewBox', '0 0 240 40');
  el.setAttribute('shape-rendering', 'crispEdges');
  el.setAttribute('class', 'start__train');
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = out;
  return el;
}

/** 별 + 제목 (시작 화면·home 공용). 지하철 그림은 맨 뒤에 따로 붙인다 */
export function titleScene(): HTMLElement[] {
  return [
    h('div', { class: 'start__stars', attrs: { 'aria-hidden': 'true' } }),
    h('h1', { class: 'start__title' },
      h('span', { class: 'start__title-main' }, '드리가든이 가을을 보내는 법'),
      h('span', { class: 'start__title-accent' }, '암송'),
    ),
  ];
}

export function createStartScreen(ctx: Ctx): Screen {
  const button = h('button', {
    class: 'g-btn g-btn--lamp',
    attrs: { type: 'button' },
    on: { click: () => ctx.actions.start() },
  });
  const el = h('section', { class: 'screen start' }, ...titleScene(), button, pixelTrain());
  return {
    el,
    update(_state, ui) {
      button.textContent = ui.hasSavedGame ? '▶ 이어하기' : '▶ 시작';
      queueMicrotask(() => button.focus());
    },
  };
}
