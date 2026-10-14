// 스타듀밸리풍 대사 상자 — 한 글자씩 타자기처럼 나오고, 줄이 끝나면 ▶가 깜빡이며 클릭을 기다린다.
// 타이머는 플레이어의 PausableClock(schedule)로 돌리므로 일시정지·취소가 그대로 적용된다.
import type { SfxName } from './sfx';

/** 글자 하나가 나오는 간격 */
export const CHAR_MS = 55;

export interface Dialogue {
  /**
   * 클릭/Enter/Space 한 번.
   * 글자가 나오는 중이면 그 줄을 바로 다 보여주고, 다 나온 상태면 다음 줄 → 마지막 줄이면 onDone.
   */
  advance(): void;
}

export function startDialogue(o: {
  doc: Document;
  parent: HTMLElement;
  lines: string[];
  /** 상자 모양 추가 클래스 (예: 역 안내판) */
  boxClass?: string;
  schedule: (fn: () => void, ms: number) => void;
  sfx: (name: SfxName) => void;
  onDone: () => void;
}): Dialogue {
  const box = o.doc.createElement('div');
  box.className = o.boxClass ? `ap-dlg ${o.boxClass}` : 'ap-dlg';
  box.dataset.part = 'dialogue';
  const text = o.doc.createElement('div');
  text.className = 'ap-dlg-text';
  const next = o.doc.createElement('div');
  next.className = 'ap-dlg-next';
  next.dataset.part = 'next';
  next.textContent = '▶';
  box.append(text, next);
  o.parent.appendChild(box);

  let line = 0;
  let chars: string[] = [];
  let shown = 0;
  let typing = false;
  let token = 0; // 빨리 넘기면 남은 글자 타이머를 무효로 만든다
  let finished = false;

  const lineDone = () => {
    typing = false;
    text.textContent = chars.join('');
    next.classList.add('on');
  };

  const typeNext = (t: number) => {
    if (t !== token || !typing) return;
    shown++;
    text.textContent = chars.slice(0, shown).join('');
    if (shown % 2 === 1 && chars[shown - 1].trim()) o.sfx('blip');
    if (shown >= chars.length) lineDone();
    else o.schedule(() => typeNext(t), CHAR_MS);
  };

  const startLine = () => {
    chars = Array.from(o.lines[line] ?? '');
    shown = 0;
    typing = true;
    token++;
    text.textContent = '';
    next.classList.remove('on');
    const t = token;
    o.schedule(() => typeNext(t), CHAR_MS);
  };

  startLine();

  return {
    advance() {
      if (finished) return;
      if (typing) {
        token++;
        lineDone();
      } else if (line < o.lines.length - 1) {
        line++;
        startLine();
      } else {
        finished = true;
        o.onDone();
      }
    },
  };
}
