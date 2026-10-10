import { MODEL } from './physics.js?revision=de2b55ccf165';
import { responseKernel, settleNode } from './inertia.js?revision=de2b55ccf165';
import { resolveSettings, reactionRate } from './settings.js?revision=de2b55ccf165';

// Keep the local well close to the pointer, then let the filaments carry a
// shorter stagger and their own damped velocity. These delays must not stack
// into a bend left behind the cursor. Strength and dwell stay independent.
export const CURSOR_RESPONSE = Object.freeze({
  follow: 24,
  build: 5.8,
  lightMin: 13,
  lightSpread: .5,
  delayMin: .01,
  delaySpread: .02,
  delayJitter: .006,
  movingFloor: .20,
});

// One moving well, with its own mass and momentum. The radial origin remains
// fixed. Delayed force samples drive existing light; they never draw copies.
export class GravityFocus {
  constructor(settings = {}) { this.configure(settings); this.reset(); }

  configure(settings) { this.settings = resolveSettings({ ...this.settings, ...settings }); }
  get reactionRate() { return reactionRate(this.settings); }

  reset() {
    this.x = this.y = this.targetX = this.targetY = 0;
    this.anchorX = this.anchorY = 0;
    this.position = new Float64Array(6);
    this.envelope = new Float64Array(6);
    this.active = false;
    this.dwell = this.charge = this.boost = this.hold = 0;
    this.releaseCharge = this.releaseBoost = 0;
    this.mu = MODEL.mu;
    this.clock = 0;
    this.sampleTime = null;
    this.sampleX = this.sampleY = 0;
    this.inputSpeed = this.pointerSpeed = this.movementAge = 0;
    this.paceGain = 1;
    this.history = [this.snapshot()];
  }

  point(x, y, sampleTime = this.clock) {
    if (!this.active || this.sampleTime === null) {
      // Entry is not a movement sample: crossing the artwork boundary must
      // not turn the previous off-canvas position into a false speed spike.
      this.inputSpeed = this.pointerSpeed = this.movementAge = 0;
      this.paceGain = 1;
    } else {
      const interval = sampleTime - this.sampleTime;
      if (interval > 0) {
        const distance = Math.hypot(x - this.sampleX, y - this.sampleY);
        this.inputSpeed = Math.min(20, distance / Math.max(interval, 1 / 1000));
        this.movementAge = 0;
      }
    }
    this.sampleTime = sampleTime;
    this.sampleX = x;
    this.sampleY = y;
    if (!this.active && this.influence < .003) {
      // Invisible entry may be placed directly. A still-visible well keeps
      // its momentum on re-entry instead of teleporting to the new pointer.
      this.x = this.position[2] = x;
      this.y = this.position[3] = y;
      this.position[4] = this.position[5] = 0;
    }
    if (!this.active || Math.hypot(x - this.anchorX, y - this.anchorY) > .085) {
      this.anchorX = x;
      this.anchorY = y;
      this.dwell = 0;
    }
    this.active = true;
    this.targetX = x;
    this.targetY = y;
  }

  leave() {
    if (!this.active) return;
    this.active = false;
    this.releaseCharge = this.charge;
    this.releaseBoost = this.boost;
    this.hold = .25 + 3.5 * this.charge;
  }

  get influence() { return Math.min(1, Math.max(0, this.boost * (.80 + .20 * this.charge))); }
  get radius() { return this.settings.reach * (1 + .18 * this.charge); }

  snapshot() {
    return { time: this.clock, x: this.x, y: this.y, influence: this.influence, radius: this.radius };
  }

  delayed(delay) {
    const time = this.clock - delay;
    const history = this.history;
    if (time <= history[0].time) return history[0];
    for (let i = history.length - 1; i > 0; i--) {
      const a = history[i - 1], b = history[i];
      if (time < a.time) continue;
      const mix = Math.min(1, (time - a.time) / Math.max(1e-8, b.time - a.time));
      return {
        x: a.x + (b.x - a.x) * mix,
        y: a.y + (b.y - a.y) * mix,
        influence: a.influence + (b.influence - a.influence) * mix,
        radius: a.radius + (b.radius - a.radius) * mix,
      };
    }
    return history.at(-1);
  }

