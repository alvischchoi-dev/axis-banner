import { restingFieldColor } from './color.js?revision=3115e65a740e';

// A single measured composition feeds both the overlay and the field.
// Font measurements, rather than a device name, decide when the title fits.
export const MIN_HERO_HEIGHT = 360;
export const MAX_BUFFER_PIXELS = 6_000_000;
export const TITLE_PHRASES = ['A New Center of', 'Financial Gravity'];
// Headless defaults; the browser reads the named type tokens from style.css.
export const TITLE_TYPE_SCALE = Object.freeze({ portraitMin: 2.25, portraitBase: 1.125, portraitFluid: .05625, portraitMax: 5 });
export const SUBTITLE_TYPE_SCALE = Object.freeze({ mobileMin: 1.125, portraitMax: 1.25, desktopMin: 1, desktopMax: 1.875, lineHeight: 1.2 });
const VERTICAL_LINES = [['A New', 'Center of'], ['Financial', 'Gravity']];
const COPY = ['Axis is the decentralized force pulling', 'the future of investing into focus.'];
const clamp = (low, value, high) => Math.max(low, Math.min(value, high));

// Browser controls can reduce the visible viewport; pinch zoom must not
// rearrange the document's composition.
export function usableViewportHeight(innerHeight, viewport) {
  return viewport && Math.abs((viewport.scale ?? 1) - 1) < .01
    ? Math.min(innerHeight, viewport.height) : innerHeight;
}

export function bufferDimensions(width, height, deviceRatio = 1, qualityCap = 1.5) {
  const ratio = Math.min(deviceRatio || 1, 1.5, qualityCap, Math.sqrt(MAX_BUFFER_PIXELS / (width * height)));
  return { ratio, width: Math.max(1, Math.floor(width * ratio)), height: Math.max(1, Math.floor(height * ratio)) };
}

export function wrappedLines(text, available, measure) {
  let lines = 1, line = '';
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (line && measure(next) > available + .1) { lines++; line = word; }
    else line = next;
  }
  return lines;
}

