// 담당: dream-f4 — 작은 DOM 생성 도우미 (프레임워크 없이 사용)

type Child = Node | string | number | null | undefined | false;

export interface Props {
  class?: string;
  text?: string;
  attrs?: Record<string, string | number | boolean | undefined>;
  data?: Record<string, string | number | undefined>;
  style?: Record<string, string>;
  on?: { [K in keyof HTMLElementEventMap]?: (ev: HTMLElementEventMap[K]) => void };
}

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Props | null = null,
  ...children: (Child | Child[])[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props) {
    if (props.class) el.className = props.class;
    if (props.text !== undefined) el.textContent = props.text;
    if (props.attrs) {
      for (const [k, v] of Object.entries(props.attrs)) {
        if (v === undefined || v === false) continue;
        if (v === true) el.setAttribute(k, '');
        else el.setAttribute(k, String(v));
      }
    }
    if (props.data) {
      for (const [k, v] of Object.entries(props.data)) {
        if (v !== undefined) el.dataset[k] = String(v);
      }
    }
    if (props.style) {
      for (const [k, v] of Object.entries(props.style)) el.style.setProperty(k, v);
    }
    if (props.on) {
      for (const [k, fn] of Object.entries(props.on)) {
        if (fn) el.addEventListener(k, fn as EventListener);
      }
    }
  }
  append(el, children);
  return el;
}

function append(el: HTMLElement, children: (Child | Child[])[]): void {
  for (const c of children) {
    if (Array.isArray(c)) append(el, c);
    else if (c === null || c === undefined || c === false) continue;
    else el.append(c instanceof Node ? c : String(c));
  }
}

/** 클래스 토글을 여러 개 한꺼번에 */
export function setClasses(el: Element, classes: Record<string, boolean>): void {
  for (const [k, v] of Object.entries(classes)) el.classList.toggle(k, v);
}
