// AXIS, Gradient system slide 2:246 and Energy Field slide 2:214.
// Keep the editable brand colors intact; exposure controls their dark use.
export const AXIS_PALETTE = Object.freeze({
  indigo: '#1C367C',
  blue: '#7490D6',
  aqua: '#6CE6F8',
  mint: '#82F4D6',
  green: '#B8ECB3',
  rose: '#FF938E',
});

function rgb(hex) { return [1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16)); }
function mix(a, b, amount) { return a.map((value, i) => Math.round(value + (b[i] - value) * amount)); }
function ink(values, alpha = 1) { return `rgba(${values.join(',')},${alpha})`; }
const indigo = rgb(AXIS_PALETTE.indigo), blue = rgb(AXIS_PALETTE.blue);
const aqua = rgb(AXIS_PALETTE.aqua), mint = rgb(AXIS_PALETTE.mint), green = rgb(AXIS_PALETTE.green);
const rose = rgb(AXIS_PALETTE.rose);
const coreStops = [indigo, blue, aqua, mint, green];

const smooth = value => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
};

export function cursorSizeForSpeed(speed) {
  const pace = Math.max(0, speed);
  const movingSize = .48 + .52 / (1 + (pace / .65) ** 1.6);
  // Expand only as the pointer settles. The narrow extra response keeps
  // the established fast-moving footprint while adding 40% at rest.
  return movingSize + .40 / (1 + (pace / .25) ** 4);
}

export function cursorExposureForSpeed(speed) {
  return .16 + .74 / (1 + (Math.max(0, speed) / .65) ** 1.6);
}

export function cursorColorRadius(radius, size = 1) { return radius * .34 * size; }

// Exact background recipe read from AXIS_Brand-Elements frame 49:100.
// The source is vertical; this trial maps its colors onto the fixed sunrise
// arc. Its final 4.8% warm-yellow finish remains a tiny inner accent.
export const BACKGROUND_REFERENCE = Object.freeze({
  fileKey: 'QXwtefawy7aynlaWCivMhL', nodeId: '49:100',
  positions: [0, .2307692319, .4615384638, .7788461447, .9519230723, 1],
  colors: ['#000000', '#4863A9', '#7490D6', '#6CE6F8', '#B8ECB3', '#FFED7E'],
});
// Fine graphic grain informed by the Figma reference. Keep texture and
// exposure separate: neutral soft-light detail must not lift navy to gray.
export const BACKGROUND_GRAIN = Object.freeze({
  nodeId: '49:100', type: 'TONAL_MONOCHROME', size: 1,
  color: [127.5, 127.5, 127.5], opacity: .38, density: 1,
  deviation: 26, softness: .26, baseExposure: .96,
  loopSeconds: 8, frames: 16, blend: 'soft-light',
  driftSeconds: 16, contraction: .018,
});

