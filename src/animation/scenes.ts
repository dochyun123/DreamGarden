// 영상이 없을 때 쓰는 픽셀아트 대체 연출. 장면 = DOM 트리 + 시간표(steps) + 길이(+ 선택: 대사).
// 시간표는 플레이어의 PausableClock이 실행하므로 일시정지·취소가 그대로 적용된다.
// 주인공은 보이지 않는다 (1인칭 시점). 모든 그림은 pixel.ts의 crispEdges SVG와 steps() 애니메이션.
import type { AnimationKind } from '../types';
import { STARTING_LIVES } from '../types';
import type { PlayContext } from './player';
import {
  CLOUD_PAL,
  CLOUD_ROWS,
  FLAME_PAL,
  FLAME_ROWS,
  gridRects,
  HEART_EMPTY,
  HEART_FULL,
  HEART_ROWS,
  rectsSvg,
  sprite,
  STAR_PAL,
  STAR_ROWS,
  type Rect,
} from './pixel';
import type { SfxName } from './sfx';
import churchUrl from './assets/church.jpg?url';
import sermonUrl from './assets/sermon.jpg?url';

/**
 * 장면 길이(ms). intro/heaven/inferno는 이 시간 뒤 대사 상자가 나오고, 클릭할 때까지 기다린다.
 */
export const DURATION = {
  /** 인트로 1: 교회 외관 (경적) */
  introChurch: 1400,
  /** 인트로 2: 전도사님 설교 */
  introSermon: 1000,
  /** 인트로 3: 꾸벅꾸벅 잠듦(2400) → 꿈 → 지하 기차역에서 눈 뜸 */
  intro: 6000,
  /** 인트로 4: 역 안내판 (딩동댕동) */
  introSign: 900,
  /** 정답 자막 → 터널 통과 */
  correct: 3000,
  correctCaption: 1200,
  wrongCaption: 1200,
  heart: 700,
  heaven: 4200,
  inferno: 4400,
} as const;

/** 장면이 끝난 뒤 나오는 대사 (클릭으로 넘김) */
export const DIALOGUE = {
  introChurch: ['오늘은 주일 드림가든 예배 있는 날!', '아침에는 언제나 피곤해…'],
  introSermon: ['주일 아침 예배시간은 너무 피곤해….', '잠깐 눈 좀 붙여볼까…'],
  intro: ['…여기가 어디지? 기차역…?'],
  introSign: [
    '이 표지판을 보고 있다는 것은 심판자이신 하나님을 뵈러 가는 것입니다.',
    '여러분의 삶이 천국으로 가기에 합당한지 간단한 테스트가 있을 예정입니다.',
    '아무쪼록 좋은 결과 있기를 바랍니다.',
  ],
  heaven: ['천국은… 진짜 있었어!', '말씀 암송 계속하고 싶다!'],
  inferno: ['헉…! 꿈이었구나…', '말씀 암송 해야겠다…'],
} as const;

const FADE_MS = 300;

export interface SceneStep {
  at: number;
  run: () => void;
}

export interface Scene {
  root: HTMLElement;
  steps: SceneStep[];
  duration: number;
  /** 있으면 duration 뒤 대사 상자 → 마지막 줄에서 클릭하면 끝 (자동 종료 없음) */
  dialogue?: readonly string[];
  /** 대사 상자 모양 (예: 'ap-notice' 역 안내판) */
  dialogueClass?: string;
  /** 있으면 대사 마지막 줄 클릭 뒤 끝내지 않고 이 장면으로 이어진다 */
  next?: () => Scene;
}

export type SfxFn = (name: SfxName) => void;

function el(doc: Document, cls: string, parent?: HTMLElement, text?: string): HTMLElement {
  const e = doc.createElement('div');
  e.className = cls;
  if (text !== undefined) e.textContent = text;
  parent?.appendChild(e);
  return e;
}