export function resolveLayout({ width, height, rootSize = 16, safe = {}, measureTitle, measureCopy, logoAspect = 2.519, contactHeight = 0, titleTypeScale = TITLE_TYPE_SCALE, subtitleTypeScale = SUBTITLE_TYPE_SCALE }) {
  width = Math.max(1, width); height = Math.max(1, height);
  const short = height < 500;
  const padding = Math.min(short ? 24 : 96, Math.max(20, width * .0375));
  const left = padding + (safe.left || 0), right = padding + (safe.right || 0);
  const top = Math.max(20, padding * 8 / 9) + (safe.top || 0), bottom = padding + (safe.bottom || 0);
  const usable = Math.max(1, width - left - right), gutter = Math.min(32, width * .0125);
  const column = Math.max(1, (usable - 11 * gutter) / 12), half = 5 * column + 4 * gutter;
  const textScale = rootSize / 16;
  const horizontalFont = Math.min(short ? 3 * rootSize : Infinity, clamp(2.25 * rootSize, width * 94 / 1920 * textScale, 7.25 * rootSize));
  const verticalFont = Math.min(short ? 3 * rootSize : Infinity, clamp(titleTypeScale.portraitMin * rootSize,
    titleTypeScale.portraitBase * rootSize + width * titleTypeScale.portraitFluid * textScale, titleTypeScale.portraitMax * rootSize));
  const titleMeasure = (text, size) => measureTitle ? measureTitle(text, size) : text.length * size * .47;
  const copyMeasure = (text, size) => measureCopy ? measureCopy(text, size) : text.length * size * .49;
  const haloAt = h => Math.max(12, Math.min(width, h) * .06) * 1.08;
  const titleGap = clamp(2.25 * rootSize, width * .1125, 4 * rootSize);
  let heroHeight = Math.max(MIN_HERO_HEIGHT, height);
  const horizontalClearance = width / 2 - left - half;
  const fits = TITLE_PHRASES.every(text => titleMeasure(text, horizontalFont) <= half + .1);
  let mode = width >= 768 && width / heroHeight >= 4 / 3 && fits
    && horizontalClearance >= haloAt(heroHeight) + 24 ? 'horizontal' : 'vertical';
  let titleSize, copySize, startHeight, endHeight, descriptionHeight, logoWidth, copyWidth;
  // Enlarged text can extend the hero, retaining the fixed 49% center.
  for (let pass = 0; pass < 5; pass++) {
    titleSize = mode === 'horizontal' ? horizontalFont : verticalFont;
    copySize = mode === 'horizontal'
      ? short ? subtitleTypeScale.desktopMin * rootSize
        : clamp(subtitleTypeScale.desktopMin * rootSize, width / 64 * textScale, subtitleTypeScale.desktopMax * rootSize)
      : clamp(subtitleTypeScale.mobileMin * rootSize, width / 48 * textScale, subtitleTypeScale.portraitMax * rootSize);
    logoWidth = clamp(84, width / 15, short ? 96 : 144);
    const phraseHeight = index => (mode === 'horizontal' ? [TITLE_PHRASES[index]] : VERTICAL_LINES[index])
      .reduce((lines, text) => lines + wrappedLines(text, mode === 'horizontal' ? half : usable, value => titleMeasure(value, titleSize)), 0) * titleSize;
    startHeight = phraseHeight(0); endHeight = phraseHeight(1);
    // Preserve complete phrases at the approved type size. Small screens
    // and enlarged text wrap naturally rather than shrinking the type.
    const phraseWidth = Math.max(...COPY.map(text => copyMeasure(text, copySize))) + 2;
    copyWidth = mode === 'horizontal' ? Math.min(usable, width * .3625)
      : Math.min(usable, Math.max(Math.min(usable * 2 / 3, 560), phraseWidth));
    const copyLines = COPY.reduce((sum, text) => sum
      + wrappedLines(text, copyWidth, value => copyMeasure(value, copySize)), 0);
    descriptionHeight = copyLines * copySize * subtitleTypeScale.lineHeight;
    const titleAbove = mode === 'horizontal' ? Math.max(startHeight, endHeight) / 2 : haloAt(heroHeight) + titleGap + startHeight;
    const titleBelow = mode === 'horizontal' ? Math.max(startHeight, endHeight) / 2 : haloAt(heroHeight) + titleGap + endHeight;
    heroHeight = Math.max(heroHeight,
      (top + Math.max(logoWidth / logoAspect, contactHeight) + 16 + titleAbove) / .49,
      (bottom + descriptionHeight + (mode === 'vertical' ? 32 : 16) + titleBelow) / .51);
    if (mode === 'horizontal' && (width / heroHeight < 4 / 3 || horizontalClearance < haloAt(heroHeight) + 24)) mode = 'vertical';
  }
  heroHeight = Math.ceil(heroHeight);
  const shorter = Math.min(width, heroHeight), scale = shorter * .5, coreRadius = Math.max(12, scale * .12);
  const titleStartTop = heroHeight * .49 - coreRadius * 1.08 - titleGap - startHeight;
  const titleEndTop = heroHeight * .49 + coreRadius * 1.08 + titleGap;
  const descriptionTop = mode === 'vertical'
    ? (titleEndTop + endHeight + heroHeight - bottom - descriptionHeight) / 2
    : heroHeight - bottom - descriptionHeight;
  return {
    mode, width, height: heroHeight, viewportHeight: height, short, padding, left, right, top, bottom,
    gutter, column, titleSize, copySize, logoWidth, startHeight, endHeight, descriptionHeight, titleGap, descriptionTop,
    descriptionWidth: copyWidth,
    centerX: width * .5, centerY: heroHeight * .49, scale, coreRadius,
    // Blend away from the desktop 16:9 footprint as the viewport becomes
    // portrait. One uniform extent preserves the original dome curves.
    referenceExtent: Math.min(heroHeight, width * 9 / 16)
      * (mode === 'vertical' ? 1 + .5 * clamp(0, (4 / 3 - width / heroHeight) * 3, 1) : 1),
    outerRadius: Math.hypot(width / shorter, heroHeight / shorter) * 2.12,
    titleStartTop, titleEndTop,
  };
}

