// 담당: 픽셀 UI — 도트 아이콘. 한 글자 = 한 픽셀, 같은 색이 이어지면 rect 하나로 합친다.
const NS = 'http://www.w3.org/2000/svg';

function svg(viewBox: string, inner: string, cls?: string): SVGSVGElement {
  const el = document.createElementNS(NS, 'svg');
  el.setAttribute('viewBox', viewBox);
  el.setAttribute('aria-hidden', 'true');
  el.setAttribute('shape-rendering', 'crispEdges');
  if (cls) el.setAttribute('class', cls);
  el.innerHTML = inner;
  return el;
}

/** rows: 픽셀 그림('.' = 투명), palette: 글자 → fill 색 (배열이면 아래부터 겹쳐 칠함: 음영) */
function pixelArt(rows: string[], palette: Record<string, string | string[]>, cls?: string): SVGSVGElement {
  let inner = '';
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      let end = x + 1;
      while (end < row.length && row[end] === ch) end++;
      for (const fill of [palette[ch] ?? []].flat()) {
        inner += `<rect x="${x}" y="${y}" width="${end - x}" height="1" style="fill:${fill}"/>`;
      }
      x = end;
    }
  });
  const w = Math.max(...rows.map((r) => r.length));
  return svg(`0 0 ${w} ${rows.length}`, inner, cls);
}

/** 외곽선·음영. 색은 tokens.css 지하철 팔레트 변수 (없으면 폴백) */
const LINE = 'var(--c-px-line, #05040f)';
const SHADE = 'rgba(0,0,0,0.3)';
const SHINE = 'rgba(255,255,255,0.45)';
const LAMP = 'var(--c-lamp, #ffd25a)';
const LAMP_DIM = 'var(--c-lamp-dim, #b98a2a)';
const GO = 'var(--c-signal-go, #5ee08a)';
const STOP = 'var(--c-signal-stop, #ff5a4d)';
const UNLIT = 'rgba(255,255,255,0.12)';

/** 픽셀 하트 (9×8칸). 빈 하트는 같은 모양을 어두운 색으로 */
const HEART_ROWS = [
  '.XX...XX.',
  'XXXX.XXXX',
  'XXXXXXXXX',
  'XXXXXXXXX',
  '.XXXXXXX.',
  '..XXXXX..',
  '...XXX...',
  '....X....',
];
const HEART_SHINE = new Set(['1,1', '2,1', '1,2']);