export function grainMotionLayers(seconds, flow = 'converge') {
  const phase = ((seconds / BACKGROUND_GRAIN.driftSeconds) % 1 + 1) % 1;
  const direction = flow === 'radiate' ? -1 : 1;
  return [0, .5].map((offset, carrier) => {
    const progress = (phase + offset) % 1;
    return {
      carrier, progress,
      weight: Math.sin(Math.PI * progress) ** 2,
      scale: Math.exp((.5 - progress) * BACKGROUND_GRAIN.contraction * direction),
    };
  });
}
const referenceColors = BACKGROUND_REFERENCE.colors.map(rgb);
const referencePositions = BACKGROUND_REFERENCE.positions;
// A monotone cubic ramp keeps the exact source stops and positions while
// making their joins continuous. It avoids flat per-stop smoothstep rings.
const referenceTangents = [0, 1, 2].map(channel => {
  const widths = referencePositions.slice(1).map((position, i) => position - referencePositions[i]);
  const slopes = widths.map((width, i) => (referenceColors[i + 1][channel] - referenceColors[i][channel]) / width);
  return referenceColors.map((_, i) => {
    if (!i) return slopes[0];
    if (i === referenceColors.length - 1) return slopes.at(-1);
    if (slopes[i - 1] * slopes[i] <= 0) return 0;
    const first = 2 * widths[i] + widths[i - 1], second = widths[i] + 2 * widths[i - 1];
    return (first + second) / (first / slopes[i - 1] + second / slopes[i]);
  });
});
const fieldRampSize = 2048;
const fieldRamp = new Float32Array(fieldRampSize * 3);
for (let sample = 0; sample < fieldRampSize; sample++) {
  const position = sample / (fieldRampSize - 1);
  let low = 0;
  while (low < referencePositions.length - 2 && position > referencePositions[low + 1]) low++;
  const width = referencePositions[low + 1] - referencePositions[low];
  const t = (position - referencePositions[low]) / width;
  const h00 = 2 * t ** 3 - 3 * t ** 2 + 1, h10 = t ** 3 - 2 * t ** 2 + t;
  const h01 = -2 * t ** 3 + 3 * t ** 2, h11 = t ** 3 - t ** 2;
  for (let channel = 0; channel < 3; channel++) {
    fieldRamp[sample * 3 + channel] = h00 * referenceColors[low][channel] + h10 * width * referenceTangents[channel][low]
      + h01 * referenceColors[low + 1][channel] + h11 * width * referenceTangents[channel][low + 1];
  }
}

// Light occupies a compact middle; most of the frame remains deep blue.
// Scale both coordinates continuously instead of adding a vignette boundary.
const INNER_LIGHT_REACH = .82;

function fieldDistance(x, y, width, height, extent = height) {
  const dy = (y - height * .49) / extent;
  // The asymmetric dome varies continuously through its equator as well.
  // A broad tanh avoids the former squeezed band just below the star.
  const verticalReach = .64 - .24 * Math.tanh(dy / .18);
  return Math.hypot((x - width * .5) / (extent * .76), dy / verticalReach) / INNER_LIGHT_REACH;
}

function fieldColor(distance) {
  const position = .985 * Math.exp(-Math.max(0, distance) * 1.85) * (fieldRampSize - 1);
  const low = Math.floor(position), high = Math.min(fieldRampSize - 1, low + 1), blend = position - low;
  return [0, 1, 2].map(channel => fieldRamp[low * 3 + channel] * (1 - blend) + fieldRamp[high * 3 + channel] * blend);
}

export const BACKGROUND_LOOP_SECONDS = 14;
const mintTint = mint.map(value => value * .89);
const aquaTint = aqua.map(value => value * .89);
const blueTint = blue.map(value => value * .85);

export function backgroundLayerWeights(x, y, width, height, extent = height) {
  const nx = (x - width * .5) / extent / INNER_LIGHT_REACH, ny = (y - height * .49) / extent / INNER_LIGHT_REACH;
  const distance = fieldDistance(x, y, width, height, extent);
  const gaussian = (cx, cy, rx, ry) => Math.exp(-(((nx - cx) / rx) ** 2 + ((ny - cy) / ry) ** 2));
  return {
    distance,
    mint: .12 * gaussian(-.15, -.27, .45, .43),
    aqua: .18 * gaussian(.20, -.03, .52, .46),
    blue: .14 * gaussian(-.25, .24, .54, .45),
    // Rose is absent from this newly selected source frame.
    rose: 0,
    motion: .055 * Math.exp(-((distance / .95) ** 2)) * (1 - Math.exp(-distance * 5)),
  };
}

function anchoredFieldColor(weights) {
  const color = fieldColor(weights.distance);
  for (let channel = 0; channel < 3; channel++) {
    color[channel] += (mintTint[channel] - color[channel]) * weights.mint;
    color[channel] += (aquaTint[channel] - color[channel]) * weights.aqua;
    color[channel] += (blueTint[channel] - color[channel]) * weights.blue;
    color[channel] += (rose[channel] - color[channel]) * weights.rose;
  }
  return color;
}