  project(x, y, well = this, flow = 'converge') {
    const centerDistance = Math.hypot(x, y);
    if (centerDistance <= .16) return { x, y };
    const dx = x - well.x, dy = y - well.y;
    const radius = well.radius;
    const distance2 = dx * dx + dy * dy;
    if (well.influence < .003 || distance2 >= radius * radius) return { x, y };
    const falloff = (1 - distance2 / (radius * radius)) ** 2;
    // A broad attachment keeps the returning filaments smooth near the core.
    // A short anchor transition concentrated the departing force into a kink.
    const anchorBlend = Math.min(1, (centerDistance - .16) / .44);
    const anchorWeight = anchorBlend * anchorBlend * (3 - 2 * anchorBlend);
    // Polarity follows light travel, not pointer travel: approach gathers,
    // departure fans outward. Blend the two lobes smoothly across the cursor
    // plane so neighboring samples never switch direction discontinuously.
    const travelSign = flow === 'converge' ? -1 : 1;
    const downstream = travelSign * (dx * x + dy * y) / centerDistance;
    const across = Math.min(1, Math.max(0, .5 + downstream / (radius * .44)));
    const departure = across * across * (3 - 2 * across);
    const polarity = -1 + 1.65 * departure;
    const response = this.settings.pullStrength * well.influence * falloff * anchorWeight * polarity;
    return { x: x + dx * response, y: y + dy * response };
  }

  update(dt, enabled = true) {
    const rate = this.reactionRate;
    if (!enabled) {
      this.active = false;
      this.dwell = this.charge = this.hold = this.boost = 0;
      this.inputSpeed = this.pointerSpeed = this.movementAge = 0;
      this.sampleTime = null;
      this.paceGain = 1;
      this.envelope.fill(0);
      this.history.length = 0;
    } else if (this.active) {
      this.movementAge += dt;
      // World units are relative to artwork height, so the same gesture has
      // the same effect at different desktop preview sizes. If events stop,
      // speed decays rather than leaving a stale fast sample indefinitely.
      const speedTarget = this.inputSpeed * Math.exp(-Math.max(0, this.movementAge - .035) / (.10 / rate));
      this.pointerSpeed += (speedTarget - this.pointerSpeed) * (1 - Math.exp(-dt / (.065 / rate)));
      const speedFalloff = 1 / (1 + (this.pointerSpeed / .65) ** 4);
      // Movement keeps a small visible bend. Speed still reduces the pull,
      // and slowing or dwelling builds the much stronger stationary field.
      const movingGain = CURSOR_RESPONSE.movingFloor + (1 - CURSOR_RESPONSE.movingFloor) * speedFalloff;
      this.paceGain = 1 - this.settings.speedContrast * (1 - movingGain);
      this.dwell += dt;
      const targetCharge = (1 - Math.exp(-this.dwell / 2.3)) * this.paceGain;
      this.charge += (targetCharge - this.charge) * (1 - Math.exp(-dt / .85));
      // Fast travel sheds attraction sooner; stopping still rebuilds it
      // gradually. Geometry retains its own momentum through either change.
      const omega = (this.paceGain < this.boost ? 8 : CURSOR_RESPONSE.build) * rate;
      settleNode(this.envelope, 0, this.paceGain, 0, dt, omega, responseKernel(dt, omega, 1));
      this.boost = Math.min(1, Math.max(0, this.envelope[2]));
    } else {
      this.hold = Math.max(0, this.hold - dt);
      if (this.hold > 0) {
        const omega = 4.6 * rate;
        settleNode(this.envelope, 0, this.releaseBoost, 0, dt, omega, responseKernel(dt, omega, 1));
      } else {
        const recovery = .85 + 2.4 * this.releaseCharge;
        const omega = 3 * rate / recovery;
        settleNode(this.envelope, 0, 0, 0, dt, omega, responseKernel(dt, omega, 1));
        this.charge *= Math.exp(-dt / (.65 + 3.2 * this.releaseCharge));
      }
      this.boost = Math.max(0, this.envelope[2]);
    }
    // Critically damped position preserves speed through a reversal without
    // a bounce. Strength has a separate slower buildup, not an instant boost.
    const followOmega = CURSOR_RESPONSE.follow * rate;
    settleNode(this.position, 0, this.targetX, this.targetY, dt, followOmega, responseKernel(dt, followOmega, 1));
    this.x = this.position[2];
    this.y = this.position[3];
    this.mu = MODEL.mu + (.025 + .055 * this.charge) * this.boost;
    this.clock += dt;
    this.history.push(this.snapshot());
    while (this.history.length > 2 && this.history[1].time < this.clock - .35) this.history.shift();
    return this;
  }
}
