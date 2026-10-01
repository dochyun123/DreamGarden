# 연출 디자인 레퍼런스

담당: 9d10c602 · 기준: `docs/spec.md` 4·5장, 시안 `question-screen-mockup.png`
대상: 1920×1080 TV, 교회 행사용 예능 퀴즈쇼. 몇 m 떨어진 거리에서 봐도 읽히는 크기와 대비가 필요하다.

## 1. 무드 키워드

| 연출 | 키워드 |
|---|---|
| 공통 무대 | 밤 무대, 보라 조명, 스포트라이트, 굵고 큰 자막, 짧고 경쾌한 효과음 |
| 정답 | 금빛 플래시, 위로 튀는 자막, 컨페티, "딩동댕" 상승 아르페지오 |
| 오답 | 붉은 플래시, 화면 흔들림, 아래로 쿵 떨어지는 자막, "삐-빅" 하강 버저. **정답은 공개하지 않는다.** |
| 하트 소멸 | 하트가 부풀었다가 금 가며 두 조각으로 갈라져 떨어진다, 짧은 "퐁" 소리 |
| 불구덩이 | 만화풍, 무섭지 않게. 바닥이 열림 → 빙글빙글 추락 → 불꽃이 솟고 연기, "으아아~" 대신 하강 휘슬 + 쿵 |
| 천국 | 구름 바다, 위에서 내려오는 빛줄기, 금빛 문이 양쪽으로 열림, 반짝이 입자, 밝은 화음 |

## 2. 색상 팔레트

시안 기본색(그대로 유지): 배경 `#17162E` · 패널 `#2D2B4D` · 강조 보라 `#7664E8` · 빈칸 노랑 `#FFE27B` · 본문 `#FFFFFF`

| 용도 | 색 | 비고 |
|---|---|---|
| 무대 조명 | `#7664E8` → `#B3A8FF` (투명도 0.15~0.35) | 스포트라이트 빔, radial-gradient |
| 정답 자막/플래시 | `#FFE27B`, 외곽 `#FFB800`, 그림자 `#7A4B00` | 노랑을 "정답"색으로 통일 |
| 정답 보조 | `#5BE3A6` (민트) | 컨페티 섞음 |
| 오답 자막/플래시 | `#FF4D6D`, 외곽 `#B0103A` | 시안 하트색과 같은 계열 |
| 하트 | `#FF5C7A` (채움), 빈 하트 `#4A4870` 외곽선 | 시안 하트와 맞춤 |
| 불구덩이 | `#2A0A12` 배경 → `#FF3D00` · `#FF7A1A` · `#FFC93C` 불꽃 | 아래쪽이 가장 밝게 |
| 천국 | `#FFF8E1` · `#FFE9A8` 빛, `#CFE8FF` 하늘, `#FFFFFF` 구름, 문 `#E8C25A` | 어두운 배경 대비 크게 밝아지는 전환 |

대비: 큰 자막은 흰/노랑 글자 + 6~10px 어두운 외곽선(`-webkit-text-stroke` 또는 `paint-order: stroke`) + drop-shadow로 어떤 배경 위에서도 읽히게 한다.

## 3. 한글 웹폰트 (무료, OFL)

| 용도 | 폰트 | 이유 |
|---|---|---|
| 연출 큰 자막 ("정답!", "땡!", "천국 입성!") | **Black Han Sans** | 초굵은 제목용, 예능 자막 느낌이 가장 강함 |
| 대안 자막 | **Do Hyeon** | 굵고 각진 고딕, 조금 더 깔끔 |
| 부드러운 분위기 (천국 문구) | **Jua** | 둥근 고딕, 아이들도 친근 |
| 본문·보기·질문 | **Noto Sans KR** (500/700) | 가독성, 시안 느낌과 같음 — dream-f4 결정 사항 |

⚠️ 행사장 PC가 오프라인일 수 있으므로 Google Fonts CDN에만 의존하지 말 것. woff2를 `public/fonts/`에 넣어 `@font-face`로 자체 호스팅하거나(파일 추가는 리드 승인), 폰트가 없어도 깨지지 않게 `font-family: 'Black Han Sans', 'Noto Sans KR', 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif` 폴백을 둔다. 연출 모듈은 이 폴백 스택을 쓴다.

## 4. 연출별 구현 아이디어 (영상이 없을 때의 대체 연출)

모두 1920×1080 스테이지 위 `position:absolute; inset:0` 오버레이. 자체 `<style>` 1개를 주입하고, CSS 애니메이션 + 가벼운 Canvas(입자)만 사용. 외부 라이브러리 없음.

| 연출 | 길이 | 구성 |
|---|---|---|
| 정답 | 1.8s | 0~0.15s 금빛 radial 플래시 → "정답!" 자막 scale 0.3→1.15→1 (bounce) → 좌우 스포트라이트 빔 스윙 → Canvas 컨페티 80~120개 → 1.5s부터 페이드아웃. 효과음: C–E–G–C 상승 아르페지오(triangle) |
| 오답 | 1.2s + 하트 0.7s = 1.9s | 붉은 비네트 플래시 + 오버레이 shake(±12px, 0.35s) → "땡!" 자막 위에서 툭 떨어짐 → 하트 단계: 화면 중앙에 하트 N개 표시, 잃은 하트가 부풀었다 두 조각으로 갈라져 회전 낙하, "목숨 N개" 갱신. 효과음: 하강 square 버저 2음 + 하트 "퐁"(sine 하강) |
| 불구덩이 | 5s | 어두워짐 → 팀명 카드가 흔들리다 빙글 돌며 아래로 추락(scale 축소) → 바닥에서 CSS 불꽃(겹친 blob을 `blur`+`contrast` 또는 radial-gradient flicker) + Canvas 불티 입자 위로 → "불구덩이로…" 자막 → 연기 페이드. 만화풍 유지(과한 공포 금지). 효과음: 하강 휘슬(sine 1200→150Hz) → 쿵(noise burst + 저역) → 불 지글(필터드 노이즈) |
| 천국 | 5s | 화면이 밝아짐 → 아래에서 구름 레이어 2~3장 parallax로 떠오름 → 위에서 빛줄기(repeating-conic-gradient 회전, mask로 부드럽게) → 금빛 문 두 짝이 `rotateY`로 열리며 안쪽 강한 빛 → "천국 입성!" + 팀명 + 반짝이 입자. 효과음: 장조 화음 패드(sine 3~4음, 느린 attack) + 반짝 고음 |