function html(doc: Document, cls: string, markup: string, parent?: HTMLElement): HTMLElement {
  const e = el(doc, cls, parent);
  e.innerHTML = markup; // pixel.ts가 만든 SVG만 넣는다 (사용자 입력 없음)
  return e;
}

function caption(doc: Document, parent: HTMLElement, big: string): HTMLElement {
  const c = el(doc, 'ap-caption', parent);
  const b = doc.createElement('span');
  b.className = 'ap-big';
  b.textContent = big;
  c.appendChild(b);
  return c;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);
/** 픽셀 격자에 맞춘 난수 (cq 단위를 정수로) */
const randi = (a: number, b: number) => Math.round(rand(a, b));

function vars(e: HTMLElement, v: Record<string, string>): void {
  for (const [k, val] of Object.entries(v)) e.style.setProperty(k, val);
}

function sceneRoot(doc: Document, kind: string): HTMLElement {
  const root = el(doc, `ap-scene ap-${kind}`);
  root.dataset.scene = kind;
  return root;
}

function withFade(root: HTMLElement, steps: SceneStep[], duration: number): Scene {
  steps.push({ at: duration - FADE_MS, run: () => root.classList.add('ap-out') });
  return { root, steps, duration };
}

/** 눈꺼풀(위·아래 검은 막). open: 0(감음)~1(완전히 뜸) */
function eyelids(doc: Document, parent: HTMLElement) {
  const top = el(doc, 'ap-lid top', parent);
  const bot = el(doc, 'ap-lid bot', parent);
  return (open: number, snap = false) => {
    const h = `${Math.round((1 - open) * 50)}%`;
    for (const l of [top, bot]) {
      l.classList.toggle('snap', snap);
      l.style.height = h;
    }
  };
}

function stars(doc: Document, parent: HTMLElement, n: number, cls: string): void {
  for (let i = 0; i < n; i++) {
    const s = html(doc, `ap-star ${cls}`, sprite(STAR_ROWS, STAR_PAL), parent);
    vars(s, {
      '--x': `${randi(10, 90)}%`,
      '--y': `${randi(10, 70)}%`,
      '--tx': `${randi(-40, 40)}cqw`,
      '--ty': `${randi(-40, 30)}cqh`,
      '--delay': `${rand(0, 1).toFixed(2)}s`,
    });
  }
}

// ───────── 배경 그림 (160×90 픽셀 격자) ─────────

const FONT = `font-family="ApGalmuri,Galmuri11,monospace" font-weight="700"`;

/** 지하 기차역 승강장 */
function stationSvg(): string {
  const r: Rect[] = [[0, 0, 160, 62, '#2F3446']];
  for (let y = 8; y < 62; y += 6) {
    r.push([0, y, 160, 1, '#262A39']);
    for (let x = (y / 2) % 2 ? 4 : 0; x < 160; x += 8) r.push([x, y, 1, 6, '#2A2F40']);
  }
  r.push([0, 40, 160, 3, '#3FA7A0']); // 노선 색 띠
  r.push([0, 0, 160, 8, '#1B1E29']); // 천장
  for (const x of [8, 48, 92, 132]) r.push([x, 8, 20, 2, '#FFF3C4'], [x - 2, 10, 24, 3, 'rgba(255,243,196,.16)']);
  for (const x of [20, 136]) r.push([x, 8, 6, 54, '#4A5068'], [x, 8, 1, 54, '#666E8C'], [x + 5, 8, 1, 54, '#383D50']);
  r.push([58, 16, 44, 15, '#E8E8E8'], [59, 17, 42, 13, '#1D3A6E']); // 역 이름판
  r.push([108, 18, 16, 20, '#7A3B2E'], [109, 19, 14, 18, '#C96A4A'], [111, 21, 10, 8, '#F0C27B']); // 포스터
  r.push([34, 50, 18, 2, '#6E4520'], [34, 54, 18, 2, '#8A5A2B'], [35, 56, 1, 6, '#3A2A1A'], [50, 56, 1, 6, '#3A2A1A']); // 벤치
  r.push([0, 62, 160, 9, '#8B8F9C'], [0, 62, 160, 1, '#A7ABB7']); // 승강장 바닥
  for (let x = 6; x < 160; x += 12) r.push([x, 63, 1, 6, '#7C808D']);
  r.push([0, 69, 160, 2, '#E8C547']); // 노란 안전선
  for (let x = 1; x < 160; x += 4) r.push([x, 69, 2, 1, '#C9A73A']);
  r.push([0, 71, 160, 3, '#5B5E6A'], [0, 74, 160, 16, '#14151C']); // 선로
  for (let x = 2; x < 160; x += 8) r.push([x, 81, 4, 4, '#3A2A1E']);
  r.push([0, 80, 160, 1, '#9AA0AC'], [0, 86, 160, 1, '#9AA0AC']);
  const sign = `<text x="80" y="27" font-size="9" text-anchor="middle" fill="#FFFFFF" ${FONT}>꿈역</text>`;
  return rectsSvg(160, 90, r, 'ap-bg', 'slice', sign);
}

