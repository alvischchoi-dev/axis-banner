export const SETTINGS_KEY = 'axis-magnetic-tuning-v1';
export const MAX_RAYS = 4000;
export const DEFAULT_TEMPO = 3;
export const DEFAULT_SETTINGS = Object.freeze({
  density: 1200,
  rayLength: 1,
  pullStrength: .48,
  reach: .83,
  reaction: .65,
  speedContrast: .98,
});

const limits = {
  density: [400, MAX_RAYS, 50],
  rayLength: [.5, 1.8, .05],
  pullStrength: [.15, .85, .01],
  reach: [.35, 1.25, .01],
  reaction: [.1, 1, .05],
  speedContrast: [0, 1, .01],
};

export function resolveSettings(values = {}) {
  const resolved = { ...DEFAULT_SETTINGS };
  if (!values || typeof values !== 'object' || Array.isArray(values)) return resolved;
  for (const key of Object.keys(resolved)) {
    if (typeof values[key] !== 'number' || !Number.isFinite(values[key])) continue;
    const [min, max, step] = limits[key];
    const clamped = Math.min(max, Math.max(min, values[key]));
    resolved[key] = Number((min + Math.round((clamped - min) / step) * step).toFixed(3));
  }
  return resolved;
}

export function reactionRate(settings) { return .7 + settings.reaction * 1.5; }