// Keep UI geometry in the dynamic viewport, but paint the same scene into
// the larger viewport and safe-area regions that Safari can reveal.
export function drawingBounds(layout, largeViewportHeight = layout.height, safe = {}) {
  const extension = Math.max(0, largeViewportHeight - layout.height)
    + (safe.top || 0) + (safe.bottom || 0);
  return {
    renderHeight: layout.height + extension,
    drawingBleedTop: extension * .49,
    drawingBleedBottom: extension * .51,
  };
}

let current;
const subscribers = new Set();
let started = false;
export function observeLayout(listener) {
  subscribers.add(listener);
  startLayout();
  if (current) listener(current);
  return () => subscribers.delete(listener);
}

function startLayout() {
  if (started || typeof document === 'undefined') return;
  started = true;
  const artwork = document.querySelector('.artwork'), logo = document.querySelector('.banner-logo');
  const contact = document.querySelector('.banner-contact');
  if (!artwork) return;
  const paint = document.createElement('canvas').getContext('2d');
  const probe = document.createElement('span');
  probe.className = 'layout-rem-probe'; probe.setAttribute('aria-hidden', 'true'); artwork.append(probe);
  const viewportProbe = document.createElement('span');
  viewportProbe.className = 'layout-viewport-probe'; viewportProbe.setAttribute('aria-hidden', 'true'); artwork.append(viewportProbe);
  let scheduled = 0;
  const documentChromeTest = document.documentElement.dataset.chromeTest === 'document';
  const textWidth = (text, size, family, tracking = 0) => {
    if (!paint) return text.length * size * .5;
    paint.font = `400 ${size}px "${family}", sans-serif`;
    return paint.measureText(text).width + Math.max(0, text.length - 1) * tracking * size;
  };
  function measure() {
    scheduled = 0;
    const bounds = artwork.getBoundingClientRect(), styles = getComputedStyle(artwork);
    const safe = {};
    for (const side of ['left', 'right', 'top', 'bottom']) safe[side] = parseFloat(styles.getPropertyValue(`--safe-${side}`)) || 0;
    if (documentChromeTest) safe.bottom = Math.max(safe.bottom, 72);
    const rootSize = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const typeRatio = (name, fallback) => {
      const token = styles.getPropertyValue(name).trim(), value = parseFloat(token);
      if (!Number.isFinite(value) || value <= 0) return fallback;
      return token.endsWith('rem') ? value : token.endsWith('px') ? value / rootSize : fallback;
    };
    const titleFluidToken = styles.getPropertyValue('--type-headline-portrait-fluid').trim();
    const titleFluidValue = parseFloat(titleFluidToken);
    const titleTypeScale = {
      portraitMin: typeRatio('--type-headline-portrait-min', TITLE_TYPE_SCALE.portraitMin),
      portraitBase: typeRatio('--type-headline-portrait-base', TITLE_TYPE_SCALE.portraitBase),
      portraitFluid: titleFluidToken.endsWith('cqw') && Number.isFinite(titleFluidValue) && titleFluidValue > 0
        ? titleFluidValue / 100 : TITLE_TYPE_SCALE.portraitFluid,
      portraitMax: typeRatio('--type-headline-portrait-max', TITLE_TYPE_SCALE.portraitMax),
    };
    const subtitleTypeScale = {
      mobileMin: typeRatio('--type-subtitle-mobile', SUBTITLE_TYPE_SCALE.mobileMin),
      portraitMax: typeRatio('--type-subtitle-portrait-max', SUBTITLE_TYPE_SCALE.portraitMax),
      desktopMin: typeRatio('--type-subtitle-desktop-min', SUBTITLE_TYPE_SCALE.desktopMin),
      desktopMax: typeRatio('--type-subtitle-desktop-max', SUBTITLE_TYPE_SCALE.desktopMax),
      lineHeight: parseFloat(styles.getPropertyValue('--type-subtitle-line-height')) || SUBTITLE_TYPE_SCALE.lineHeight,
    };
    const layout = resolveLayout({ width: bounds.width, height: documentChromeTest
      ? usableViewportHeight(window.innerHeight, window.visualViewport) : window.innerHeight,
      rootSize, safe, titleTypeScale, subtitleTypeScale,
      logoAspect: logo.naturalWidth && logo.naturalHeight ? logo.naturalWidth / logo.naturalHeight : 2.519,
      contactHeight: contact?.getBoundingClientRect().height || 0,
      measureTitle: (text, size) => textWidth(text, size, 'PP Fragment Sans', -.03),
      measureCopy: (text, size) => textWidth(text, size, 'Neue Montreal'),
    });
    Object.assign(layout, drawingBounds(layout, viewportProbe.getBoundingClientRect().height, safe));
    const values = { 'drawing-bleed-top': layout.drawingBleedTop, 'drawing-bleed-bottom': layout.drawingBleedBottom, 'hero-min-height': layout.height, 'guide-left': layout.left, 'guide-right': layout.right,
      'guide-top': layout.top, 'guide-bottom': layout.bottom, 'grid-gutter': layout.gutter,
      'headline-size': layout.titleSize, 'copy-size': layout.copySize, 'logo-width': layout.logoWidth,
      'copy-width': layout.descriptionWidth, 'title-start-top': layout.titleStartTop,
      'title-end-top': layout.titleEndTop, 'copy-midpoint': layout.descriptionTop + layout.descriptionHeight / 2, 'reference-extent': layout.referenceExtent };
    for (const [key, value] of Object.entries(values)) artwork.style.setProperty(`--${key}`, `${value}px`);
    // Paint the underlying page, including overscroll and Safari's sampled
    // chrome, without reading back the animated canvas on every frame.
    const edge = y => {
      const sampled = restingFieldColor(layout.centerX, y, layout.width, layout.height, 0, layout.referenceExtent);
      const floor = [18, 35, 78];
      return layout.mode === 'vertical' ? sampled.map((value, i) => Math.max(value, floor[i])) : [3, 5, 11];
    };
    const topEdge = edge(0), bottomEdge = edge(layout.height);
    document.documentElement.style.setProperty('--page-edge-top', `rgb(${topEdge.join(',')})`);
    document.documentElement.style.setProperty('--page-edge-bottom', `rgb(${bottomEdge.join(',')})`);
    const theme = document.querySelector('meta[name="theme-color"]');
    if (theme) theme.content = `#${topEdge.map(value => value.toString(16).padStart(2, '0')).join('')}`;
    artwork.dataset.layout = layout.mode;
    artwork.dataset.gridColumns = layout.mode === 'horizontal' ? '12' : '4';
    artwork.dataset.layoutSize = `${Math.round(layout.width)}x${layout.height}`;
    artwork.dataset.viewportHeight = String(layout.viewportHeight);
    artwork.dataset.viewportWidth = String(layout.width);
    const changed = !current || Object.keys(layout).some(key => current[key] !== layout[key]);
    current = layout;
    if (changed) for (const listener of subscribers) listener(layout);
  }
  const schedule = () => { if (!scheduled) scheduled = requestAnimationFrame(measure); };
  new ResizeObserver(schedule).observe(artwork);
  new ResizeObserver(schedule).observe(probe);
  new ResizeObserver(schedule).observe(viewportProbe);
  window.addEventListener('resize', schedule, { passive: true });
  window.visualViewport?.addEventListener('resize', schedule, { passive: true });
  document.fonts?.addEventListener('loadingdone', schedule);
  logo.addEventListener('load', schedule, { once: true });
  measure();
}
if (typeof document !== 'undefined') startLayout();