/** 내 방 천장 (악몽에서 깼을 때) */
function ceilingSvg(): string {
  const r: Rect[] = [];
  for (let y = 0, i = 0; y < 90; y += 10, i++) {
    r.push([0, y, 160, 10, i % 2 ? '#BC8F5E' : '#C99D6B'], [0, y + 9, 160, 1, '#8E6640']);
    for (let x = i % 2 ? 30 : 70; x < 160; x += 80) r.push([x, y, 1, 9, '#A47A4E']);
  }
  r.push([0, 40, 160, 6, '#7A5332'], [0, 40, 160, 1, '#946742']); // 들보
  for (let i = 0; i < 8; i++) r.push([98 + i * 3, 50 + i * 4, 34, 4, 'rgba(255,240,190,.3)']); // 창문 햇빛
  r.push([79, 0, 2, 18, '#3A2A1E'], [72, 18, 16, 2, '#E7D9B5'], [70, 20, 20, 2, '#E7D9B5'], [68, 22, 24, 3, '#D8C79E']);
  r.push([77, 25, 6, 3, '#FFF6C8']);
  return rectsSvg(160, 90, r, 'ap-bg', 'slice');
}

/**
 * 추락하는 벽돌 우물 160×102 — 12칸(벽돌 두 줄)마다 무늬가 반복되므로
 * CSS가 12칸만큼 위로 올렸다가 되돌리면 끝없이 떨어지는 것처럼 보인다.
 */
function shaftSvg(): string {
  const r: Rect[] = [[0, 0, 160, 102, '#4A2018']];
  for (let y = 0, i = 0; y < 102; y += 6, i++) {
    r.push([0, y + 5, 160, 1, '#1E0C08']);
    for (let x = i % 2 ? 0 : 7; x < 160; x += 14) r.push([x, y, 1, 5, '#1E0C08'], [x + 1, y, 13, 1, '#6A2E22']);
  }
  // 가장자리를 어둡게 → 둥근 구멍 안쪽처럼
  for (const [w, c] of [[28, 'rgba(0,0,0,.25)'], [16, 'rgba(0,0,0,.3)'], [7, 'rgba(0,0,0,.35)']] as const) {
    r.push([0, 0, w, 102, c], [160 - w, 0, w, 102, c]);
  }
  return rectsSvg(160, 102, r, 'ap-bg', 'none');
}

/** 천국 하늘 (계단식 색 띠) */
function skySvg(): string {
  const bands = ['#4FA8F0', '#6BBBF5', '#8DCDF8', '#B3DEFA', '#D9EEF8', '#FFF4D6', '#FFE7A8', '#FFD98A'];
  const r: Rect[] = bands.map((c, i) => [0, i * 12, 160, 12, c] as Rect);
  r.push(...gridRects(CLOUD_ROWS, CLOUD_PAL, 12, 14), ...gridRects(CLOUD_ROWS, CLOUD_PAL, 128, 24));
  return rectsSvg(160, 90, r, 'ap-bg', 'slice');
}

