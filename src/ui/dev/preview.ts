// 담당: dream-2a — UI 개발용 미리보기 (/src/ui/dev/preview.html). 앱 번들에는 포함되지 않는다.
// 엔진이 완성되기 전 화면 확인용 가짜 상태·동작. ?screen=start|home|pick|setup|setup-new|station|question|menu|long|intro
import '@fontsource/noto-sans-kr/400.css';
import '@fontsource/noto-sans-kr/700.css';
import '@fontsource/noto-sans-kr/900.css';
import '@fontsource/black-han-sans/400.css';
import sample from '../../../data/sample-content.json';
import { SCHEMA_VERSION, type ContentFile, type GameState, type Team } from '../../types';
import { mountUi, type UiActions, type UiState } from '../ui';

const content = sample as ContentFile;
const params = new URLSearchParams(location.search);
const screen = params.get('screen') ?? 'question';
const names = ['믿음팀', '소망팀', '사랑팀', '은혜팀', '평강팀', '기쁨팀', '온유팀', '절제팀', '충성팀', '화평팀'];
const teamCount = Number(params.get('teams') ?? 8);
/** home·pick·setup: 진행 중인 도전 없음 (팀 4는 아직 미도전). setup-new: 팀도 기록도 없음 */
const idle = ['home', 'pick', 'setup', 'setup-new'].includes(screen);
const fresh = screen === 'setup-new';

const teams: Team[] = Array.from({ length: teamCount }, (_, i) => ({
  id: `team-${i + 1}`,
  name: names[i % names.length] + (i >= names.length ? i : ''),
  // 끝난 팀(1~3)만 말씀을 골랐다. 진행 팀(4)은 station이면 아직 고르기 전
  questionSetId: i < 3 || (i === 3 && !idle && screen !== 'station') ? content.questionSets[i % content.questionSets.length].id : null,
  status: i < 3 ? 'completed' : i === 3 && !idle ? 'inProgress' : 'notStarted',
}));

let state: GameState = {
  schemaVersion: SCHEMA_VERSION,
  contentVersion: content.contentVersion,
  questionSets: content.questionSets,
  teams: fresh ? [] : teams,
  progress: idle ? null : {
    activeTeamId: 'team-4', questionIndex: 1, lives: 2, passedCount: 1,
    phase: screen === 'station' ? 'choosingTrack' : 'awaitingAnswer', selectedChoiceId: null, runId: 1,
  },
  results: fresh ? [] : [
    { teamId: 'team-1', passedCount: 4, outcome: 'clear', completedAt: '' },
    { teamId: 'team-2', passedCount: 2, outcome: 'failed', completedAt: '' },
    { teamId: 'team-3', passedCount: 4, outcome: 'clear', completedAt: '' },
  ],
  undoHistory: [],
};
if (state.progress) {
  state.undoHistory = [{ label: '은혜팀 2번 문제에 1번 선택', snapshot: { teams: state.teams, progress: state.progress, results: state.results } }];
}

if (screen === 'long') {
  const set = structuredClone(content.questionSets[3]);
  set.questions[1].prompt = '여호와는 나의 목자시니 내게 부족함이 없으리로다 그가 나를 푸른 풀밭에 누이시며 ___ 물 가로 인도하시는도다 내 영혼을 소생시키시고 자기 이름을 위하여 의의 길로 인도하시는도다';
  set.questions[1].choices[0].text = '쉴 만한';
  set.questions[1].choices[1].text = '깊고 푸른 바다의 맑은 물이 넘쳐 흐르는 곳의';
  set.questions[1].choices[4].text = '아무도 찾지 않는 고요하고 평안한 시냇물이 흐르는 들판의 끝자락에 있는';
  state = { ...state, questionSets: state.questionSets.map((s) => (s.id === set.id ? set : s)) };
}

const ui: UiState = {
  started: screen !== 'start',
  hasSavedGame: params.has('saved'),
  view: screen === 'setup' || screen === 'setup-new' ? 'setup'
    : screen === 'home' || screen === 'pick' ? 'home' : 'question',
  adminMenuOpen: screen === 'menu',
  notice: params.has('notice') ? '저장에 실패했습니다. 브라우저 저장 공간을 확인하세요.' : null,
  // ?issues 또는 ?issues=N (N건)
  issues: params.has('issues')
    ? Array.from({ length: Number(params.get('issues')) || 2 }, (_, i) =>
        i % 2 ? { location: `말씀 ${i + 1}번`, message: '구절이 비어 있습니다.' } : { location: `팀 ${i + 1}번`, message: '팀 이름이 비어 있습니다.' })
    : [],
  animationStuck: params.has('stuck'),
  isFullscreen: false,
  introPlaying: screen === 'intro',
};

const log = (...a: unknown[]) => console.log('[preview]', ...a);
const update = () => handle.render(state, ui);

const actions: UiActions = {
  start() { ui.started = true; update(); },
  setView(v) { ui.view = v; update(); },
  returnToChallenge() { ui.view = 'question'; update(); },
  saveSetup(d) { log('saveSetup', d); ui.view = 'home'; update(); },
  startChallenge(id) { log('startChallenge', id); },
  selectTrack(setId) {
    log('selectTrack', setId);
    const p = state.progress!;
    state = {
      ...state,
      teams: state.teams.map((t) => (t.id === p.activeTeamId ? { ...t, questionSetId: setId } : t)),
      progress: { ...p, phase: 'awaitingAnswer', runId: p.runId + 1 },
    };
    update();
  },
  selectChoice(choiceId) {
    log('selectChoice', choiceId);
    const p = state.progress!;
    const wrong = !choiceId.endsWith('c3');
    state = { ...state, progress: { ...p, phase: wrong ? 'wrong' : 'correct', selectedChoiceId: choiceId, runId: p.runId + 1, lives: wrong ? p.lives - 1 : p.lives } };
    update();
    setTimeout(() => {
      const q = state.progress!;
      state = { ...state, progress: { ...q, phase: 'awaitingAnswer', runId: q.runId + 1, questionIndex: wrong ? q.questionIndex : Math.min(4, q.questionIndex + 1), lives: q.lives || 3 } };
      update();
    }, 1500);
  },
  openAdminMenu() { ui.adminMenuOpen = true; update(); },
  closeAdminMenu() { ui.adminMenuOpen = false; update(); },
  undo() { log('undo'); },
  skipAnimation() { log('skip'); },
  enterFullscreen() { void document.documentElement.requestFullscreen?.(); },
};

const handle = mountUi(document.getElementById('app')!, actions);
update();
// ?screen=pick: '게임 시작'을 누른 상태 (팀 목록 펼침)
if (screen === 'pick') (document.querySelector('.home__actions .g-btn') as HTMLButtonElement | null)?.click();