function inwardExposure(weights, seconds) {
  // Positive phase makes the light envelope travel inward. Its very broad
  // wavelength and small amplitude avoid a travelling ring. Only exposure
  // changes: all palette and rose weights remain fixed in scene coordinates.
  return 1 + weights.motion * Math.sin(weights.distance * 4.3 + seconds * Math.PI * 2 / BACKGROUND_LOOP_SECONDS);
}

export function restingFieldColor(x, y, width, height, seconds = 0, extent = height) {
  const weights = backgroundLayerWeights(x, y, width, height, extent);
  const exposure = inwardExposure(weights, seconds);
  return anchoredFieldColor(weights).map(value => Math.round(value * exposure));
}

// An open incoming shoulder, applied only to existing filament pixels. It
// is not a bright disk or ring painted over the space between the rays.
export function incomingLightWeight(x, y) {
  const distance = Math.hypot(x, y);
  const shoulder = Math.exp(-.5 * ((distance - .67) / .19) ** 2);
  const incoming = smooth((x + .28) / .68);
  return shoulder * incoming * (1 - smooth((distance - .98) / .12));
}

export class ColorExposure {
  reset() {
    this.value = 0;
    this.size = 1;
    this.wasActive = false;
    this.lastInfluence = this.releaseInfluence = 1;
    this.releaseExposure = 0;
  }
  constructor() { this.reset(); }
  update(dt, focus, enabled = true) {
    const active = enabled && focus.active;
    if (this.wasActive && !active) {
      this.releaseInfluence = Math.max(.003, this.lastInfluence);
      this.releaseExposure = this.value;
    }
    // Pace reduces both area and luminance. Release starts from the current
    // exposure so a fast exit cannot bloom into a bright stationary spot.
    const target = !enabled ? 0 : active ? cursorExposureForSpeed(focus.pointerSpeed)
      : this.releaseExposure * Math.min(1, focus.influence / this.releaseInfluence);
    const time = active ? (target < this.value ? .10 : .28) : .75;
    this.value += (target - this.value) * (1 - Math.exp(-dt / time));
    if (active) {
      const targetSize = cursorSizeForSpeed(focus.pointerSpeed);
      const sizeTime = targetSize < this.size ? .08 : .20;
      this.size += (targetSize - this.size) * (1 - Math.exp(-dt / sizeTime));
      this.lastInfluence = focus.influence;
    }
    this.wasActive = active;
    if (this.value < .0001 && target < .0001) this.value = 0;
    return this.value;
  }
}

function texture(rayInk = false) {
  const surface = document.createElement('canvas');
  surface.width = surface.height = 384;
  const paint = surface.getContext('2d');
  // Reverse the Figma Core field progression around a bright midpoint:
  // green / mint -> aqua -> blue -> indigo. Keep the blue transition visible
  // before feathering the outer indigo into the resting field.
  const gradient = paint.createRadialGradient(192, 192, 0, 192, 192, 191);
  const colors = rayInk
    ? [mix(mint, [255, 255, 255], .96), mix(green, [255, 255, 255], .88), mix(mint, [255, 255, 255], .84), mix(aqua, [255, 255, 255], .80), mix(blue, [255, 255, 255], .65), mix(indigo, [255, 255, 255], .60)]
    : [mix(green, [255, 255, 255], .98), mix(green, [255, 255, 255], .60), mix(mint, [255, 255, 255], .05), aqua, blue, indigo];
  const positions = [0, .08, .25, .48, .76, 1];
  positions.forEach((position, i) => gradient.addColorStop(position, ink(colors[i])));
  paint.fillStyle = gradient;
  paint.fillRect(0, 0, 384, 384);
  paint.globalCompositeOperation = 'destination-in';
  const mask = paint.createRadialGradient(192, 192, 0, 192, 192, 191);
  // Most of the palette remains opaque in the texture. Fade only its outer
  // portion; multiplying the whole gradient by a dome erased the hue range.
  for (let i = 0; i <= 32; i++) {
    const distance = i / 32;
    const edge = Math.min(1, Math.max(0, (distance - .34) / .66));
    const alpha = 1 - edge * edge * (3 - 2 * edge);
    mask.addColorStop(distance, `rgba(255,255,255,${alpha})`);
  }
  paint.fillStyle = mask;
  paint.fillRect(0, 0, 384, 384);
  return surface;
}