/** 천국 문틀 28×32: 기둥 + 계단식 아치 */
function gateFrameSvg(): string {
  const outer = [[8, 19], [5, 22], [3, 24], [2, 25], [1, 26], [0, 27]];
  const inner = [null, null, [8, 19], [6, 21], [5, 22], [4, 23]];
  const rows: string[] = [];
  for (let y = 0; y < 32; y++) {
    let row = '';
    for (let x = 0; x < 28; x++) {
      let c = '.';
      if (y < 6) {
        const [a, b] = outer[y];
        const inn = inner[y];
        if (x >= a && x <= b && !(inn && x >= inn[0] && x <= inn[1])) c = y === 0 || x === a || x === b ? 'h' : 'G';
      } else if (x < 4 || x >= 24) c = x === 0 || x === 27 ? 'd' : x === 1 || x === 24 ? 'h' : 'G';
      row += c;
    }
    rows.push(row);
  }
  return sprite(rows, { G: '#E0A91B', h: '#FFE37A', d: '#9A6A0A' }, 'ap-gate-frame');
}

/** 문짝 10×26: 금빛 창살 */
function doorSvg(): string {
  const rows: string[] = [];
  for (let y = 0; y < 26; y++) {
    let row = '';
    for (let x = 0; x < 10; x++) {
      if (x === 0 || x === 9 || y === 0 || y === 25) row += 'G';
      else if (y === 8 || y === 17) row += 'g';
      else row += x % 2 === 0 ? 'g' : '.';
    }
    rows.push(row);
  }
  return sprite(rows, { G: '#B8860B', g: '#FFD34D' });
}

// ───────── 인트로: 교회 → 설교 중 졸음 → 꿈 → 지하 기차역 → 역 안내판 ─────────

/** 인트로 그림(사용자 제공 이미지)을 미리 받아 둔다 → 장면이 바뀔 때 빈 화면이 없게 */
export function preloadImages(doc: Document): void {
  for (const src of [churchUrl, sermonUrl]) {
    const img = doc.createElement('img');
    img.src = src;
  }
}

function photo(doc: Document, cls: string, src: string, parent: HTMLElement): HTMLImageElement {
  const img = doc.createElement('img');
  img.className = `ap-photo ${cls}`;
  img.src = src;
  img.alt = '';
  parent.appendChild(img);
  return img;
}

function introChurchScene(doc: Document, sfx: SfxFn, lite: boolean): Scene {
  const root = sceneRoot(doc, 'intro-church');
  photo(doc, 'ap-church', churchUrl, root);
  return {
    root,
    steps: [{ at: 300, run: () => sfx('horn') }],
    duration: DURATION.introChurch,
    dialogue: DIALOGUE.introChurch,
    next: () => introSermonScene(doc, sfx, lite),
  };
}

function introSermonScene(doc: Document, sfx: SfxFn, lite: boolean): Scene {
  const root = sceneRoot(doc, 'intro-sermon');
  photo(doc, 'ap-sermon', sermonUrl, root);
  return {
    root,
    steps: [],
    duration: DURATION.introSermon,
    dialogue: DIALOGUE.introSermon,
    next: () => introScene(doc, sfx, lite),
  };
}

