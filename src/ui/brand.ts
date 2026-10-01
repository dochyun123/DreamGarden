// 담당: dream-f4 — 상단바 브랜드 표기 ('암송'만 강조)
import { h } from './dom';

export function brand(): HTMLElement {
  return h('div', { class: 'topbar__brand' }, '드리가든이 가을을 보내는 법 : ', h('b', null, '암송'));
}