function incomingTexture() {
  const surface = document.createElement('canvas');
  surface.width = surface.height = 384;
  const paint = surface.getContext('2d');
  const pixels = paint.createImageData(384, 384);
  for (let y = 0; y < 384; y++) for (let x = 0; x < 384; x++) {
    const i = (y * 384 + x) * 4;
    pixels.data[i] = 244;
    pixels.data[i + 1] = 255;
    pixels.data[i + 2] = 248;
    pixels.data[i + 3] = Math.round(255 * incomingLightWeight((x - 192) / 174, (y - 192) / 174));
  }
  paint.putImageData(pixels, 0, 0);
  return surface;
}

// PCG RXS-M-XS hash; Jarzynski / Olano, Hash Functions for GPU Rendering:
// https://jcgt.org/published/0009/03/02/
function grainRandom(value) {
  const state = (Math.imul(value, 747796405) + 2891336453) >>> 0;
  const word = Math.imul((state >>> ((state >>> 28) + 4)) ^ state, 277803737) >>> 0;
  return (((word >>> 22) ^ word) >>> 0) / 4294967296;
}

function grainBasis(size, seed) {
  const count = size * size, fine = new Float32Array(count), rounded = new Float32Array(count);
  for (let pixel = 0; pixel < count; pixel += 2) {
    const radius = Math.sqrt(-2 * Math.log(Math.max(1e-9, grainRandom(seed + pixel))));
    const angle = grainRandom(seed + pixel + 1) * Math.PI * 2;
    fine[pixel] = radius * Math.cos(angle);
    fine[pixel + 1] = radius * Math.sin(angle);
  }
  let sum = 0, squared = 0;
  const kernel = [1, 2, 1], soft = BACKGROUND_GRAIN.softness;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let neighborhood = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      neighborhood += fine[((y + dy + size) % size) * size + (x + dx + size) % size] * kernel[dx + 1] * kernel[dy + 1] / 16;
    }
    const pixel = y * size + x, value = (1 - soft) * fine[pixel] + soft * neighborhood;
    rounded[pixel] = value; sum += value; squared += value * value;
  }
  const mean = sum / count, deviation = Math.sqrt(squared / count - mean * mean);
  for (let pixel = 0; pixel < count; pixel++) rounded[pixel] = (rounded[pixel] - mean) / deviation;
  return rounded;
}

function grainTextures() {
  const size = 512, first = grainBasis(size, 1013904223), second = grainBasis(size, 2246822519);
  // Closely spaced projections of two Gaussian fields evolve smoothly.
  // Their correlation keeps crossfade contrast nearly constant, unlike
  // fading between unrelated white-noise tiles.
  return Array.from({ length: BACKGROUND_GRAIN.frames }, (_, frame) => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
    const paint = canvas.getContext('2d'), pixels = paint.createImageData(size, size);
    const angle = frame * Math.PI * 2 / BACKGROUND_GRAIN.frames, a = Math.cos(angle), b = Math.sin(angle);
    for (let pixel = 0; pixel < size * size; pixel++) {
      const index = pixel * 4, value = 127.5 + BACKGROUND_GRAIN.deviation * (first[pixel] * a + second[pixel] * b);
      pixels.data[index] = pixels.data[index + 1] = pixels.data[index + 2] = value;
      pixels.data[index + 3] = 255;
    }
    paint.putImageData(pixels, 0, 0);
    return canvas;
  });
}