/** 설교 화면에서 눈꺼풀이 처지며 꾸벅 → 잠듦 → 꿈의 반짝임 → 지하 기차역에서 눈을 뜬다 */
function introScene(doc: Document, sfx: SfxFn, lite: boolean): Scene {
  const root = sceneRoot(doc, 'intro');
  const station = html(doc, 'ap-station', stationSvg(), root);
  const sermon = photo(doc, 'ap-sermon', sermonUrl, root);
  el(doc, 'ap-vignette', root);
  const lids = eyelids(doc, root);
  lids(1, true);
  // 눈을 감은 어둠 속 꿈의 반짝임 (잠든 뒤 눈꺼풀 위에 보인다)
  stars(doc, root, lite ? 4 : 10, 'ap-dream');
  const nod = el(doc, 'ap-nod', root, '꾸벅…');
  const sleep = 2400;
  const steps: SceneStep[] = [
    { at: 0, run: () => { root.classList.add('drowsy'); lids(0.55); } },
    { at: 600, run: () => lids(0.9, true) }, // 화들짝
    { at: 1000, run: () => lids(0.35) },
    { at: 1400, run: () => { nod.classList.add('on'); lids(0.15); } },
    { at: 2000, run: () => lids(0) },
    {
      at: sleep,
      run: () => {
        sermon.remove();
        nod.remove();
        root.classList.add('dreaming');
        sfx('intro');
      },
    },
    { at: sleep + 900, run: () => lids(0.25) },
    { at: sleep + 1400, run: () => lids(0) },
    { at: sleep + 1800, run: () => lids(0.6) },
    { at: sleep + 2200, run: () => lids(0.1) },
    {
      at: sleep + 2500,
      run: () => {
        lids(1);
        station.classList.add('clear');
        root.classList.add('awake');
      },
    },
  ];
  return { root, steps, duration: DURATION.intro, dialogue: DIALOGUE.intro, next: () => introSignScene(doc, sfx) };
}

/** 승강장에 걸린 안내판 — 안내 방송 소리와 함께 문구가 한 줄씩 (클릭으로 넘김) */
function introSignScene(doc: Document, sfx: SfxFn): Scene {
  const root = sceneRoot(doc, 'intro-sign');
  html(doc, 'ap-station clear', stationSvg(), root);
  el(doc, 'ap-dim', root);
  return {
    root,
    steps: [{ at: 0, run: () => sfx('chime') }],
    duration: DURATION.introSign,
    dialogue: DIALOGUE.introSign,
    dialogueClass: 'ap-notice',
  };
}

// ───────── 정답 ─────────

/** 정답! → 기차가 덜컹덜컹 터널을 지나간다 (어두워지고 벽 등이 양옆으로 스쳐 감) → 다음 문제 */
function correctScene(doc: Document, sfx: SfxFn, lite: boolean): Scene {
  const root = sceneRoot(doc, 'correct');
  el(doc, 'ap-dim', root);
  el(doc, 'ap-flash', root);
  stars(doc, root, lite ? 8 : 18, 'ap-burst');
  const cap = caption(doc, root, '정답!');
  const tunnel = el(doc, 'ap-tunnel');
  tunnel.dataset.part = 'tunnel';
  const ride = el(doc, 'ap-ride', tunnel);
  for (let i = 0, n = lite ? 2 : 4; i < n; i++) {
    for (const side of ['l', 'r']) vars(el(doc, `ap-tlamp ${side}`, ride), { '--delay': `${(i * 0.4) / n}s` });
  }
  el(doc, 'ap-tlight', tunnel);
  const t = DURATION.correctCaption;
  return {
    root,
    steps: [
      { at: 0, run: () => sfx('correct') },
      { at: t - 200, run: () => cap.classList.add('ap-hide') },
      {
        at: t,
        run: () => {
          cap.remove();
          root.appendChild(tunnel);
          sfx('rattle');
        },
      },
      // 터널 끝: 다시 밝아지며 다음 문제
      { at: DURATION.correct - 400, run: () => tunnel.classList.add('ap-exit') },
    ],
    duration: DURATION.correct,
  };
}

// ───────── 하트 소멸 ─────────