export function heartIcon(filled: boolean): SVGSVGElement {
  let rects = '';
  HEART_ROWS.forEach((row, y) => {
    [...row].forEach((c, x) => {
      if (c !== 'X') return;
      const shine = filled && HEART_SHINE.has(`${x},${y}`);
      rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="${shine ? '#fff' : 'currentColor'}"${shine ? ' fill-opacity="0.75"' : ''}/>`;
    });
  });
  const el = svg('0 0 9 8', rects, filled ? 'heart' : 'heart is-empty');
  el.setAttribute('shape-rendering', 'crispEdges');
  return el;
}

export function gearIcon(): SVGSVGElement {
  return pixelArt([
    '....XX....',
    '.X.XXXX.X.',
    '..XXXXXX..',
    '.XXX..XXX.',
    'XXX....XXX',
    'XXX....XXX',
    '.XXX..XXX.',
    '..XXXXXX..',
    '.X.XXXX.X.',
    '....XX....',
  ], { X: 'currentColor' });
}

export function undoIcon(): SVGSVGElement {
  return pixelArt([
    '...X......',
    '..XX......',
    '.XXXXXXX..',
    'XXXXXXXXX.',
    '.XXXXXXXXX',
    '..XX...XXX',
    '...X....XX',
    '........XX',
    '....XXXXX.',
    '....XXXX..',
  ], { X: 'currentColor' });
}

// ───────── 지하철 스프라이트 ─────────
// 모두 class "px-icon px-icon--<이름>". 크기는 화면 CSS에서 정한다 (viewBox 칸 수 × 정수 배율 권장).

/** 지하철 앞모습 14×15칸. 몸통 = currentColor, 창 = 터널색, 전조등 = 램프 */
export function trainIcon(): SVGSVGElement {
  return pixelArt([
    '..KKKKKKKKKK..',
    '.KBBBBBBBBBBK.',
    'KBBBBBBBBBBBBK',
    'KBWSWWBBWSWWBK',
    'KBWWWWBBWWWWBK',
    'KBWWWWBBWWWWBK',
    'KBBBBBBBBBBBBK',
    'KBBBBBBBBBBBBK',
    'KBLLBBBBBBLLBK',
    'KBLLBBBBBBLLBK',
    'KBBBBBBBBBBBBK',
    'KDDDDDDDDDDDDK',
    '.KKKKKKKKKKKK.',
    '..KK......KK..',
    '.KKKK....KKKK.',
  ], {
    K: LINE,
    B: 'currentColor',
    D: ['currentColor', SHADE],
    W: 'var(--c-tunnel, #0a0918)',
    S: ['var(--c-tunnel, #0a0918)', SHINE],
    L: LAMP,
  }, 'px-icon px-icon--train');
}

/** 천장 램프 9×9칸. 갓 = currentColor, 전구 = 켜짐 램프색 / 꺼짐 어두운 램프색 */
export function lampIcon(on = true): SVGSVGElement {
  return pixelArt([
    '....K....',
    '....K....',
    '..KKKKK..',
    '.KCCCCCK.',
    'KCCCCCCCK',
    'KKKKKKKKK',
    '.KYYYYYK.',
    '..KYYYK..',
    '...KYK...',
  ], { K: LINE, C: 'currentColor', Y: on ? LAMP : LAMP_DIM }, `px-icon px-icon--lamp${on ? '' : ' is-off'}`);
}

/** 신호등 7×13칸. 'stop' = 위 빨강, 'go' = 아래 초록. 상자 = currentColor */
export function signalIcon(state: 'go' | 'stop'): SVGSVGElement {
  return pixelArt([
    'KKKKKKK',
    'KCCCCCK',
    'KCRRRCK',
    'KCRRRCK',
    'KCRRRCK',
    'KCCCCCK',
    'KCGGGCK',
    'KCGGGCK',
    'KCGGGCK',
    'KCCCCCK',
    'KKKKKKK',
    '...K...',
    '...K...',
  ], {
    K: LINE,
    C: 'currentColor',
    R: state === 'stop' ? STOP : ['currentColor', UNLIT],
    G: state === 'go' ? GO : ['currentColor', UNLIT],
  }, `px-icon px-icon--signal is-${state}`);
}

/** 승차권 16×9칸. 종이 = currentColor, 글줄 = 음영, 오른쪽 절취선 구멍 */
export function ticketIcon(): SVGSVGElement {
  return pixelArt([
    'KKKKKKKKKKKKKKKK',
    'KTTTTTTTTTT.TTTK',
    'KTDDDDDDDTTKTTTK',
    'KTTTTTTTTTT.TTTK',
    '.TDDDDDTTTTKTTT.',
    'KTTTTTTTTTT.TTTK',
    'KTDDDTTTTTTKTTTK',
    'KTTTTTTTTTT.TTTK',
    'KKKKKKKKKKKKKKKK',
  ], { K: LINE, T: 'currentColor', D: ['currentColor', SHADE] }, 'px-icon px-icon--ticket');
}

/** 자물쇠 9×11칸 (이미 고른 갈림길·잠긴 셔터 표시). 몸통·고리 = currentColor */
export function lockIcon(): SVGSVGElement {
  return pixelArt([
    '..XXXXX..',
    '.XX...XX.',
    '.X.....X.',
    '.X.....X.',
    'KKKKKKKKK',
    'KXXXXXXXK',
    'KXXXKXXXK',
    'KXXXKXXXK',
    'KXXXXXXXK',
    'KDDDDDDDK',
    'KKKKKKKKK',
  ], { K: LINE, X: 'currentColor', D: ['currentColor', SHADE] }, 'px-icon px-icon--lock');
}

const ARROW_RIGHT = [
  '....X...',
  '....XX..',
  'XXXXXXX.',
  'XXXXXXXX',
  'XXXXXXXX',
  'XXXXXXX.',
  '....XX..',
  '....X...',
];

/** 화살표 8×8칸. currentColor 단색 */
export function arrowIcon(dir: 'right' | 'left' | 'up' | 'down' = 'right'): SVGSVGElement {
  const n = ARROW_RIGHT.length;
  const at = (x: number, y: number): string => {
    if (dir === 'left') return ARROW_RIGHT[y][n - 1 - x];
    if (dir === 'down') return ARROW_RIGHT[x][y];
    if (dir === 'up') return ARROW_RIGHT[n - 1 - x][y];
    return ARROW_RIGHT[y][x];
  };
  const rows = Array.from({ length: n }, (_, y) => Array.from({ length: n }, (_, x) => at(x, y)).join(''));
  return pixelArt(rows, { X: 'currentColor' }, `px-icon px-icon--arrow is-${dir}`);
}

/** 별 9×9칸 (클리어·1위 표시). 빈 별은 외곽선만 */
export function starIcon(filled = true): SVGSVGElement {
  return pixelArt([
    '....K....',
    '...KYK...',
    'KKKKYKKKK',
    'KYYYYYYYK',
    '.KYYYYYK.',
    '..KYYYK..',
    '.KYYKYYK.',
    '.KYK.KYK.',
    '.KK...KK.',
  ], { K: filled ? LINE : 'currentColor', Y: filled ? 'currentColor' : 'transparent' }, `px-icon px-icon--star${filled ? '' : ' is-empty'}`);
}