공통 규칙
- 질문 화면 위에 덮지만 연출이 끝나면 오버레이를 완전히 제거(배경 움직임 최소화 원칙).
- `prefers-reduced-motion`은 TV 운영 특성상 무시하지 않고 shake·회전만 줄인다.
- 타이머는 일시정지 가능하게 관리(남은 시간 계산), CSS는 `animation-play-state: paused` 일괄 적용.
- 영상(MP4)이 있으면 영상 우선, 큰 자막은 영상 오류·타임아웃 시 대체 연출에 포함.

## 5. 가을 테마 (2026-10-01 사용자 피드백 반영)

"전체 디자인이 가을 느낌이 났으면 좋겠어." → 위 2장 보라 팔레트를 아래 가을 팔레트로 대체한다(리드 확정, `src/ui/tokens.css`와 같은 값).

| 용도 | 색 | 토큰 |
|---|---|---|
| 배경 | `#1E1410` | `--c-bg` |
| 면(보기·카드) | `#3A261A` | `--c-surface` |
| 주황(강조) | `#D9682B` | `--c-accent` |
| 황금(정답·빈칸) | `#FFCF6B` | `--c-correct` |
| 크림 글자 | `#FFF4E6` | `--c-text` |
| 단풍 빨강(하트·'땡!') | `#E2553B` | `--c-heart` |
| 빈 하트 | `#5A3E2E` | `--c-heart-empty` |
| 오답 플래시 | `#C8442F` | `--c-danger` |
| 올리브(보조) | `#8FA35B` | — |

모티프
- 정답: 호박빛 무대 조명 + **낙엽 폭죽**. 단풍잎(clip-path 17점 polygon)과 은행잎(부채꼴 polygon)이 위로 터졌다가 흔들리며(rotateY) 떨어진다. 색은 주황·단풍 빨강·황금·갈색. 자막은 황금빛.
- 오답: '땡!'은 단풍 빨강, 테두리는 붉은 비네트. 잃은 하트는 갈색으로 시들었다가 네 조각으로 바스러져 낙엽처럼 흔들리며 떨어진다(0.7초 유지).
- 천국: 가을 하늘(연한 하늘 `#BFD9EA` → 크림 → 노을빛 금색 `#FFCF6B` → `#E89A4F`), 크림색 구름, 문이 열리면 황금빛 은행잎·단풍잎이 문 주변에 흩날린다.
- 불구덩이: 연출은 그대로, 배경을 갈색(`#1E1410` → `#4A160A`) 톤으로.
- lite 모드: 낙엽 수 축소(정답 60→24, 천국 20→8), 흩날림은 1회만.

## 6. 출처

무대 조명
- Animated Spotlight Effect (tutsplus): https://codepen.io/tutsplus/pen/PqbPGZ — radial-gradient 스포트라이트
- Stage lights: https://codepen.io/asdraban/pen/pojxWGy — clip-path polygon 빔
- Animation spotlight moving: https://codepen.io/wikyware-net/pen/yLgayaR
- CSS Stage Curtains: https://codepen.io/Sinetheta/pen/kXvYRY

축하 입자
- canvas-confetti (아이디어 참고, 설치하지 않고 직접 구현): https://www.cssscript.com/canvas-confetti/
- Confetti with canvas 튜토리얼: https://webdesign.tutsplus.com/confetti-animation-canvas-javascript--cms-109130t

하트
- Broken Heart (클릭 시 깨짐): https://codepen.io/hennyta96/pen/WboZqP
- SVG Broken Heart: https://codepen.io/akoungmoris/pen/YWWzOB
- Twitter heart 애니메이션 해설: https://css-tricks.com/recreating-the-twitter-heart-animation/

불꽃
- CSS Flame Animation: https://codepen.io/dazulu/pen/nPeEeG
- Simple CSS-only Fire: https://codepen.io/yamanda/pen/RpNMaY
- CSS Fire (blur+contrast 기법): https://codepen.io/z-/pen/JXVpgp

천국 (구름·빛)
- CSS God Rays: https://codepen.io/piut0/pen/dyaezEN — repeating gradient + radial mask
- God rays volumetric lighting (canvas): https://codepen.io/_pwd_/pen/jeZwyW
- CSS Cloud Animation: https://codepen.io/claudz1/pen/mpMrvP
- clouds moving: https://codepen.io/antonioescudero/pen/zrxGve

효과음 합성
- Synthesising Sounds with Web Audio API: https://sonoport.github.io/synthesising-sounds-webaudio.html
- How to Add Sound to a Browser Game: https://dinogame.gg/blog/how-to-add-sound-to-browser-game/

폰트
- Black Han Sans: https://fonts.google.com/specimen/Black+Han+Sans
- Do Hyeon: https://fonts.google.com/specimen/Do+Hyeon
- Jua: https://fonts.google.com/specimen/Jua