function heartPart(doc: Document, ctx: PlayContext, offset: number, sfx: SfxFn, root: HTMLElement): SceneStep[] {
  const box = el(doc, 'ap-hearts');
  box.dataset.part = 'hearts';
  const slots = Math.max(STARTING_LIVES, ctx.livesBefore);
  const full = sprite(HEART_ROWS, HEART_FULL);
  const empty = sprite(HEART_ROWS, HEART_EMPTY);
  const lost: HTMLElement[] = [];
  for (let i = 0; i < slots; i++) {
    const h = el(doc, 'ap-heart', box);
    if (i < ctx.livesAfter) h.innerHTML = full;
    else if (i < ctx.livesBefore) {
      // 빈 하트 위에 두 쪽(왼쪽·오른쪽)으로 나뉜 하트 → 금이 가며 갈라져 떨어진다
      h.innerHTML = empty + `<div class="ap-half l">${full}</div><div class="ap-half r">${full}</div>`;
      h.classList.add('ap-lost');
      lost.push(h);
    } else h.innerHTML = empty;
  }
  return [
    { at: offset, run: () => root.appendChild(box) },
    {
      at: offset + 200,
      run: () => {
        for (const h of lost) h.classList.add('ap-break');
        if (lost.length) sfx('heartBreak');
      },
    },
  ];
}

export function heartScene(doc: Document, ctx: PlayContext, sfx: SfxFn): Scene {
  const root = sceneRoot(doc, 'wrong');
  el(doc, 'ap-dim', root);
  return withFade(root, heartPart(doc, ctx, 0, sfx, root), DURATION.heart);
}

// ───────── 오답 (자막 → 하트 소멸). 정답은 공개하지 않는다. ─────────

function wrongScene(doc: Document, ctx: PlayContext, sfx: SfxFn): Scene {
  const root = sceneRoot(doc, 'wrong');
  el(doc, 'ap-dim', root);
  el(doc, 'ap-flash', root);
  const shake = el(doc, 'ap-shake', root);
  const cap = caption(doc, shake, '오답');
  cap.dataset.part = 'caption';
  const steps: SceneStep[] = [
    { at: 0, run: () => sfx('wrong') },
    { at: DURATION.wrongCaption - 200, run: () => cap.classList.add('ap-hide') },
    { at: DURATION.wrongCaption, run: () => cap.remove() },
    ...heartPart(doc, ctx, DURATION.wrongCaption, sfx, root),
  ];
  return withFade(root, steps, DURATION.wrongCaption + DURATION.heart);
}

// ───────── 천국 (픽셀 하늘 · 구름 · 빛 · 문이 열림) → 대사 ─────────

function heavenScene(doc: Document, ctx: PlayContext, sfx: SfxFn, lite: boolean): Scene {
  const root = sceneRoot(doc, 'heaven');
  html(doc, 'ap-sky', skySvg(), root);
  const rays = el(doc, 'ap-rays', root);
  for (let i = 0; i < 5; i++) vars(el(doc, 'ap-ray', rays), { '--x': `${30 + i * 9}%`, '--delay': `${i * 0.15}s` });
  const gate = el(doc, 'ap-gate', root);
  el(doc, 'ap-gate-light', gate);
  html(doc, 'ap-door l', doorSvg(), gate);
  html(doc, 'ap-door r', doorSvg(), gate);
  html(doc, 'ap-gate-frame-wrap', gateFrameSvg(), gate);
  const clouds = el(doc, 'ap-clouds');
  for (const [x, w, d] of [[-4, 30, 0], [22, 24, 0.1], [48, 32, 0.05], [76, 28, 0.15]]) {
    const c = html(doc, 'ap-cloud', sprite(CLOUD_ROWS, CLOUD_PAL), clouds);
    vars(c, { '--x': `${x}cqw`, '--w': `${w}cqw`, '--delay': `${d}s` });
  }
  const steps: SceneStep[] = [
    { at: 300, run: () => root.appendChild(clouds) },
    {
      at: 900,
      run: () => {
        rays.classList.add('on');
        gate.classList.add('on');
      },
    },
    {
      at: 1700,
      run: () => {
        gate.classList.add('open');
        sfx('heaven');
        stars(doc, root, lite ? 5 : 12, 'ap-twinkle');
      },
    },
    {
      at: 2400,
      run: () => {
        const cap = caption(doc, root, '천국 입성!');
        const ref = ctx.scriptureReference?.trim();
        if (ref) {
          const verse = doc.createElement('span');
          verse.className = 'ap-verse';
          verse.dataset.part = 'verse';
          verse.textContent = ref;
          cap.appendChild(verse);
        }
      },
    },
  ];
  return { root, steps, duration: DURATION.heaven, dialogue: DIALOGUE.heaven };
}

