// 연출 오버레이 CSS — 픽셀아트(마인크래프트·스타듀밸리풍). 각진 모양 + steps() 계단식 움직임.
// 길이 단위는 오버레이 컨테이너 기준(cqw/cqh)이라 host가 1920×1080 스테이지를 transform으로
// 축소하든 실제 픽셀이든 같은 비율로 그려진다.
import galmuri from 'galmuri/dist/Galmuri11.woff2?url';
import galmuriBold from 'galmuri/dist/Galmuri11-Bold.woff2?url';

export const STYLE_ID = 'ap-style';

/** 글자 테두리 (8방향 딱딱한 그림자) — --o 색 */
const OUTLINE = (w: string) =>
  [`${w} 0`, `-${w} 0`, `0 ${w}`, `0 -${w}`, `${w} ${w}`, `-${w} ${w}`, `${w} -${w}`, `-${w} -${w}`]
    .map((o) => `${o} 0 var(--o,#000)`)
    .join(',');

export const CSS = `
@font-face{font-family:ApGalmuri;src:url(${galmuri}) format('woff2');font-weight:400;font-display:block}
@font-face{font-family:ApGalmuri;src:url(${galmuriBold}) format('woff2');font-weight:700;font-display:block}
.ap-overlay{position:absolute;inset:0;z-index:1000;overflow:hidden;container-type:size;pointer-events:none;
  font-family:ApGalmuri,Galmuri11,monospace;font-weight:700;color:#fff;image-rendering:pixelated;
  -webkit-font-smoothing:none;font-smooth:never;animation:ap-fade-in .15s steps(2) both}
.ap-overlay.ap-modal{pointer-events:auto;cursor:pointer}
.ap-overlay.ap-paused,.ap-overlay.ap-paused *{animation-play-state:paused!important}
.ap-overlay *{box-sizing:border-box}
.ap-overlay svg{display:block;width:100%;height:auto}
.ap-overlay .ap-bg{position:absolute;inset:0;height:100%}
.ap-scene{position:absolute;inset:0}
.ap-scene.ap-out{animation:ap-fade-out .3s steps(3) both}
.ap-video{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#000}

.ap-dim{position:absolute;inset:0;background:rgba(12,10,24,.75)}
.ap-flash{position:absolute;inset:0;animation:ap-flash .3s steps(3) both}
.ap-caption{position:absolute;left:0;right:0;top:50%;transform:translateY(-50%);text-align:center;line-height:1.2}
.ap-big{display:inline-block;font-size:20cqh;color:var(--cap,#fff);text-shadow:${OUTLINE('.8cqh')},0 2cqh 0 rgba(0,0,0,.45);
  animation:ap-pop .4s steps(4) both}
.ap-hide{animation:ap-fade-out .2s steps(2) both}

/* 별 반짝이 */
.ap-star{position:absolute;left:var(--x);top:var(--y);width:3.5cqh}
.ap-burst{left:50%;top:50%;animation:ap-burst .9s steps(6) both}
.ap-dream{width:2.5cqh;animation:ap-blink 1.2s steps(1,end) var(--delay) infinite}
.ap-twinkle{animation:ap-blink .6s steps(1,end) var(--delay) infinite}

/* 눈꺼풀 */
.ap-lid{position:absolute;left:0;right:0;height:50%;background:#000;transition:height .3s steps(4)}
.ap-lid.top{top:0}
.ap-lid.bot{bottom:0}
.ap-lid.snap{transition:height .12s steps(2)}

/* 인트로 */
.ap-intro{background:#000}
.ap-station{position:absolute;inset:0;filter:blur(1.6cqh) brightness(.45) saturate(.4);transition:filter 1s steps(5)}
.ap-station.clear{filter:blur(0) brightness(1) saturate(1)}
.ap-intro.awake .ap-dream{animation:ap-fade-out .4s steps(2) both}

/* 정답 */
.ap-correct .ap-flash{background:#FFF3B0}
.ap-correct .ap-big{--cap:#FFE066;--o:#5A3A00}

/* 오답 */
.ap-wrong .ap-flash{background:#E8343F}
.ap-wrong .ap-shake{position:absolute;inset:0;animation:ap-shake .4s steps(1,end) both}
.ap-wrong .ap-big{--cap:#FF5A5A;--o:#3A0A0A}

/* 하트 — 13×12 격자. 잃은 하트는 깜빡인 뒤 지그재그로 금이 가며 두 쪽으로 갈라져 떨어진다 */
.ap-hearts{position:absolute;left:0;right:0;top:50%;transform:translateY(-50%);display:flex;justify-content:center;gap:4cqw;
  animation:ap-fade-in .1s steps(1) both}
.ap-heart{position:relative;width:20cqh;height:18.5cqh}
.ap-heart>svg,.ap-half{position:absolute;inset:0}
.ap-half.l{clip-path:polygon(0 0,46.15% 0,46.15% 25%,38.46% 25%,38.46% 50%,53.85% 50%,53.85% 75%,46.15% 75%,46.15% 100%,0 100%)}
.ap-half.r{clip-path:polygon(46.15% 0,100% 0,100% 100%,46.15% 100%,46.15% 75%,53.85% 75%,53.85% 50%,38.46% 50%,38.46% 25%,46.15% 25%)}
.ap-heart.ap-lost .ap-half{animation:ap-blink .1s steps(1,end) 2}
.ap-heart.ap-break .ap-half.l{animation:ap-split-l .5s steps(5) both}
.ap-heart.ap-break .ap-half.r{animation:ap-split-r .5s steps(5) both}

/* 천국 */
.ap-heaven{background:#4FA8F0}
.ap-sky{position:absolute;inset:0;animation:ap-fade-in .6s steps(4) both}
.ap-rays{position:absolute;inset:0;opacity:0}
.ap-rays.on{opacity:1}
.ap-ray{position:absolute;top:0;height:72%;left:var(--x);width:5cqw;background:rgba(255,255,235,.35);
  animation:ap-ray 1.2s steps(1,end) var(--delay) infinite}
.ap-gate{position:absolute;left:50%;top:22cqh;width:42cqh;height:48cqh;margin-left:-21cqh;opacity:0}
.ap-gate.on{animation:ap-fade-in .4s steps(4) both}
.ap-gate-light{position:absolute;left:6cqh;right:6cqh;top:3cqh;bottom:0;background:#FFFDF0;
  box-shadow:0 0 0 1.5cqh rgba(255,250,210,.6),0 0 0 3cqh rgba(255,240,180,.3)}
.ap-door{position:absolute;top:9cqh;width:15cqh;height:39cqh;transition:transform .8s steps(5)}
.ap-door.l{left:6cqh;transform-origin:0 50%}
.ap-door.r{right:6cqh;transform-origin:100% 50%}
.ap-gate.open .ap-door{transform:scaleX(.07)}
.ap-gate-frame-wrap{position:absolute;inset:0}
.ap-gate-frame-wrap svg{height:100%}
.ap-cloud{position:absolute;bottom:-3cqh;left:var(--x);width:var(--w);animation:ap-rise-in .8s steps(4) var(--delay) both}
.ap-heaven .ap-caption{top:3cqh;transform:none}
.ap-heaven .ap-big{font-size:9cqh;--cap:#FFE066;--o:#7A4A00;text-shadow:${OUTLINE('.6cqh')},0 1cqh 0 rgba(0,0,0,.3)}
.ap-verse{display:block;margin-top:1cqh;font-size:6cqh;color:#fff;--o:#1D3A6E;text-shadow:${OUTLINE('.5cqh')};
  animation:ap-pop .4s steps(4) .2s both}

/* 불구덩이 */
.ap-inferno{background:#000}
.ap-quake{position:absolute;inset:-3cqh -3cqw}
.ap-quake.hard{animation:ap-quake .2s steps(1,end) infinite}
.ap-shaft{position:absolute;left:0;right:0;top:0;height:113.34cqh;animation:ap-scroll .2s steps(4) infinite}
.ap-glow{position:absolute;inset:0;opacity:0;transition:opacity 1.2s steps(6);
  background:linear-gradient(to top,rgba(255,90,20,.8) 0 15%,rgba(255,90,20,.5) 15% 30%,rgba(255,90,20,.25) 30% 45%,transparent 45%)}
.ap-glow.on{opacity:1}
.ap-fire{position:absolute;left:0;right:0;bottom:0;height:50cqh;animation:ap-rise-in .6s steps(6) both}
.ap-fire::before{content:'';position:absolute;left:0;right:0;bottom:0;height:10cqh;background:#C0261B;
  box-shadow:0 -2cqh 0 #FF7A1A}
.ap-flame{position:absolute;bottom:4cqh;left:var(--x);width:var(--w);transform-origin:50% 100%;
  animation:ap-flick var(--d) steps(1,end) infinite}
.ap-ember{position:absolute;bottom:12cqh;left:var(--x);width:1.2cqh;height:1.2cqh;background:#FFD23F;
  animation:ap-ember var(--d) steps(8) var(--delay) infinite}
.ap-black{position:absolute;inset:0;background:#000;opacity:0}
.ap-black.on{animation:ap-fade-in .6s steps(4) both}
.ap-room{position:absolute;inset:0}
.ap-room.jolt{animation:ap-shake .3s steps(1,end) 2}

/* 대사 상자 (스타듀밸리풍) */
.ap-dlg{position:absolute;left:12cqw;right:12cqw;bottom:5cqh;height:20cqh;padding:3.4cqh 4cqw;z-index:10;
  background:#FCE3B4;color:#4A2A12;border:1.2cqh solid #A0612B;
  box-shadow:0 0 0 .8cqh #4A2A12,inset 0 0 0 .8cqh #E8B878,0 1.6cqh 0 .8cqh rgba(0,0,0,.35);
  font-size:6.4cqh;line-height:1.3;animation:ap-pop .25s steps(3) both}
.ap-dlg-next{position:absolute;right:2.4cqw;bottom:1.2cqh;font-size:4.4cqh;color:#C0392B;visibility:hidden}
.ap-dlg-next.on{visibility:visible;animation:ap-blink .8s steps(1,end) infinite}

/* 저사양 모드 (?lite=1): blur 필터·무한 반복 줄이기 */
.ap-lite .ap-station{filter:brightness(.45)}
.ap-lite .ap-station.clear{filter:brightness(1)}
.ap-lite .ap-ray{animation:none}
.ap-lite .ap-ember{animation-iteration-count:1}

@keyframes ap-fade-in{from{opacity:0}to{opacity:1}}
@keyframes ap-fade-out{from{opacity:1}to{opacity:0}}
@keyframes ap-flash{from{opacity:.8}to{opacity:0}}
@keyframes ap-pop{0%{transform:scale(.3)}60%{transform:scale(1.15)}100%{transform:scale(1)}}
@keyframes ap-blink{50%{opacity:0}}
@keyframes ap-burst{0%{transform:translate(-50%,-50%) scale(.5);opacity:1}
  80%{opacity:1}100%{transform:translate(calc(-50% + var(--tx)),calc(-50% + var(--ty))) scale(1.2);opacity:0}}
@keyframes ap-shake{0%,100%{transform:none}25%{transform:translate(-1.2cqw,0)}50%{transform:translate(1.2cqw,.8cqh)}75%{transform:translate(-.6cqw,-.8cqh)}}
@keyframes ap-quake{0%{transform:translate(-2cqw,1cqh)}25%{transform:translate(2cqw,-1cqh)}50%{transform:translate(-1cqw,-2cqh)}75%{transform:translate(1.5cqw,2cqh)}}
@keyframes ap-split-l{to{transform:translate(-5cqh,16cqh) rotate(-30deg);opacity:0}}
@keyframes ap-split-r{to{transform:translate(5cqh,16cqh) rotate(30deg);opacity:0}}
@keyframes ap-ray{0%{opacity:.4}50%{opacity:1}}
@keyframes ap-rise-in{from{transform:translateY(100%)}to{transform:none}}
@keyframes ap-scroll{from{transform:none}to{transform:translateY(-13.33cqh)}}
@keyframes ap-flick{0%{transform:none}50%{transform:scaleX(-1) scaleY(1.1)}}
@keyframes ap-ember{from{transform:none;opacity:1}to{transform:translateY(-60cqh);opacity:0}}
`;

export function ensureStyles(doc: Document): void {
  if (doc.getElementById(STYLE_ID)) return;
  const el = doc.createElement('style');
  el.id = STYLE_ID;
  el.textContent = CSS;
  doc.head.appendChild(el);
}
