// 담당: dream-f4 — 인라인 SVG 아이콘
const NS = 'http://www.w3.org/2000/svg';

function svg(viewBox: string, inner: string, cls?: string): SVGSVGElement {
  const el = document.createElementNS(NS, 'svg');
  el.setAttribute('viewBox', viewBox);
  el.setAttribute('aria-hidden', 'true');
  if (cls) el.setAttribute('class', cls);
  el.innerHTML = inner;
  return el;
}

export function heartIcon(filled: boolean): SVGSVGElement {
  const path = 'M26 46 C10 34 2 25 2 15 C2 7.5 7.8 2 15 2 C19.6 2 23.6 4.4 26 8 C28.4 4.4 32.4 2 37 2 C44.2 2 50 7.5 50 15 C50 25 42 34 26 46 Z';
  const inner = filled
    ? `<path d="${path}" fill="currentColor"/>`
    : `<path d="${path}" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/>`;
  return svg('0 0 52 48', inner, filled ? 'heart' : 'heart is-empty');
}

export function gearIcon(): SVGSVGElement {
  return svg(
    '0 0 24 24',
    '<path fill="currentColor" d="M19.4 13a7.6 7.6 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7.4 7.4 0 0 0-1.7-1L15 3.3h-4l-.4 2.6a7.4 7.4 0 0 0-1.7 1l-2.5-1-2 3.5L6.6 11a7.6 7.6 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1a7.4 7.4 0 0 0 1.7 1l.4 2.6h4l.4-2.6a7.4 7.4 0 0 0 1.7-1l2.5 1 2-3.5ZM13 15.5A3.5 3.5 0 1 1 13 8.5a3.5 3.5 0 0 1 0 7Z" transform="translate(-1 0)"/>',
  );
}
