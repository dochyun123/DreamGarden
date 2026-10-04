// 픽셀아트 도우미 — 글자 격자(문자열 배열)나 사각형 목록을 crispEdges SVG로 만든다.
// 외부 이미지 없이 모든 장면을 이것으로 그린다. 결과는 innerHTML용 문자열이며 사용자 입력은 넣지 않는다.

export type Palette = Record<string, string>;

/** [x, y, w, h, 색] */
export type Rect = [number, number, number, number, string];

function svgOpen(w: number, h: number, cls: string, fit: 'meet' | 'slice' | 'none'): string {
  const par = fit === 'none' ? 'none' : `xMidYMid ${fit}`;
  return `<svg class="${cls}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="${par}" shape-rendering="crispEdges" aria-hidden="true">`;
}

/** 사각형 목록 → SVG 문자열. extra는 rect 뒤에 그대로 붙는다 (text 등) */
export function rectsSvg(w: number, h: number, rects: Rect[], cls = '', fit: 'meet' | 'slice' | 'none' = 'slice', extra = ''): string {
  const body = rects.map(([x, y, rw, rh, c]) => `<rect x="${x}" y="${y}" width="${rw}" height="${rh}" fill="${c}"/>`).join('');
  return `${svgOpen(w, h, cls, fit)}${body}${extra}</svg>`;
}

/** 글자 격자 → 사각형 목록. '.'·공백·팔레트에 없는 글자는 투명. 가로로 같은 색이 이어지면 하나로 합친다 */
export function gridRects(rows: string[], pal: Palette, ox = 0, oy = 0): Rect[] {
  const out: Rect[] = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const c = pal[row[x]];
      if (!c) {
        x++;
        continue;
      }
      let end = x + 1;
      while (end < row.length && row[end] === row[x]) end++;
      out.push([ox + x, oy + y, end - x, 1, c]);
      x = end;
    }
  });
  return out;
}

/** 글자 격자 스프라이트 → SVG 문자열 */
export function sprite(rows: string[], pal: Palette, cls = ''): string {
  const w = Math.max(...rows.map((r) => r.length));
  return rectsSvg(w, rows.length, gridRects(rows, pal), cls, 'meet');
}

// ───────── 공용 스프라이트 ─────────

export const HEART_ROWS = [
  '..kkk...kkk..',
  '.krrrk.krrrk.',
  'krwwrrkrrrrrk',
  'krwrrrrrrrrrk',
  'krrrrrrrrrrrk',
  'krrrrrrrrrrdk',
  '.krrrrrrrrdk.',
  '..krrrrrrdk..',
  '...krrrrdk...',
  '....krrdk....',
  '.....kdk.....',
  '......k......',
];
export const HEART_FULL: Palette = { k: '#2B0F14', r: '#E8343F', d: '#A81E2E', w: '#FFE3E3' };
export const HEART_EMPTY: Palette = { k: '#5A4A55', r: '#2E2430', d: '#2E2430', w: '#2E2430' };

export const STAR_ROWS = ['..y..', '..y..', 'yywyy', '..y..', '..y..'];
export const STAR_PAL: Palette = { y: '#FFE066', w: '#FFFFFF' };

export const CLOUD_ROWS = [
  '.....wwww.......',
  '...wwwwwwww.ww..',
  '..wwwwwwwwwwwww.',
  '.wwwwwwwwwwwwwww',
  'wwwwwwwwwwwwwwww',
  'wwsswwwwwssswwww',
  '.ssssssssssssss.',
];
export const CLOUD_PAL: Palette = { w: '#FFFFFF', s: '#D6E6F5' };

export const FLAME_ROWS = [
  '....r....',
  '...ror...',
  '...ror..r',
  '..rooor.r',
  '.rooyoor.',
  '.royyyor.',
  'rooyyyoor',
  'royywyyor',
  'royywwyor',
  'rooyyyyor',
  '.roooooor',
  '..rrrrrr.',
];
export const FLAME_PAL: Palette = { r: '#C0261B', o: '#FF7A1A', y: '#FFD23F', w: '#FFF6C8' };
