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

export function undoIcon(): SVGSVGElement {
  return svg(
    '0 0 24 24',
    '<path fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" d="M9 14 4 9l5-5"/><path fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  );
}

export function mapleLeafIcon(): SVGSVGElement {
  return svg('0 0 24 24', '<path fill="currentColor" d="M12 1.5l1.7 3.9 3.3-1.4-.9 3.7 3.9.4-2.8 2.8 2.6 1.8-3.9 1.3.7 3.1-3.3-1.5L12.8 22h-1.6l-.5-6.4-3.3 1.5.7-3.1-3.9-1.3 2.6-1.8L4 8.1l3.9-.4L7 4l3.3 1.4z"/>');
}

export function ginkgoLeafIcon(): SVGSVGElement {
  return svg('0 0 24 24', '<path fill="currentColor" d="M11.3 22v-7.3C6 14.2 2.4 10.3 3.4 4.6c2.7 1.4 5 1 8.6-2.1 3.6 3.1 5.9 3.5 8.6 2.1 1 5.7-2.6 9.6-7.9 10.1V22z"/>');
}
