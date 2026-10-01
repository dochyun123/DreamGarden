// 연출 오버레이 CSS. 길이 단위는 오버레이 컨테이너 기준(cqw/cqh)이라
// host가 1920×1080 스테이지를 transform으로 축소하든 실제 픽셀이든 같은 비율로 그려진다.

export const STYLE_ID = 'ap-style';

export const CSS = `
.ap-overlay{position:absolute;inset:0;z-index:1000;overflow:hidden;container-type:size;pointer-events:none;
  font-family:var(--font-display,'Black Han Sans','Noto Sans KR','Malgun Gothic',sans-serif);color:var(--c-text,#FFF4E6);
  animation:ap-fade-in .15s ease-out both}
.ap-overlay.ap-paused,.ap-overlay.ap-paused *{animation-play-state:paused!important}
.ap-scene{position:absolute;inset:0}
.ap-scene.ap-out{animation:ap-fade-out .35s ease-in both}
.ap-overlay *{box-sizing:border-box}
.ap-video{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#000}

.ap-dim{position:absolute;inset:0;background:rgba(30,20,16,.8)}
.ap-flash{position:absolute;inset:0;animation:ap-flash .6s ease-out both}
.ap-caption{position:absolute;left:0;right:0;top:50%;transform:translateY(-50%);text-align:center;line-height:1.05}
.ap-big{display:block;font-size:22cqh;letter-spacing:.02em;paint-order:stroke fill;-webkit-text-stroke:1.4cqh var(--c-bg,#1E1410);
  filter:drop-shadow(0 1.2cqh 0 rgba(0,0,0,.45))}
.ap-sub{display:block;margin-top:3cqh;font-family:var(--font-sans,'Noto Sans KR','Malgun Gothic',sans-serif);font-weight:700;font-size:5.4cqh;
  text-shadow:0 .4cqh .8cqh rgba(0,0,0,.6)}

/* 정답 */
.ap-correct .ap-flash{background:radial-gradient(circle at 50% 50%,rgba(255,207,107,.85),rgba(217,104,43,.3) 45%,transparent 75%)}
.ap-correct .ap-big{color:var(--c-correct,#FFCF6B);-webkit-text-stroke-color:#5A2E0E;animation:ap-pop .55s cubic-bezier(.2,1.6,.4,1) both}
.ap-beam{position:absolute;top:-10cqh;width:28cqw;height:130cqh;transform-origin:50% 0;
  background:linear-gradient(to bottom,rgba(255,196,120,.6),rgba(217,104,43,.1) 80%,transparent);
  clip-path:polygon(44% 0,56% 0,100% 100%,0 100%);mix-blend-mode:screen}
.ap-beam.l{left:6cqw;animation:ap-swing-l 1.6s ease-in-out both}
.ap-beam.r{right:6cqw;animation:ap-swing-r 1.6s ease-in-out both}
.ap-leaf,.ap-drift{position:absolute;width:calc(3.2cqw * var(--s,1));height:calc(3.2cqw * var(--s,1))}
.ap-leaf{top:50%;left:50%;animation:ap-leaf-burst var(--d) cubic-bezier(.2,.7,.4,1) var(--delay) both}
.maple{clip-path:polygon(50% 0,60% 22%,78% 12%,72% 38%,98% 32%,84% 54%,94% 62%,62% 70%,54% 100%,46% 100%,38% 70%,6% 62%,16% 54%,2% 32%,28% 38%,22% 12%,40% 22%)}
.ginkgo{clip-path:polygon(50% 100%,46% 72%,12% 42%,0 20%,10% 6%,28% 1%,44% 8%,50% 22%,56% 8%,72% 1%,90% 6%,100% 20%,88% 42%,54% 72%)}

/* 오답 */
.ap-wrong .ap-flash{background:radial-gradient(ellipse at 50% 50%,transparent 35%,rgba(200,68,47,.75))}
.ap-wrong .ap-shake{position:absolute;inset:0;animation:ap-shake .4s linear both}
.ap-wrong .ap-big{color:var(--c-heart,#E2553B);-webkit-text-stroke-color:#3A1008;animation:ap-drop .45s cubic-bezier(.3,1.5,.5,1) both}
.ap-hide{animation:ap-fade-out .25s ease-in both}

/* 하트 소멸 */
.ap-hearts{position:absolute;left:0;right:0;top:50%;transform:translateY(-50%);display:flex;flex-direction:column;align-items:center;gap:3cqh;
  animation:ap-fade-in .15s ease-out both}
.ap-heart-row{display:flex;gap:4cqw}
.ap-heart{position:relative;width:18cqh;height:18cqh}
.ap-heart svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.ap-heart .full path,.ap-heart .frag path{fill:var(--c-heart,#E2553B);stroke:var(--c-bg,#1E1410);stroke-width:1.5}
.ap-heart .empty path{fill:none;stroke:var(--c-heart-empty,#5A3E2E);stroke-width:2}
/* 잃은 하트: 갈색으로 시들며 부풀었다가 → 네 조각으로 바스러져 낙엽처럼 흔들리며 떨어진다 */
.ap-heart.ap-lost .full{animation:ap-heart-swell .2s ease-out both}
.ap-heart.ap-lost .full path{animation:ap-wither .2s ease-in both}
.ap-heart.ap-lost .frag{opacity:0}
.ap-heart.ap-break .full{display:none}
.ap-heart.ap-break .frag{opacity:1}
.ap-heart.ap-break .frag path{fill:#A0522D}
.ap-heart.ap-break .frag.f1{clip-path:polygon(0 0,50% 0,46% 35%,0 50%);--sx:-5cqh;--fr:-70deg;animation:ap-crumble .5s ease-in both}
.ap-heart.ap-break .frag.f2{clip-path:polygon(50% 0,100% 0,100% 45%,58% 40%,46% 35%);--sx:4cqh;--fr:60deg;animation:ap-crumble .45s ease-in .03s both}
.ap-heart.ap-break .frag.f3{clip-path:polygon(0 50%,46% 35%,58% 40%,52% 70%,30% 100%,0 100%);--sx:-3cqh;--fr:40deg;animation:ap-crumble .5s ease-in .02s both}
.ap-heart.ap-break .frag.f4{clip-path:polygon(58% 40%,100% 45%,100% 100%,30% 100%,52% 70%);--sx:6cqh;--fr:-45deg;animation:ap-crumble .48s ease-in both}
.ap-lives{font-family:var(--font-sans,'Noto Sans KR','Malgun Gothic',sans-serif);font-weight:700;font-size:5.6cqh;text-shadow:0 .4cqh .8cqh rgba(0,0,0,.6)}

/* 불구덩이 */
.ap-inferno{background:linear-gradient(to bottom,#1E1410 0%,#2E120A 60%,#4A160A 100%)}
.ap-inferno .ap-rumble{position:absolute;inset:0;animation:ap-shake .8s linear both}
.ap-card{position:absolute;left:50%;top:38%;transform:translate(-50%,-50%);padding:3cqh 5cqw;border-radius:2cqh;
  background:var(--c-surface,#3A261A);border:.5cqh solid var(--c-accent,#D9682B);font-size:9cqh;white-space:nowrap;animation:ap-wobble .8s ease-in-out both}
.ap-card.ap-fall{animation:ap-fall 1.3s cubic-bezier(.55,0,.9,.5) both}
.ap-pit{position:absolute;left:50%;bottom:-6cqh;width:70cqw;height:16cqh;transform:translateX(-50%);border-radius:50%;
  background:radial-gradient(ellipse at 50% 40%,#000 30%,#2E120A 70%,transparent 72%);animation:ap-pit-open .6s ease-out both}
.ap-fire{position:absolute;left:0;right:0;bottom:0;height:62cqh;filter:blur(1.2cqh) contrast(1.6);opacity:0;mix-blend-mode:screen}
.ap-fire.on{opacity:1;animation:ap-rise .5s ease-out both}
.ap-flame{position:absolute;bottom:-8cqh;width:var(--w);height:var(--h);left:var(--x);border-radius:50% 50% 45% 45%/60% 60% 40% 40%;
  background:radial-gradient(ellipse at 50% 85%,#FFC93C 0%,#FF7A1A 40%,#FF3D00 70%,transparent 72%);
  transform-origin:50% 100%;animation:ap-flicker var(--d) ease-in-out var(--delay) infinite alternate}
.ap-ember{position:absolute;bottom:0;left:var(--x);width:.7cqh;height:.7cqh;border-radius:50%;background:#FFC93C;
  box-shadow:0 0 1.2cqh #FF7A1A;animation:ap-ember var(--d) ease-out var(--delay) both}
.ap-inferno .ap-big{color:#FFC93C;-webkit-text-stroke-color:#5A0A00;font-size:15cqh;animation:ap-pop .5s cubic-bezier(.2,1.6,.4,1) both}
.ap-inferno .ap-caption{top:34%}

/* 천국 */
.ap-heaven{background:linear-gradient(to bottom,#1E1410,#3A261A);animation:ap-fade-in .15s both}
.ap-sky{position:absolute;inset:0;background:linear-gradient(to bottom,#BFD9EA 0%,#F3E6CF 48%,#FFCF6B 80%,#E89A4F 100%);
  animation:ap-fade-in 1.2s ease-out both}
.ap-rays{position:absolute;left:50%;top:40%;width:150cqw;height:150cqw;margin:-75cqw 0 0 -75cqw;opacity:0;will-change:transform,opacity;
  background:repeating-conic-gradient(rgba(255,240,205,.6) 0deg 6deg,transparent 6deg 18deg);
  -webkit-mask:radial-gradient(circle,#000 0%,transparent 45%);mask:radial-gradient(circle,#000 0%,transparent 45%)}
.ap-rays.on{animation:ap-rays-in 1s ease-out both,ap-spin 24s linear infinite}
.ap-gate{position:absolute;left:50%;top:44%;width:34cqh;height:48cqh;transform:translate(-50%,-50%);perspective:120cqh;opacity:0}
.ap-gate.on{animation:ap-fade-in .6s ease-out both}
.ap-gate-glow{position:absolute;inset:0;border-radius:17cqh 17cqh 0 0;background:radial-gradient(ellipse at 50% 60%,#fff 20%,#FFF4E6 50%,#FFCF6B 100%);
  box-shadow:0 0 12cqh 4cqh rgba(255,236,200,.9)}
.ap-door{position:absolute;top:0;bottom:0;width:50%;background:linear-gradient(135deg,#F6DC8A,#E8C25A 50%,#B8902E);
  border:.6cqh solid #FFF1BF;transition:transform 1.4s cubic-bezier(.3,.1,.2,1)}
.ap-door.l{left:0;border-radius:17cqh 0 0 0;transform-origin:0 50%}
.ap-door.r{right:0;border-radius:0 17cqh 0 0;transform-origin:100% 50%}
.ap-gate.open .ap-door.l{transform:rotateY(-105deg)}
.ap-gate.open .ap-door.r{transform:rotateY(105deg)}
.ap-cloud{position:absolute;bottom:-12cqh;width:var(--w);height:var(--h);left:var(--x);border-radius:50%;background:#FFF4E6;
  box-shadow:calc(var(--h)*.6) calc(var(--h)*-.25) 0 calc(var(--h)*-.08) #FFF4E6,calc(var(--h)*-.6) calc(var(--h)*-.15) 0 calc(var(--h)*-.12) #FFF4E6;
  animation:ap-cloud-up 1.6s cubic-bezier(.2,.8,.3,1) var(--delay) both}
.ap-drift{top:-8cqh;left:var(--x);animation:ap-drift var(--d) linear var(--delay) infinite}
.ap-sparkle{position:absolute;left:var(--x);top:var(--y);width:1.4cqh;height:1.4cqh;background:#FFF4E6;
  clip-path:polygon(50% 0,62% 38%,100% 50%,62% 62%,50% 100%,38% 62%,0 50%,38% 38%);
  animation:ap-twinkle 1.1s ease-in-out var(--delay) infinite}
.ap-heaven .ap-caption{top:auto;bottom:6cqh;transform:none}
.ap-heaven .ap-big{color:var(--c-correct,#FFCF6B);-webkit-text-stroke-color:#5A2E0E;font-size:15cqh;animation:ap-pop .6s cubic-bezier(.2,1.6,.4,1) both}
.ap-heaven .ap-sub{color:var(--c-surface,#3A261A);text-shadow:0 0 1.5cqh #FFF4E6}

/* 저사양 모드 (?lite=1): 큰 필터·블렌딩·무한 회전 제거 */
.ap-lite .ap-fire{filter:none;mix-blend-mode:normal}
.ap-lite .ap-flame{background:radial-gradient(ellipse at 50% 85%,#FFC93C 0%,#FF7A1A 45%,rgba(255,61,0,.85) 68%,transparent 72%)}
.ap-lite .ap-ember{box-shadow:none}
.ap-lite .ap-beam{mix-blend-mode:normal}
.ap-lite .ap-rays.on{animation:ap-rays-in 1s ease-out both}
.ap-lite .ap-sparkle{animation-iteration-count:2}
.ap-lite .ap-drift{animation-iteration-count:1}
.ap-lite .ap-big{filter:none;text-shadow:0 1.2cqh 0 rgba(0,0,0,.45)}

@keyframes ap-fade-in{from{opacity:0}to{opacity:1}}
@keyframes ap-fade-out{from{opacity:1}to{opacity:0}}
@keyframes ap-flash{0%{opacity:0}15%{opacity:1}100%{opacity:.35}}
@keyframes ap-pop{0%{transform:scale(.3);opacity:0}60%{transform:scale(1.15);opacity:1}100%{transform:scale(1)}}
@keyframes ap-drop{0%{transform:translateY(-40cqh);opacity:0}70%{transform:translateY(2cqh);opacity:1}100%{transform:none}}
@keyframes ap-shake{0%,100%{transform:none}10%,50%,90%{transform:translateX(-.65cqw)}30%,70%{transform:translateX(.65cqw)}}
@keyframes ap-swing-l{0%{transform:rotate(-35deg);opacity:0}25%{opacity:1}100%{transform:rotate(20deg)}}
@keyframes ap-swing-r{0%{transform:rotate(35deg);opacity:0}25%{opacity:1}100%{transform:rotate(-20deg)}}
@keyframes ap-leaf-burst{0%{transform:translate(-50%,-50%) scale(.3) rotate(0) rotateY(0);opacity:1}
  35%{transform:translate(calc(-50% + var(--tx)),calc(-50% + var(--ty))) scale(1) rotate(calc(var(--r) * .3)) rotateY(180deg)}
  75%{opacity:1}
  100%{transform:translate(calc(-50% + var(--tx) + var(--sway)),calc(-50% + var(--ty) + var(--fall))) scale(1) rotate(var(--r)) rotateY(540deg);opacity:0}}
@keyframes ap-drift{0%{transform:translate(0,0) rotate(0) rotateY(0)}
  25%{transform:translate(var(--sway),28cqh) rotate(calc(var(--r) * .25)) rotateY(120deg)}
  50%{transform:translate(0,56cqh) rotate(calc(var(--r) * .5)) rotateY(240deg)}
  75%{transform:translate(var(--sway),84cqh) rotate(calc(var(--r) * .75)) rotateY(360deg)}
  100%{transform:translate(0,115cqh) rotate(var(--r)) rotateY(480deg)}}
@keyframes ap-heart-swell{0%{transform:scale(1)}100%{transform:scale(1.25)}}
@keyframes ap-wither{to{fill:#B5562E}}
@keyframes ap-crumble{0%{transform:none;opacity:1}
  40%{transform:translate(calc(var(--sx) * .6),4cqh) rotate(calc(var(--fr) * .4))}
  70%{transform:translate(calc(var(--sx) * -.2),10cqh) rotate(calc(var(--fr) * .8));opacity:.9}
  100%{transform:translate(var(--sx),17cqh) rotate(var(--fr));opacity:0}}
@keyframes ap-wobble{0%,100%{transform:translate(-50%,-50%) rotate(0)}20%{transform:translate(-50%,-50%) rotate(-6deg)}
  40%{transform:translate(-50%,-50%) rotate(6deg)}60%{transform:translate(-50%,-50%) rotate(-8deg)}80%{transform:translate(-50%,-50%) rotate(8deg)}}
@keyframes ap-fall{0%{transform:translate(-50%,-50%) rotate(0) scale(1)}100%{transform:translate(-50%,70cqh) rotate(900deg) scale(.15);opacity:.6}}
@keyframes ap-pit-open{from{transform:translateX(-50%) scaleX(0)}to{transform:translateX(-50%) scaleX(1)}}
@keyframes ap-rise{from{transform:translateY(40cqh)}to{transform:none}}
@keyframes ap-flicker{0%{transform:scaleY(.85) skewX(-4deg)}100%{transform:scaleY(1.15) skewX(4deg)}}
@keyframes ap-ember{0%{transform:none;opacity:1}100%{transform:translate(var(--tx),-70cqh);opacity:0}}
@keyframes ap-rays-in{from{opacity:0}to{opacity:1}}
@keyframes ap-spin{to{transform:rotate(360deg)}}
@keyframes ap-cloud-up{from{transform:translateY(40cqh)}to{transform:none}}
@keyframes ap-twinkle{0%,100%{transform:scale(.3);opacity:.2}50%{transform:scale(1.2);opacity:1}}
`;

export function ensureStyles(doc: Document): void {
  if (doc.getElementById(STYLE_ID)) return;
  const el = doc.createElement('style');
  el.id = STYLE_ID;
  el.textContent = CSS;
  doc.head.appendChild(el);
}