// ───────── 불구덩이 (추락 → 불꽃 → 흔들리며 암전 → 악몽에서 깸) → 대사 ─────────

function infernoScene(doc: Document, sfx: SfxFn, lite: boolean): Scene {
  const root = sceneRoot(doc, 'inferno');
  const shake = el(doc, 'ap-quake', root);
  html(doc, 'ap-shaft', shaftSvg(), shake);
  const glow = el(doc, 'ap-glow', shake);
  const fire = el(doc, 'ap-fire');
  const flames = lite ? 6 : 10;
  const flame = sprite(FLAME_ROWS, FLAME_PAL);
  for (let i = 0; i < flames; i++) {
    const f = html(doc, 'ap-flame', flame, fire);
    vars(f, {
      '--x': `${Math.round((i * 104) / flames) - 4}%`,
      '--w': `${randi(12, 18)}cqw`,
      '--d': `${rand(0.25, 0.45).toFixed(2)}s`,
    });
  }
  for (let i = 0, n = lite ? 8 : 20; i < n; i++) {
    const e = el(doc, 'ap-ember', fire);
    vars(e, { '--x': `${randi(3, 97)}%`, '--d': `${rand(0.9, 1.6).toFixed(2)}s`, '--delay': `${rand(0, 1).toFixed(2)}s` });
  }
  const black = el(doc, 'ap-black', root);
  const room = html(doc, 'ap-room', ceilingSvg());
  let lids: ReturnType<typeof eyelids> | null = null;
  const steps: SceneStep[] = [
    { at: 0, run: () => sfx('fall') },
    { at: 400, run: () => glow.classList.add('on') },
    {
      at: 1100,
      run: () => {
        shake.appendChild(fire);
        sfx('inferno');
      },
    },
    {
      at: 2400,
      run: () => {
        shake.classList.add('hard');
        sfx('inferno');
      },
    },
    { at: 2800, run: () => black.classList.add('on') },
    {
      at: 3500,
      run: () => {
        // 암전 속에서 방 장면 준비 → 눈을 번쩍 뜬다
        shake.remove();
        black.remove();
        root.appendChild(room);
        lids = eyelids(doc, root);
        lids(0);
      },
    },
    {
      at: 3700,
      run: () => {
        lids?.(1, true);
        room.classList.add('jolt');
        sfx('wake');
      },
    },
  ];
  return { root, steps, duration: DURATION.inferno, dialogue: DIALOGUE.inferno };
}

/** lite: 저사양 모드 — 입자 수를 줄인다 (blur 제거 등은 styles.ts의 .ap-lite) */
export function buildScene(kind: AnimationKind, doc: Document, ctx: PlayContext, sfx: SfxFn, lite = false): Scene {
  switch (kind) {
    case 'intro':
      return introChurchScene(doc, sfx, lite);
    case 'correct':
      return correctScene(doc, sfx, lite);
    case 'wrong':
      return wrongScene(doc, ctx, sfx);
    case 'heaven':
      return heavenScene(doc, ctx, sfx, lite);
    case 'inferno':
      return infernoScene(doc, sfx, lite);
  }
}