export function createColorField() {
  const rayInk = texture(true), incoming = incomingTexture(), grain = grainTextures();
  const resting = document.createElement('canvas');
  const sky = resting.getContext('2d');
  const localField = document.createElement('canvas');
  const localSize = 64, halfLocal = localSize / 2;
  localField.width = localField.height = localSize;
  const localPaint = localField.getContext('2d');
  const localPixels = localPaint.createImageData(localSize, localSize);
  const localShape = new Float32Array(localSize * localSize * 6);
  const localBasis = new Float32Array(localSize * localSize * 3);
  const localPhase = new Float32Array(localSize * localSize * 2);
  let localKey;
  for (let py = 0; py < localSize; py++) for (let px = 0; px < localSize; px++) {
    const nx = (px + .5 - halfLocal) / halfLocal, ny = (py + .5 - halfLocal) / halfLocal;
    const distance = Math.hypot(nx, ny), index = (py * localSize + px) * 6;
    localShape.set([nx, ny, 1 - smooth(distance), Math.exp(-distance * distance / (.15 * .15)), distance < 1 ? 1 : 0, Math.exp(-distance * distance / (.62 * .62))], index);
  }
  const lightLayer = document.createElement('canvas');
  const light = lightLayer.getContext('2d');
  const grainLayer = document.createElement('canvas');
  const grainCompose = grainLayer.getContext('2d');
  let restingRay, sceneWidth, sceneHeight, referenceExtent, grainPatterns, grainPixelRatio, restingPixels, backgroundBasis, backgroundPhase, lastBackgroundSeconds;
  function paintGrain(ctx, width, height, seconds, flow) {
    // Two fine textures drift toward the fixed star. The tiny contraction
    // keeps grains within 1% of a device pixel, rather than stretching
    // visible flecks. Each carrier resets only at zero weight and slope.
    const carriers = grainMotionLayers(seconds, flow);
    grainCompose.globalCompositeOperation = 'source-over';
    grainCompose.clearRect(0, 0, width, height);
    grainCompose.globalCompositeOperation = 'lighter';
    for (const carrier of carriers) {
      // Quarter-turn projections of Gaussian bases are independent. A
      // half-turn would invert the same noise and cancel at the center.
      const frame = seconds / BACKGROUND_GRAIN.loopSeconds * grainPatterns.length
        + carrier.carrier * grainPatterns.length / 4;
      const first = Math.floor(frame) % grainPatterns.length, next = (first + 1) % grainPatterns.length;
      const t = frame - Math.floor(frame), blend = .5 - .5 * Math.cos(Math.PI * t);
      const size = BACKGROUND_GRAIN.size / grainPixelRatio * carrier.scale;
      const mapping = new DOMMatrix([size, 0, 0, size, width * .5 * (1 - carrier.scale), height * .49 * (1 - carrier.scale)]);
      for (const [index, weight] of [[first, 1 - blend], [next, blend]]) {
        grainPatterns[index].setTransform(mapping);
        grainCompose.globalAlpha = carrier.weight * weight;
        grainCompose.fillStyle = grainPatterns[index];
        grainCompose.fillRect(0, 0, width, height);
      }
    }
    grainCompose.globalAlpha = 1;
    ctx.save();
    ctx.globalCompositeOperation = BACKGROUND_GRAIN.blend;
    // Convex blending retains neutral gray. Compensate its Gaussian
    // contrast at the final soft-light stage, without adding a gray veil.
    const contrast = 1 / Math.sqrt(carriers.reduce((sum, carrier) => sum + carrier.weight ** 2, 0));
    ctx.globalAlpha = BACKGROUND_GRAIN.opacity * contrast;
    ctx.drawImage(grainLayer, 0, 0, width, height);
    ctx.restore();
  }
  return {
    resize(ctx, width, height, layout = {}) {
      sceneWidth = width; sceneHeight = height; referenceExtent = layout.referenceExtent || height;
      // Broad gradients need little spatial detail. Cache their color and
      // loop coefficients once, then update only a scalar exposure per pixel.
      // Fine grain uses a separate native-resolution texture below.
      // Bound the cache on tall windows too; colors remain circular in scene space.
      resting.width = Math.max(1, Math.round(384 * width / Math.max(width, height)));
      resting.height = Math.max(1, Math.round(384 * height / Math.max(width, height)));
      restingPixels = sky.createImageData(resting.width, resting.height);
      backgroundBasis = new Float32Array(resting.width * resting.height * 3);
      backgroundPhase = new Float32Array(resting.width * resting.height * 2);
      for (let py = 0; py < resting.height; py++) for (let px = 0; px < resting.width; px++) {
        const weights = backgroundLayerWeights((px + .5) * width / resting.width, (py + .5) * height / resting.height, width, height, referenceExtent);
        const pixel = py * resting.width + px, phase = weights.distance * 4.3;
        backgroundBasis.set(anchoredFieldColor(weights), pixel * 3);
        backgroundPhase[pixel * 2] = weights.motion * Math.sin(phase);
        backgroundPhase[pixel * 2 + 1] = weights.motion * Math.cos(phase);
      }
      lastBackgroundSeconds = undefined;
      localKey = undefined;
      grainLayer.width = ctx.canvas.width;
      grainLayer.height = ctx.canvas.height;
      grainCompose.setTransform(ctx.getTransform());
      grainPixelRatio = Math.abs(ctx.getTransform().a);
      grainPatterns = grain.map(surface => grainCompose.createPattern(surface, 'repeat'));
      const x = width * .5, y = height * .49;
      const radius = Math.hypot(width * .5, height * .51) * 1.18;
      restingRay = ctx.createRadialGradient(x, y, 0, x, y, radius);
      [...coreStops].reverse().forEach((color, i) => {
        restingRay.addColorStop(i / 4, ink(mix(color, [255, 255, 255], .78)));
      });
      lightLayer.width = ctx.canvas.width;
      lightLayer.height = ctx.canvas.height;
      light.setTransform(ctx.getTransform());
    },
    background(ctx, width, height, spot) {
      const seconds = Number.isFinite(spot.seconds) ? spot.seconds : 0;
      if (seconds !== lastBackgroundSeconds) {
        const phase = seconds * Math.PI * 2 / BACKGROUND_LOOP_SECONDS, sin = Math.sin(phase), cos = Math.cos(phase);
        for (let pixel = 0; pixel < resting.width * resting.height; pixel++) {
          const exposure = BACKGROUND_GRAIN.baseExposure * (1 + backgroundPhase[pixel * 2] * cos + backgroundPhase[pixel * 2 + 1] * sin);
          const index = pixel * 4, basis = pixel * 3;
          restingPixels.data[index] = backgroundBasis[basis] * exposure;
          restingPixels.data[index + 1] = backgroundBasis[basis + 1] * exposure;
          restingPixels.data[index + 2] = backgroundBasis[basis + 2] * exposure;
          restingPixels.data[index + 3] = 255;
        }
        sky.putImageData(restingPixels, 0, 0);
        lastBackgroundSeconds = seconds;
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(resting, 0, 0, width, height);
      if (spot.exposure <= .0001) { paintGrain(ctx, width, height, seconds, spot.flow); return; }
      const radius = cursorColorRadius(spot.radius, spot.size);
      const angle = Math.atan2(spot.y - spot.originY, spot.x - spot.originX);
      const cos = Math.cos(angle), sin = Math.sin(angle);
      // Rounded colors are broad. Reuse their spatial recipe while the
      // pointer rests; only the smooth exposure clock changes each frame.
      const key = `${Math.round(spot.x * 2)},${Math.round(spot.y * 2)},${Math.round(radius * 2)},${spot.flow}`;
      if (localKey !== key) {
      for (let pixel = 0; pixel < localSize * localSize; pixel++) {
        const shape = pixel * 6, index = pixel * 4;
        if (!localShape[shape + 4]) { localPixels.data[index + 3] = 0; continue; }
        const nx = localShape[shape], ny = localShape[shape + 1];
        const radial = (nx * cos + ny * sin) * (spot.flow === 'radiate' ? -1 : 1);
        const shoulder = smooth(.5 + radial * .7);
        const peak = localShape[shape + 3];
        const weight = Math.min(1, localShape[shape + 2] * (.70 + .30 * shoulder) + .18 * peak);
        const x = spot.x + nx * radius, y = spot.y + ny * radius;
        // Lift the same background progression at this scene coordinate.
        // There is no independent blue-to-white disk or additive wash.
        const weights = backgroundLayerWeights(x, y, sceneWidth, sceneHeight, referenceExtent);
        // Gather more of the scene's mint and aqua near the cursor, then
        // ease continuously into the unchanged surrounding color field.
        weights.distance /= 1 + 1.8 * localShape[shape + 5];
        localBasis.set(anchoredFieldColor(weights), pixel * 3);
        localPhase[pixel * 2] = weights.motion * Math.sin(weights.distance * 4.3);
        localPhase[pixel * 2 + 1] = weights.motion * Math.cos(weights.distance * 4.3);
        localPixels.data[index + 3] = Math.round(255 * weight);
      }
        localKey = key;
      }
      const phase = seconds * Math.PI * 2 / BACKGROUND_LOOP_SECONDS, pulseSin = Math.sin(phase), pulseCos = Math.cos(phase);
      for (let pixel = 0; pixel < localSize * localSize; pixel++) {
        const exposure = 1 + localPhase[pixel * 2] * pulseCos + localPhase[pixel * 2 + 1] * pulseSin;
        const white = localShape[pixel * 6 + 3] * .99, index = pixel * 4;
        for (let channel = 0; channel < 3; channel++) localPixels.data[index + channel] = Math.round(localBasis[pixel * 3 + channel] * exposure * (1 - white) + (channel === 1 ? 255 : 253) * white);
      }
      localPaint.putImageData(localPixels, 0, 0);
      ctx.save(); ctx.globalAlpha = spot.exposure;
      ctx.drawImage(localField, spot.x - radius, spot.y - radius, radius * 2, radius * 2);
      ctx.restore();
      paintGrain(ctx, width, height, seconds, spot.flow);
    },
    tintRays(ctx, width, height, spot, extraSpots = []) {
      // Color and brightening share the current, deformed ray silhouette.
      ctx.globalCompositeOperation = 'source-in';
      ctx.fillStyle = restingRay;
      ctx.fillRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'source-atop';
      this.local(ctx, rayInk, { ...spot, exposure: Math.min(1, spot.exposure * 1.3) });
      for (const placed of extraSpots) this.local(ctx, rayInk, placed);

      if (spot.exposure > 0) {
        light.globalCompositeOperation = 'source-over';
        light.clearRect(0, 0, width, height);
        light.drawImage(ctx.canvas, 0, 0, width, height);
        light.globalCompositeOperation = 'source-in';
        this.local(light, incoming, { ...spot, exposure: spot.exposure * 1.4 }, 1.65);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(lightLayer, 0, 0, width, height);
        ctx.globalAlpha = .85;
        ctx.drawImage(lightLayer, 0, 0, width, height);
        ctx.restore();
      }
      ctx.globalCompositeOperation = 'source-over';
    },
    local(ctx, surface, { x, y, radius, exposure, size = 1, originX, originY, flow }, reach = 1) {
      if (exposure <= 0) return;
      ctx.save();
      ctx.globalAlpha = Math.min(1, exposure);
      ctx.translate(x, y);
      ctx.rotate(Math.atan2(y - originY, x - originX) + (flow === 'radiate' ? Math.PI : 0));
      const colorRadius = cursorColorRadius(radius, size) * reach;
      const rx = colorRadius * 1.04, ry = colorRadius;
      ctx.drawImage(surface, -rx, -ry, rx * 2, ry * 2);
      ctx.restore();
    },
  };
}
