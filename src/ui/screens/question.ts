// 담당: dream-f4 — 문제 화면 (달리는 지하철 객차 안). 라운드·통과 수·정답은 표시하지 않는다.
import type { GameState, Question } from '../../types';
import { STARTING_LIVES } from '../../types';
import { getCurrentQuestion } from '../../core/engine';
import type { UiState } from '../ui';
import type { Ctx, Screen } from '../context';
import { h, setClasses } from '../dom';
import { gearIcon, heartIcon } from '../icons';

const BLANK = /_{3,}/;
const LONG_PROMPT = 60;
const LONG_CHOICE = 26;

/** "앞 ___ 뒤" → 빈칸을 노란색+밑줄 span으로 */
export function renderPrompt(prompt: string): (string | HTMLElement)[] {
  const parts = prompt.split(BLANK);
  const out: (string | HTMLElement)[] = [];
  parts.forEach((part, i) => {
    if (part) out.push(part);
    if (i < parts.length - 1) {
      out.push(h('span', { class: 'q-blank', attrs: { 'aria-label': '빈칸' } }, ' '));
    }
  });
  return out;
}

/** ?lite=1 (또는 true) — 연출(player.ts)과 같은 저사양 판단 */
function isLite(): boolean {
  const v = new URLSearchParams(location.search).get('lite');
  return v === '1' || v === 'true';
}

/** 운전석에서 내다본 지하 터널 (assets/game-bg.png, 사용자 그림). 빛줄기는 앞 유리창 안에서만 가끔 지나간다 */
function cabBackground(): HTMLElement {
  return h('div', { class: 'cab', attrs: { 'aria-hidden': 'true' } },
    h('div', { class: 'cab__view' }),
    h('div', { class: 'cab__glass' }, h('span', { class: 'cab__glint' })),
  );
}

export function createQuestionScreen(ctx: Ctx): Screen {
  let state: GameState | null = null;
  let ui: UiState | null = null;
  let questionKey = '';

  const teamName = h('h1', { class: 'q-team g-plate' });
  const livesLabel = h('div', { class: 'q-lives__label' });
  const hearts = h('div', { class: 'q-lives__hearts' });
  const lives = h('div', { class: 'q-lives g-plate', attrs: { 'aria-live': 'polite' } }, livesLabel, hearts);
  const prompt = h('p', { class: 'q-prompt' });
  const choices = h('div', { class: 'choices', attrs: { role: 'group', 'aria-label': '보기' } });
  const fab = h(
    'button',
    {
      class: 'admin-fab',
      attrs: { type: 'button', 'aria-label': '관리 메뉴', title: '관리 메뉴' },
      on: { click: () => ctx.actions.openAdminMenu() },
    },
    gearIcon(),
  );

  const el = h(
    'section',
    { class: `screen question${isLite() ? ' is-lite' : ''}` },
    cabBackground(),
    h('header', { class: 'q-head' }, teamName, lives),
    h('div', { class: 'q-body' }, h('div', { class: 'q-instruction' }, '빈칸에 들어갈 말을 고르세요'), prompt),
    choices,
    fab,
  );

  function isOpen(): boolean {
    const p = state?.progress;
    if (!p || !ui) return false;
    if (p.phase !== 'awaitingAnswer' || ui.adminMenuOpen) return false;
    return ctx.local.lock?.runId !== p.runId;
  }

  function onChoice(choiceId: string): void {
    const p = state?.progress;
    if (!p || !isOpen()) return;
    // 클릭 즉시 잠금 → 판정 요청은 한 번만
    ctx.local.lock = { runId: p.runId, choiceId };
    applyChoiceState();
    ctx.actions.selectChoice(choiceId);
  }

  function buildQuestion(q: Question): void {
    prompt.replaceChildren('“', ...renderPrompt(q.prompt), '”');
    prompt.classList.toggle('is-long', q.prompt.length > LONG_PROMPT);
    const longest = Math.max(...q.choices.map((c) => c.text.length));
    choices.classList.toggle('is-long', longest > LONG_CHOICE);
    choices.replaceChildren(
      ...q.choices.map((c, i) =>
        h(
          'button',
          {
            class: 'choice',
            data: { choiceId: c.id },
            attrs: { type: 'button' },
            on: { click: () => onChoice(c.id) },
          },
          h('span', { class: 'choice__num' }, i + 1),
          h('span', { class: 'choice__text' }, c.text),
        ),
      ),
    );
  }

  function selectedChoiceId(): string | null {
    const p = state?.progress;
    if (!p) return null;
    if (p.phase !== 'awaitingAnswer') return p.selectedChoiceId;
    return ctx.local.lock?.runId === p.runId ? ctx.local.lock.choiceId : null;
  }

  function applyChoiceState(): void {
    const open = isOpen();
    const selected = selectedChoiceId();
    setClasses(choices, { 'is-open': open, 'is-locked': !open });
    for (const btn of choices.querySelectorAll<HTMLButtonElement>('.choice')) {
      const isSel = btn.dataset.choiceId === selected;
      btn.classList.toggle('is-selected', isSel);
      btn.setAttribute('aria-pressed', String(isSel));
      btn.setAttribute('aria-disabled', String(!open));
    }
  }

  function renderLives(count: number): void {
    livesLabel.textContent = `목숨 ${count}개`;
    const total = Math.max(STARTING_LIVES, count);
    hearts.replaceChildren(...Array.from({ length: total }, (_, i) => heartIcon(i < count)));
  }

  return {
    el,
    update(s, u) {
      state = s;
      ui = u;
      const p = s.progress;
      if (!p) return;
      const team = s.teams.find((t) => t.id === p.activeTeamId);
      teamName.textContent = team?.name ?? '';
      // 하트는 연출이 줄인다: 오답 연출 중에는 차감 전 값, 불구덩이에서는 0
      renderLives(p.phase === 'wrong' ? Math.min(STARTING_LIVES, p.lives + 1) : p.phase === 'inferno' ? 0 : p.lives);

      const q = getCurrentQuestion(s);
      const key = `${p.activeTeamId}|${p.questionIndex}|${q?.id ?? ''}`;
      if (key !== questionKey) {
        questionKey = key;
        if (q) {
          buildQuestion(q);
          el.querySelector('.q-body')?.classList.remove('q-enter');
          void el.offsetWidth;
          el.querySelector('.q-body')?.classList.add('q-enter');
        } else {
          prompt.replaceChildren('문제를 불러올 수 없습니다.');
          choices.replaceChildren();
        }
      }
      // 클릭 잠금은 다음 render까지만 유지한다. app이 selectChoice를 동기로 commit+render하므로
      // 연타는 phase로 막히고, 거부된 선택(저장 실패 등)은 여기서 풀려 다시 고를 수 있다.
      ctx.local.lock = null;
      applyChoiceState();

      setClasses(fab, { 'is-alert': u.animationStuck, 'has-notice': !!u.notice && !u.animationStuck });
      fab.setAttribute('aria-label', u.animationStuck ? '관리 메뉴 — 연출 건너뛰기 필요' : '관리 메뉴');
    },
  };
}
