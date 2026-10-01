// 영상이 없을 때 쓰는 CSS 대체 연출. 장면 = DOM 트리 + 시간표(steps) + 전체 길이.
// 시간표는 플레이어의 PausableClock이 실행하므로 일시정지·취소가 그대로 적용된다.
import type { AnimationKind } from '../types';
import { STARTING_LIVES } from '../types';
import type { PlayContext } from './player';
import type { SfxName } from './sfx';

export const DURATION = {
  correct: 1800,
  wrongCaption: 1200,
  heart: 700,
  inferno: 5000,
  heaven: 5000,
} as const;

const FADE_MS = 350;

export interface SceneStep {
  at: number;
  run: () => void;
}

export interface Scene {
  root: HTMLElement;
  steps: SceneStep[];
  duration: number;
}

export type SfxFn = (name: SfxName) => void;

const HEART_PATH =
  'M12 21s-7.5-4.6-9.6-9.1C.9 8.6 2.7 4.5 6.6 4.5c2.2 0 3.7 1.2 5.4 3.2 1.7-2 3.2-3.2 5.4-3.2 3.9 0 5.7 4.1 4.2 7.4C19.5 16.4 12 21 12 21z';
const heartSvg = (cls: string) => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${HEART_PATH}"/></svg>`;

function el(doc: Document, cls: string, parent?: HTMLElement, text?: string): HTMLElement {
  const e = doc.createElement('div');
  e.className = cls;
  if (text !== undefined) e.textContent = text;
  parent?.appendChild(e);
  return e;
}

function caption(doc: Document, parent: HTMLElement, big: string, sub?: string): HTMLElement {
  const c = el(doc, 'ap-caption', parent);
  const b = doc.createElement('span');
  b.className = 'ap-big';
  b.textContent = big;
  c.appendChild(b);
  if (sub) {
    const s = doc.createElement('span');
    s.className = 'ap-sub';
    s.textContent = sub;
    c.appendChild(s);
  }
  return c;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);

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

// ───────── 정답 ─────────

function correctScene(doc: Document, sfx: SfxFn): Scene {
  const root = sceneRoot(doc, 'correct');
  el(doc, 'ap-dim', root);
  el(doc, 'ap-flash', root);
  el(doc, 'ap-beam l', root);
  el(doc, 'ap-beam r', root);
  const colors = ['#FFE27B', '#FFB800', '#5BE3A6', '#7664E8', '#FF5C7A', '#FFFFFF'];
  for (let i = 0; i < 90; i++) {
    const c = el(doc, 'ap-confetti', root);
    const angle = rand(0, Math.PI * 2);
    const dist = rand(25, 70);
    c.style.background = colors[i % colors.length];
    vars(c, {
      '--tx': `${Math.cos(angle) * dist}cqw`,
      '--ty': `${Math.sin(angle) * dist * 0.7 + 15}cqh`,
      '--r': `${rand(-720, 720)}deg`,
      '--d': `${rand(1.0, 1.5).toFixed(2)}s`,
      '--delay': `${rand(0, 0.15).toFixed(2)}s`,
    });
  }
  caption(doc, root, '정답!');
  return withFade(root, [{ at: 0, run: () => sfx('correct') }], DURATION.correct);
}

// ───────── 하트 소멸 ─────────

