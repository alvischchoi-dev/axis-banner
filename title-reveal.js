// Same mask direction and expo-out curve as the approved closing wordmark.
// The painted field fades in first, then all six words share one continuous clock.
const title = document.querySelector('.banner-title');
const words = [...title.querySelectorAll('.title-word')];
const field = document.querySelector('#field');
const artwork = document.querySelector('.artwork');
const logo = document.querySelector('.banner-logo');
const description = document.querySelector('.banner-description');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const EASING = 'cubic-bezier(0.16, 1, 0.3, 1)';
const FADE_EASING = 'cubic-bezier(0.4, 0, 0.2, 1)';
const BACKGROUND_DURATION = 1000;
const DURATION = 1100;
const STAGGER = 75;
const LEAD = BACKGROUND_DURATION + 100;
const TITLE_END = LEAD + (words.length - 1) * STAGGER + DURATION;
const DESCRIPTION_LEAD = TITLE_END + 100;
let animations = [];
let sequence = 0;
let sceneReady = false;

function showStatic() {
  sequence++;
  animations.forEach(animation => animation.cancel());
  animations = [];
  document.documentElement.classList.remove('banner-motion', 'title-motion');
  title.dataset.reveal = 'static';
  artwork.dataset.entrance = 'static';
}

function syncPlayback() {
  if (!animations.length) return;
  const paused = document.hidden || field.dataset.state === 'paused';
  for (const animation of animations) {
    if (animation.playState === 'finished') continue;
    if (paused && animation.playState !== 'paused') animation.pause();
    if (!paused && animation.playState === 'paused') animation.play();
  }
  if (title.dataset.reveal !== 'settled') title.dataset.reveal = paused ? 'paused' : 'revealing';
}

function replay() {
  if (!sceneReady) return;
  if (reducedMotion.matches) { showStatic(); return; }
  const currentSequence = ++sequence;
  animations.forEach(animation => animation.cancel());
  document.documentElement.classList.add('banner-motion', 'title-motion');
  // Supplying a shared start time also keeps the background and copy in sequence.
  const startTime = document.timeline.currentTime;
  function animate(element, keyframes, options) {
    const animation = element.animate(keyframes, { ...options, fill: 'both' });
    animation.startTime = startTime;
    return animation;
  }
  const background = animate(field, [{ opacity: 0 }, { opacity: 1 }], {
    duration: BACKGROUND_DURATION, easing: FADE_EASING,
  });
  const titleAnimations = words.map((word, index) => animate(word, [
    { transform: 'translate3d(0, 145%, 0)' },
    { transform: 'translate3d(0, 0, 0)' },
  ], { duration: DURATION, delay: LEAD + index * STAGGER, easing: EASING }));
  animations = [
    background,
    animate(logo, [{ opacity: 0 }, { opacity: 1 }], {
      duration: 500, delay: LEAD, easing: FADE_EASING,
    }),
    animate(description, [{ opacity: 0 }, { opacity: 1 }], {
      duration: 700, delay: DESCRIPTION_LEAD, easing: FADE_EASING,
    }),
    ...titleAnimations,
  ];
  artwork.dataset.entrance = 'background';
  title.dataset.reveal = 'revealing';
  syncPlayback();
  background.finished.then(() => {
    if (sequence === currentSequence) artwork.dataset.entrance = 'title';
  }).catch(() => {});
  Promise.all(titleAnimations.map(animation => animation.finished)).then(() => {
    if (sequence !== currentSequence) return;
    title.dataset.reveal = 'settled';
    artwork.dataset.entrance = 'subtitle';
  }).catch(() => {});
  Promise.all(animations.map(animation => animation.finished)).then(() => {
    if (sequence !== currentSequence) return;
    document.documentElement.classList.remove('banner-motion', 'title-motion');
    animations.forEach(animation => animation.cancel());
    animations = [];
    title.dataset.reveal = 'settled';
    artwork.dataset.entrance = 'settled';
  }).catch(() => {}); // Restart cancels the preceding sequence.
}

document.querySelector('#restart').addEventListener('click', replay);
document.addEventListener('keydown', event => {
  if (['INPUT', 'BUTTON', 'A', 'TEXTAREA'].includes(event.target.tagName)) return;
  if (event.key.toLowerCase() === 'r') replay();
});
new MutationObserver(syncPlayback).observe(field, { attributes: true, attributeFilter: ['data-state'] });
document.addEventListener('visibilitychange', syncPlayback);
reducedMotion.addEventListener('change', () => reducedMotion.matches ? showStatic() : replay());

if (reducedMotion.matches) showStatic();
// reportState writes rays only after paintFrame: do not fade an empty canvas.
async function waitForFieldPaint() {
  await new Promise(resolve => {
    function check() {
      if (field.dataset.rays && field.width > 0 && field.height > 0) resolve();
      else requestAnimationFrame(check);
    }
    check();
  });
  // RAF waits for a visible document, including a page opened in the background.
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}
await Promise.all([
  document.fonts.load('400 1em "PP Fragment Sans"').catch(() => {}),
  document.fonts.load('400 1em "Neue Montreal"').catch(() => {}),
  logo.decode().catch(() => {}),
  waitForFieldPaint(),
]);
sceneReady = true;
replay();
