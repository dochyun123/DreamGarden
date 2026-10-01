# 말씀 암송 게임 — 개발 구조와 협업 규칙

기획서 원문: `docs/spec.md` (원본 `말씀암송게임_UI_개발기획서.docx`), 문제 화면 시안: `docs/design/question-screen-mockup.png`

## 기술 스택
- TypeScript + Vite (단일 페이지 웹앱, 서버 없음) / 테스트: Vitest + jsdom
- 셸에서 먼저 `source ~/.nvm/nvm.sh` (Node 24는 nvm으로 설치되어 있음)
- `npm run dev` 개발 서버(dream-f4가 1개만 띄움, 포트 5173) · `npm run typecheck` · `npm test`
- 영상 자료: `public/media/{correct,wrong,heaven,inferno}.mp4` (없으면 CSS 대체 연출)

## 모듈과 담당

| 폴더 | 모듈 | 담당 세션 |
|---|---|---|
| `src/types.ts` | 공용 타입(계약) | **dream-3c** (리드) |
| `src/app/`, `src/main.ts` | 모듈 연결, UiState, 연출 루프, 저장 호출 | **dream-3c** |
| `src/core/` | GameEngine, Undo, 리더보드 | **dream-20** |
| `src/content/` | ContentValidator | **dream-20** |
| `src/storage/` | GameStorage | **dream-20** |
| `src/ui/`, `index.html`의 스타일 | ScreenLayer + 디자인 시스템 | **dream-f4** |
| `docs/design/` (레퍼런스), `src/animation/`, `public/media/` | 레퍼런스 조사 → AnimationPlayer 연출 | **9d10c602** |

각 모듈의 함수 시그니처와 동작 규칙은 해당 파일 상단 주석에 있다. 시그니처는 계약이므로 바꾸지 말 것.

## 데이터 흐름

```
UI(actions 호출) ──▶ app ──▶ core 순수 함수(state → newState)
                       │──▶ storage.save(newState)       (실패 시 진행 멈춤 + notice)
                       │──▶ ui.render(state, uiState)
                       └──▶ phase가 연출 단계면 animation.play() → 끝나면 completeAnimation(runId)
```

- 판정은 `selectChoice`에서 **한 번만**. 연출 완료(`completeAnimation`)는 화면 단계만 이동.
- `runId`가 다르면 연출 완료 신호 무시 → Undo·복구 후 늦게 도착한 콜백이 상태를 바꾸지 못함.
- UI는 state를 직접 바꾸지 않는다.

## 샘플 데이터
`data/sample-content.json` — 8세트 × 5문제. 문제 q의 정답은 보기 `(q % 5) + 1`번 (1번 문제→2번 보기, 5번 문제→1번 보기).

## 협업 규칙 (모든 세션 필수)
1. **자기 담당 폴더만 수정한다.** 다른 폴더나 `src/types.ts` 변경이 필요하면 dream-3c에게 SendMessage로 요청.
2. **git commit / add / checkout 금지.** 커밋은 리드만 한다 (동시 git 작업 충돌 방지). 작업 단위가 끝나면 리드에게 보고.
3. 새 npm 패키지 설치는 리드에게 먼저 요청.
4. 완료 보고에는 바꾼 파일, 테스트 결과(`npx vitest run src/<폴더>`, `npm run typecheck`), 남은 이슈를 적는다.
5. 다른 세션의 미완성 코드 때문에 전체 typecheck가 실패하면, 자기 폴더 오류만 없으면 된다.
6. 질문은 짧게 리드에게. 기획서에 없는 결정은 리드가 정한다.