function heartPart(doc: Document, ctx: PlayContext, offset: number, sfx: SfxFn, root: HTMLElement): SceneStep[] {
  const box = el(doc, 'ap-hearts');
  box.dataset.part = 'hearts';
  const row = el(doc, 'ap-heart-row', box);
  const slots = Math.max(STARTING_LIVES, ctx.livesBefore);
  const lost: HTMLElement[] = [];
  for (let i = 0; i < slots; i++) {
    const h = el(doc, 'ap-heart', row);
    if (i < ctx.livesAfter) h.innerHTML = heartSvg('full');
    else if (i < ctx.livesBefore) {
      h.innerHTML = heartSvg('empty') + heartSvg('full') + heartSvg('half a full') + heartSvg('half b full');
      h.classList.add('ap-lost');
      lost.push(h);
    } else h.innerHTML = heartSvg('empty');
  }
  const label = el(doc, 'ap-lives', box, `목숨 ${ctx.livesBefore}개`);
  return [
    { at: offset, run: () => root.appendChild(box) },
    {
      at: offset + 200,
      run: () => {
        for (const h of lost) h.classList.add('ap-break');
        if (lost.length) sfx('heartPop');
        label.textContent = `목숨 ${ctx.livesAfter}개`;
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
  const cap = caption(doc, shake, '땡!', ctx.livesAfter > 0 ? '아쉬워요! 다시 도전!' : '목숨을 모두 잃었어요');
  cap.dataset.part = 'caption';
  const steps: SceneStep[] = [
    { at: 0, run: () => sfx('buzzer') },
    { at: DURATION.wrongCaption - 250, run: () => cap.classList.add('ap-hide') },
    { at: DURATION.wrongCaption, run: () => cap.remove() },
    ...heartPart(doc, ctx, DURATION.wrongCaption, sfx, root),
  ];
  return withFade(root, steps, DURATION.wrongCaption + DURATION.heart);
}

// ───────── 불구덩이 (만화풍 추락 + 불꽃) ─────────

function infernoScene(doc: Document, ctx: PlayContext, sfx: SfxFn): Scene {
  const root = sceneRoot(doc, 'inferno');
  const rumble = el(doc, 'ap-rumble', root);
  const card = el(doc, 'ap-card', rumble, ctx.teamName);
  const fire = el(doc, 'ap-fire');
  for (let i = 0; i < 14; i++) {
    const f = el(doc, 'ap-flame', fire);
    vars(f, {
      '--x': `${i * 7.4 - 4 + rand(-2, 2)}%`,
      '--w': `${rand(12, 20)}cqw`,
      '--h': `${rand(30, 58)}cqh`,
      '--d': `${rand(0.25, 0.5).toFixed(2)}s`,
      '--delay': `${rand(0, 0.3).toFixed(2)}s`,
    });
  }
  for (let i = 0; i < 40; i++) {
    const e = el(doc, 'ap-ember', fire);
    vars(e, {
      '--x': `${rand(5, 95)}%`,
      '--tx': `${rand(-8, 8)}cqw`,
      '--d': `${rand(1.2, 2.4).toFixed(2)}s`,
      '--delay': `${rand(0, 1.2).toFixed(2)}s`,
    });
  }
  const steps: SceneStep[] = [
    { at: 0, run: () => sfx('rumble') },
    { at: 600, run: () => rumble.appendChild(el(doc, 'ap-pit')) },
    {
      at: 800,
      run: () => {
        card.classList.add('ap-fall');
        sfx('whistle');
      },
    },
    {
      at: 2100,
      run: () => {
        root.appendChild(fire);
        fire.classList.add('on');
        sfx('thud');
        sfx('sizzle');
      },
    },
    { at: 2300, run: () => caption(doc, root, '불구덩이에 빠졌어요!', `${ctx.teamName} 도전 종료`) },
  ];
  return withFade(root, steps, DURATION.inferno);
}

// ───────── 천국 (구름 · 빛 · 문이 열림) ─────────

function heavenScene(doc: Document, ctx: PlayContext, sfx: SfxFn): Scene {
  const root = sceneRoot(doc, 'heaven');
  el(doc, 'ap-sky', root);
  const rays = el(doc, 'ap-rays', root);
  const gate = el(doc, 'ap-gate', root);
  el(doc, 'ap-gate-glow', gate);
  el(doc, 'ap-door l', gate);
  el(doc, 'ap-door r', gate);
  const clouds = [
    [-8, 40, 22, 0],
    [18, 34, 18, 0.15],
    [40, 46, 24, 0.05],
    [66, 36, 20, 0.2],
    [84, 42, 22, 0.1],
  ];
  const cloudEls = clouds.map(([x, w, h, d]) => {
    const c = el(doc, 'ap-cloud');
    vars(c, { '--x': `${x}cqw`, '--w': `${w}cqw`, '--h': `${h}cqh`, '--delay': `${d}s` });
    return c;
  });
  const steps: SceneStep[] = [
    { at: 0, run: () => sfx('heavenPad') },
    { at: 300, run: () => cloudEls.forEach((c) => root.appendChild(c)) },
    {
      at: 1100,
      run: () => {
        rays.classList.add('on');
        gate.classList.add('on');
      },
    },
    {
      at: 2000,
      run: () => {
        gate.classList.add('open');
        sfx('sparkle');
        for (let i = 0; i < 24; i++) {
          const s = el(doc, 'ap-sparkle', root);
          vars(s, { '--x': `${rand(5, 95)}%`, '--y': `${rand(5, 60)}%`, '--delay': `${rand(0, 1).toFixed(2)}s` });
        }
      },
    },
    { at: 2600, run: () => caption(doc, root, '천국 입성!', `${ctx.teamName} · 5문제 모두 통과!`) },
  ];
  return withFade(root, steps, DURATION.heaven);
}

export function buildScene(kind: AnimationKind, doc: Document, ctx: PlayContext, sfx: SfxFn): Scene {
  switch (kind) {
    case 'correct':
      return correctScene(doc, sfx);
    case 'wrong':
      return wrongScene(doc, ctx, sfx);
    case 'inferno':
      return infernoScene(doc, ctx, sfx);
    case 'heaven':
      return heavenScene(doc, ctx, sfx);
  }
}
