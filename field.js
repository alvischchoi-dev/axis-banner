import { MODEL, seededRandom } from './physics.js';
import { GravityFocus, CURSOR_RESPONSE } from './interaction.js?revision=gentler-moving-field';
import { buildTrajectory, pointAtTime } from './trajectories.js';
import { filamentResponse, settleFilamentNode } from './relaxation.js?revision=gentler-moving-field';
import { streakHead, streakPhase } from './streaks.js';
import { DEFAULT_SETTINGS, DEFAULT_TEMPO, SETTINGS_KEY, MAX_RAYS, resolveSettings } from './settings.js?revision=gentler-moving-field';
import { BACKGROUND_GRAIN, ColorExposure, createColorField, cursorColorRadius } from './color.js?revision=fine-inward-grain-2';
import { LightDrops, lightFieldsForRay, projectLightFields, dropAppearance, coreProximityScale } from './drops.js?revision=bright-inward-1';

import { resampleTrajectory, cubicSegments, cubicPoint, trimmedCubic, segmentAtTime } from './curves.js';
import { paintOrb, warmOrbTextures, breathingScale, resolveOrb, resolveOrbCycle, nextOrb, ORB_SETS, ORB_KEY, ORB_SELECTION_KEY, ORB_PERIOD, ORB_BREATH_PERIOD, ORB_BREATH_AMOUNT, ORB_GLOW_BREATH_AMOUNT, CORE_BREATH_AMOUNT, ORB_PROTOTYPE } from './orbs.js?revision=faster-breathing-4';
import { PlacementResponse } from './placement.js?revision=click-settle-1';

const canvas = document.querySelector('#field');
const ctx = canvas.getContext('2d', { alpha: false });
const artwork = document.querySelector('.artwork');
const pauseButton = document.querySelector('#pause');
const notes = document.querySelector('#notes');
const tuning = document.querySelector('#tuning');
const tuningStatus = document.querySelector('#tuning-status');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const layer = document.createElement('canvas');
const lines = layer.getContext('2d');
const rayEntrance = document.createElement('canvas');
const entrancePaint = rayEntrance.getContext('2d');
const EDGE_RAY_OPACITY = .82;
const colorField = createColorField();
const colorExposure = new ColorExposure();
const lightDrops = new LightDrops();
const placement = new PlacementResponse();
const coreLayer=document.createElement('canvas'),corePaint=coreLayer.getContext('2d');
let orbCycle=resolveOrbCycle(null),orbOption='01';
try{
  const query=new URLSearchParams(location.search),set=ORB_SETS.find(set=>set.id===query.get('set'));
  orbCycle=resolveOrbCycle(set?.ids||query.get('orbs')?.split(',')||localStorage.getItem(ORB_SELECTION_KEY));
  orbOption=resolveOrb(query.get('orb')||localStorage.getItem(ORB_KEY)).id;
  if(!orbCycle.includes(orbOption))orbOption=orbCycle[0];
}catch{}
if(ORB_PROTOTYPE)orbOption=ORB_PROTOTYPE;
let orbSeconds=0;
let depositedCursorPoint=null;
function chooseOrb(id){
  const next=ORB_PROTOTYPE||resolveOrb(id).id;if(next===orbOption)return;
  orbOption=next;
}
window.addEventListener('storage',event=>{
  if(event.key===ORB_KEY)chooseOrb(event.newValue);
  if(event.key===ORB_SELECTION_KEY){orbCycle=resolveOrbCycle(event.newValue);if(!orbCycle.includes(orbOption))chooseOrb(orbCycle[0]);}
});
let dropWells = [];
let storageAvailable = true;
let settings = loadSettings();
const focus = new GravityFocus(settings);
let rayPool = [];
let tuningOpen = false;
const alphas = [.32, .47, .66, .87];
const bins = alphas.map(() => []);
const profileCount = 12;
const profileCache = new Map();
let profiles = [];
let width = 1, height = 1, scale = 1, ratio = 1, outerRadius = 4;
let flow = 'converge', tempo = DEFAULT_TEMPO, paused = reducedMotion.matches;
let hoverEnabled = true;
let previousTime = 0, elapsed = 0;
let frameCount = 0, frameTotal = 0, lastReport = 0;
let maxDisplacement = 0, maxLightSpeed = 0;
let geometryActive = false;

function screenX(x) { return width * .5 + x * scale; }
function screenY(y) { return height * .49 + y * scale; }

function prepareProfiles() {
  // The main radial field never moves or changes mass on hover. The local
  // cursor influence is applied only inside a bounded neighborhood below.
  const key = 0;
  if (!profileCache.has(key)) {
    const mu = MODEL.mu + key * .002;
    profileCache.set(key, Array.from({ length: profileCount }, (_, i) => resampleTrajectory(buildTrajectory(mu, outerRadius, i / (profileCount - 1)))));
  }
  profiles = profileCache.get(key);
}

function reset({ preserveDrops = false } = {}) {
  focus.reset();
  colorExposure.reset();
  if (!preserveDrops) {
    lightDrops.reset();
    placement.reset();
    depositedCursorPoint=null;
  }
  elapsed = 0;
  previousTime = 0;
  frameCount = frameTotal = 0;
  maxDisplacement = maxLightSpeed = 0;
  geometryActive = false;
  profileCache.clear();
  const random = seededRandom();
  prepareProfiles();
  rayPool = [];
  for (const bin of bins) bin.length = 0;
  for (let i = 0; i < MAX_RAYS; i++) {
    // An evenly spreading sequence keeps every density setting balanced.
    // Existing rays retain their phase and geometry when density changes.
    const angle = i * Math.PI * (3 - Math.sqrt(5)) + random() * .006;
    const bin = Math.min(3, Math.floor(Math.pow(random(), 1.5) * 4));
    rayPool.push({
      id: i, bin, visible: false,
      cos: Math.cos(angle), sin: Math.sin(angle), profile: Math.floor(random() * profileCount), phase: random(),
      length: .70 + random() * 1.15, response: CURSOR_RESPONSE.lightMin + random() * CURSOR_RESPONSE.lightSpread,
      delay: CURSOR_RESPONSE.delayMin + (.5 + .5 * Math.sin(angle * 3)) * CURSOR_RESPONSE.delaySpread + random() * CURSOR_RESPONSE.delayJitter,
    });
  }
  for (const ray of rayPool) {
    const points = profiles[ray.profile].points;
    ray.nodes = new Float64Array(points.length * 6);
    ray.screen=new Float64Array(points.length*2);ray.curves=new Float64Array((points.length-1)*8);
    for (let i = 0; i < points.length; i++) {
      ray.nodes[i * 6] = points[i].x * ray.cos - points[i].y * ray.sin;
      ray.nodes[i * 6 + 1] = points[i].x * ray.sin + points[i].y * ray.cos;
    }
  }
  setDensity();
  updateDropWells();
  paintFrame();
  reportState(0);
  canvas.dataset.ready = 'true';
  announce(`${flow === 'converge' ? 'Inward' : 'Outward'} field ready. Hover attracts nearby light; the main center stays fixed.`);
}

function setDensity() {
  for (const bin of bins) bin.length = 0;
  for (let i = 0; i < rayPool.length; i++) {
    const ray = rayPool[i];
    const visible = i < settings.density;
    if (visible && !ray.visible) for (let n = 0; n < ray.nodes.length; n += 6) {
      ray.nodes[n + 2] = ray.nodes[n + 3] = ray.nodes[n + 4] = ray.nodes[n + 5] = 0;
    }
    ray.visible = visible;
    if (visible) bins[ray.bin].push(ray);
  }
}

function resize() {
  const bounds = artwork.getBoundingClientRect();
  width = bounds.width;
  height = bounds.height;
  scale = height * .5;
  ratio = Math.min(devicePixelRatio || 1, 1.5);
  outerRadius = Math.hypot(width / height, 1) * 2.12;
  canvas.width = layer.width = Math.round(width * ratio);
  canvas.height = layer.height = Math.round(height * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  lines.setTransform(ratio, 0, 0, ratio, 0, 0);
  colorField.resize(ctx, width, height);
  prepareRayEntrance();
  prepareCore();
  reset({ preserveDrops: true });
}

function updateGeometry(dt) {
  if (!geometryActive && !dropWells.length && !placement.items.length && focus.influence < .003 && focus.history.every(well => well.influence < .003)) return;
  let displacement2 = 0, speed2 = 0;
  geometryActive = false;
  const cursorReleased = hoverEnabled && !focus.active;
  for (const bin of bins) for (const ray of bin) {
    const nodes = ray.nodes;
    const omega = ray.response * focus.reactionRate;
    const variation = (ray.response - CURSOR_RESPONSE.lightMin) / CURSOR_RESPONSE.lightSpread;
    const releasedResponse = filamentResponse(dt, omega, cursorReleased, focus.releaseCharge, variation);
    const placedFields = dropWells.length ? lightFieldsForRay(dropWells, ray) : dropWells;
    const activeResponse = placedFields.length && cursorReleased ? filamentResponse(dt, omega, false, 0, variation) : releasedResponse;
    const well = focus.delayed(ray.delay / focus.reactionRate);
    for (let i = 0; i < nodes.length; i += 6) {
      const target = placedFields.length ? projectLightFields(focus, nodes[i], nodes[i + 1], well, placedFields, flow)
        : focus.project(nodes[i], nodes[i + 1], well, flow);
      if(placement.items.length)placement.apply(target,nodes[i],nodes[i+1]);
      const targetX = target.x - nodes[i], targetY = target.y - nodes[i + 1];
      if (targetX === 0 && targetY === 0 && nodes[i + 2] === 0 && nodes[i + 3] === 0 && nodes[i + 4] === 0 && nodes[i + 5] === 0) continue;
      const released = cursorReleased && (!placedFields.length || target.placedInfluence < .003);
      settleFilamentNode(nodes, i, targetX, targetY, dt, released ? releasedResponse : activeResponse, released);
      if (nodes[i + 2] !== 0 || nodes[i + 3] !== 0 || nodes[i + 4] !== 0 || nodes[i + 5] !== 0) geometryActive = true;
      if (Math.abs(nodes[i]) < width / height && Math.abs(nodes[i + 1]) < 1) {
        displacement2 = Math.max(displacement2, nodes[i + 2] ** 2 + nodes[i + 3] ** 2);
        speed2 = Math.max(speed2, nodes[i + 4] ** 2 + nodes[i + 5] ** 2);
      }
    }
  }
  maxDisplacement = Math.sqrt(displacement2) * scale;
  maxLightSpeed = Math.sqrt(speed2) * scale;
}

function placeNode(ray, index) {
  const nodes = ray.nodes;
  const i = index * 6;
  return { x: screenX(nodes[i] + nodes[i + 2]), y: screenY(nodes[i + 1] + nodes[i + 3]) };
}

function placeAtTime(ray,time){
  const profile=profiles[ray.profile],points=profile.points;
  time=Math.max(0,Math.min(profile.duration,time));const i=segmentAtTime(points,time);
  return cubicPoint(ray.curves,i*8,(time-points[i].t)/(points[i+1].t-points[i].t));
}
function refreshCurves(){
  for(const bin of bins)for(const ray of bin){
    const points=profiles[ray.profile].points;
    for(let n=0;n<points.length;n++){ray.screen[n*2]=screenX(ray.nodes[n*6]+ray.nodes[n*6+2]);ray.screen[n*2+1]=screenY(ray.nodes[n*6+1]+ray.nodes[n*6+3]);}
    cubicSegments(points,ray.screen,ray.curves);
  }
}

function updateDropWells() {
  dropWells = lightDrops.fields(carrierAtTime, settings.reach);
}

function carrierAtTime(rayIndex, time) {
  const ray = rayPool[rayIndex], point = pointAtTime(profiles[ray.profile], time);
  return { x: point.x * ray.cos - point.y * ray.sin, y: point.x * ray.sin + point.y * ray.cos };
}

function trace(ray,start,end){
  const profile=profiles[ray.profile],points=profile.points;start=Math.max(0,start);end=Math.min(profile.duration,end);if(end<=start)return;
  const first=placeAtTime(ray,start);lines.moveTo(first.x,first.y);
  for(let i=segmentAtTime(points,start),high=segmentAtTime(points,end);i<=high;i++){
    const dt=points[i+1].t-points[i].t,a=Math.max(0,(start-points[i].t)/dt),b=Math.min(1,(end-points[i].t)/dt),n=i*8;
    if(b<=a)continue;
    if(a===0&&b===1)lines.bezierCurveTo(ray.curves[n+2],ray.curves[n+3],ray.curves[n+4],ray.curves[n+5],ray.curves[n+6],ray.curves[n+7]);
    else lines.bezierCurveTo(...trimmedCubic(ray.curves,n,a,b));
  }
}

function paintFilaments() {
  refreshCurves();
  lines.clearRect(0, 0, width, height);
  lines.globalCompositeOperation = 'source-over';
  // Restore the continuous filament structure from the earlier magnetic
  // study. Light pulses travel on these same paths; cursor movement never
  // adds copies or a second trail layer.
  const fieldAlphas = [.14, .24, .38, .58];
  const taper = [1, .94, .80, .60, .34, .10];
  lines.lineCap = 'round';
  for (let bin = 0; bin < bins.length; bin++) {
    lines.lineWidth = .58;
    lines.beginPath();
    for (const ray of bins[bin]) trace(ray, 0, profiles[ray.profile].duration);
    // Let the moving accents feed the core. Dense background filaments fade
    // near it instead of overlapping into a broad gray/white disk.
    const opacity = fieldAlphas[bin] * .55 * Math.min(1, Math.sqrt(1200 / settings.density));
    const ink = lines.createRadialGradient(screenX(0), screenY(0), 0, screenX(0), screenY(0), scale * .48);
    ink.addColorStop(0, 'rgba(235,237,240,0)');
    ink.addColorStop(.32, 'rgba(235,237,240,0)');
    ink.addColorStop(.60, `rgba(235,237,240,${opacity * .26})`);
    ink.addColorStop(1, `rgba(235,237,240,${opacity})`);
    lines.strokeStyle = ink;
    lines.stroke();

    lines.lineWidth = .70 + bin * .09;
    for (let slice = 0; slice < taper.length; slice++) {
      lines.beginPath();
      for (const ray of bins[bin]) {
        const duration = profiles[ray.profile].duration;
        const length = ray.length * settings.rayLength;
        const head = streakHead(ray.phase, duration, length, flow);
        const sign = flow === 'converge' ? 1 : -1;
        const a = head + sign * length * slice / taper.length;
        const b = head + sign * length * (slice + 1) / taper.length;
        trace(ray, Math.max(0, Math.min(a, b)), Math.min(duration, Math.max(a, b)));
      }
      lines.strokeStyle = `rgba(240,244,248,${alphas[bin] * taper[slice]})`;
      lines.stroke();
    }
  }
}

function prepareCore(){
  const radius=Math.max(12,scale*.12),extent=radius*2;
  coreLayer.width=coreLayer.height=Math.ceil(extent*ratio);corePaint.setTransform(ratio,0,0,ratio,0,0);
  const x=radius,y=x,glow=corePaint.createRadialGradient(x,y,0,x,y,radius);
  glow.addColorStop(0,'rgba(253,255,254,.99)');glow.addColorStop(.24,'rgba(253,255,254,.84)');glow.addColorStop(.55,'rgba(253,255,254,.30)');glow.addColorStop(.86,'rgba(253,255,254,.025)');glow.addColorStop(1,'rgba(253,255,254,0)');
  corePaint.fillStyle=glow;corePaint.fillRect(0,0,extent,extent);
}

function prepareRayEntrance() {
  // A cached, smooth opacity falloff leaves quieter space for corner copy.
  // Apply it only to rays; background grain, lights and gravity keep their
  // own rendering. Rays gain their full brightness as they travel inward.
  rayEntrance.width = 384;
  rayEntrance.height = Math.max(1, Math.round(384 * height / width));
  const edgeGradient = (horizontal, reach) => {
    const gradient = entrancePaint.createLinearGradient(0, 0, horizontal ? rayEntrance.width : 0, horizontal ? 0 : rayEntrance.height);
    for (let i = 0; i <= 16; i++) {
      const t = i / 16, opacity = EDGE_RAY_OPACITY + (1 - EDGE_RAY_OPACITY) * t * t * (3 - 2 * t);
      gradient.addColorStop(t * reach, `rgba(255,255,255,${opacity})`);
    }
    for (let i = 16; i >= 0; i--) {
      const t = i / 16, opacity = EDGE_RAY_OPACITY + (1 - EDGE_RAY_OPACITY) * t * t * (3 - 2 * t);
      gradient.addColorStop(1 - t * reach, `rgba(255,255,255,${opacity})`);
    }
    return gradient;
  };
  entrancePaint.fillStyle = edgeGradient(true, .18);
  entrancePaint.fillRect(0, 0, rayEntrance.width, rayEntrance.height);
  entrancePaint.globalCompositeOperation = 'destination-in';
  entrancePaint.fillStyle = edgeGradient(false, .22);
  entrancePaint.fillRect(0, 0, rayEntrance.width, rayEntrance.height);
  entrancePaint.globalCompositeOperation = 'source-over';
}

function paintCore(){const extent=Math.max(12,scale*.12)*2*breathingScale(orbSeconds,CORE_BREATH_AMOUNT);ctx.drawImage(coreLayer,screenX(0)-extent*.5,screenY(0)-extent*.5,extent,extent);}
function paintDrops(){for(const drop of lightDrops.items){const position=lightDrops.position(drop,carrierAtTime),appearance=dropAppearance(drop,position);paintOrb(ctx,{x:screenX(position.x),y:screenY(position.y),radius:Math.max(9,scale*.038)*appearance.radiusScale,seconds:orbSeconds,option:drop.orb,clicked:1,brightness:appearance.brightness,opacity:drop.opacity*appearance.opacityScale});}}

function paintFrame() {
  paintFilaments();
  const spot = {
    x: screenX(focus.x), y: screenY(focus.y), originX: screenX(0), originY: screenY(0), flow,
    radius: settings.reach * scale, exposure: colorExposure.value, size: colorExposure.size,seconds:orbSeconds,
  };
  colorField.background(ctx, width, height, spot);
  colorField.tintRays(lines,width,height,spot,dropWells.map(well=>({x:screenX(well.x),y:screenY(well.y),originX:screenX(0),originY:screenY(0),flow,radius:well.radius*scale,exposure:well.influence*.55,size:.8})));
  lines.save();
  lines.globalCompositeOperation = 'destination-in';
  lines.drawImage(rayEntrance, 0, 0, width, height);
  lines.restore();
  ctx.drawImage(layer, 0, 0, width, height);
  paintDrops();
  const handedOff=depositedCursorPoint&&Math.hypot(focus.targetX-depositedCursorPoint.x,focus.targetY-depositedCursorPoint.y)<.08;
  paintOrb(ctx,{x:spot.x,y:spot.y,radius:Math.max(8,scale*.032)*(.65+.35*colorExposure.size/1.4)*coreProximityScale(Math.hypot(focus.x,focus.y)),seconds:orbSeconds,option:orbOption,opacity:handedOff?0:Math.min(1,colorExposure.value*1.3)});
  paintCore();
}

function reportState(frameMs) {
  Object.assign(canvas.dataset, {
    flow, rays: String(settings.density), continuousPaths: String(settings.density), fieldCenters: String(1 + dropWells.length), historyTrails: '0', inertia: 'delayed-momentum', visualModel: 'approved-magnetic-filaments', geometry:'C1-cubic-curves', pullModel:'previous-hover-force',
    cursorPolarity: 'approach-attract-departure-repel', broadBloom: 'off', cursorHaze: 'off', coreStyle: 'white-hot-star', coreBreathingScale:breathingScale(orbSeconds,CORE_BREATH_AMOUNT).toFixed(4), centerMask: 'off',
    rayEntrance: 'smooth-edge-opacity', edgeRayOpacity: String(EDGE_RAY_OPACITY), cornerRayOpacity: String(EDGE_RAY_OPACITY ** 2), innerRayOpacity: '1',
    colorStudy: '01-cool-field', colorPalette: 'axis-core-field', localExposure: colorExposure.value.toFixed(3),
    colorRendering: 'reference-inner-color-gradients', backgroundGradient: 'restored-compact-49-100-inward-arc', backgroundGrain: 'fine-correlated-tonal-grain',grainSizePx:String(BACKGROUND_GRAIN.size),grainSizeUnit:'device-pixel-within-one-percent',grainOpacity:String(BACKGROUND_GRAIN.opacity),grainBlend:BACKGROUND_GRAIN.blend,grainBaseExposure:String(BACKGROUND_GRAIN.baseExposure),grainMotion:flow==='radiate'?'gentle-radial-outward-drift':'gentle-radial-inward-drift',grainLayer:'above-gradient-below-rays-and-lights',grainPhase:((orbSeconds/BACKGROUND_GRAIN.driftSeconds)%1).toFixed(3),grainLoopSeconds:String(BACKGROUND_GRAIN.driftSeconds),grainEvolutionSeconds:String(BACKGROUND_GRAIN.loopSeconds),grainContraction:String(BACKGROUND_GRAIN.contraction),grainSource:BACKGROUND_GRAIN.nodeId, cursorLighting: 'shared-field-and-incoming-rays',
    cursorPace: 'smaller-and-dimmer', restingGradientGain: '1.40', lightDrops: String(lightDrops.items.length),
    lightDropRadiusPx: Math.max(9,scale*.038).toFixed(1),orbOption,orbCycle:ORB_PROTOTYPE||orbCycle.join(','),orbPeriodSeconds:String(ORB_PERIOD),orbRotation:(orbSeconds*360/ORB_PERIOD).toFixed(2),orbBreathingScale:breathingScale(orbSeconds).toFixed(4),orbGlowBreathingScale:breathingScale(orbSeconds,ORB_GLOW_BREATH_AMOUNT).toFixed(4),orbBreathingPeriodSeconds:String(ORB_BREATH_PERIOD),orbBreathingAmount:String(ORB_BREATH_AMOUNT),sourceMotion:'independent-of-cursor',
    placedGravity: 'deposited-hover-field', placementResponse:'damped-depth-settle', placedSize:'distance-taper', placedFields: String(dropWells.length),
    clickLightResponse:'tiny-local-settle',clickPulses:String(placement.items.length),
    dotInteraction: 'softened-newtonian-pairs', pairTimeStep: '1/240',
    placedFieldPositions: JSON.stringify(dropWells.map(well => ({id: well.id, x: +well.x.toFixed(4), y: +well.y.toFixed(4), influence: +well.influence.toFixed(3), radiusPx: +(well.radius * scale).toFixed(1)}))),
    lightDropPositions: JSON.stringify(lightDrops.items.map(drop => {
      const position = lightDrops.position(drop, carrierAtTime);
      const appearance=dropAppearance(drop,position);
      return { id: drop.id,orb:drop.orb, x: +position.x.toFixed(4), y: +position.y.toFixed(4), progress: +drop.progress.toFixed(3), opacity: +drop.opacity.toFixed(3), displayedOpacity:+(drop.opacity*appearance.opacityScale).toFixed(3),brightness:+appearance.brightness.toFixed(3),gravity: +drop.gravity.toFixed(3), radiusPx:+(Math.max(9,scale*.038)*appearance.radiusScale*breathingScale(orbSeconds)).toFixed(2),settlingScale:+appearance.settlingScale.toFixed(4),pairOffsetPx: +(Math.hypot(drop.couplingX, drop.couplingY) * scale).toFixed(1), vx: +drop.vx.toFixed(4), vy: +drop.vy.toFixed(4) };
    })),
    cursorColorRadiusPx: (cursorColorRadius(settings.reach * scale, colorExposure.size) * 1.04).toFixed(1), cursorColorSize: colorExposure.size.toFixed(3),
    returnMotion: 'slow-damped', returnMode: focus.active ? 'local' : 'released',
    cursorResponse: 'gentler-moving-field',
    absorption: 'whole-streak', forceDelayMs: `${Math.round(CURSOR_RESPONSE.delayMin * 1000 / focus.reactionRate)}–${Math.round((CURSOR_RESPONSE.delayMin + CURSOR_RESPONSE.delaySpread + CURSOR_RESPONSE.delayJitter) * 1000 / focus.reactionRate)}`,
    tempo: tempo.toFixed(2),
    state: paused ? 'paused' : 'running', hover: hoverEnabled ? 'enabled' : 'disabled',
    frameMs: frameMs.toFixed(2), simulationTime: elapsed.toFixed(3),
    fieldMu: MODEL.mu.toFixed(5), hoverMass: (focus.mu - MODEL.mu).toFixed(5),
    fieldX: '0.0000', fieldY: '0.0000', fixedCenter: 'true',
    hoverX: focus.x.toFixed(4), hoverY: focus.y.toFixed(4),
    pointerX: focus.targetX.toFixed(4), pointerY: focus.targetY.toFixed(4),
    pointerActive: String(focus.active), dwellSeconds: focus.dwell.toFixed(2),
    pointerSpeed: focus.pointerSpeed.toFixed(3), paceGain: focus.paceGain.toFixed(3),
    movingGainFloor: (1 - settings.speedContrast * (1 - CURSOR_RESPONSE.movingFloor)).toFixed(3),
    hoverStrength: focus.influence.toFixed(3), maxContraction: settings.pullStrength.toFixed(2),
    rayLength: settings.rayLength.toFixed(2), reach: settings.reach.toFixed(2),
    reactionSpeed: settings.reaction.toFixed(2), speedContrast: settings.speedContrast.toFixed(2),
    charge: focus.charge.toFixed(3), holdSeconds: focus.hold.toFixed(2),
    influenceRadiusPx: (focus.radius * scale).toFixed(1),
    maxDisplacementPx: maxDisplacement.toFixed(1), maxLightSpeedPx: maxLightSpeed.toFixed(1),
    recoverySeconds: (.65 + 3.2 * focus.releaseCharge).toFixed(2),
  });
}

function frame(timestamp) {
  requestAnimationFrame(frame);
  if (!previousTime) previousTime = timestamp;
  const rotationDt = (timestamp - previousTime) / 1000;
  const realDt = Math.min(rotationDt, .06);
  previousTime = timestamp;
  if (paused || document.hidden || realDt <= 0) return;
  const started = performance.now();
  orbSeconds+=rotationDt;
  focus.update(realDt, hoverEnabled);
  colorExposure.update(realDt, focus, hoverEnabled);
  lightDrops.update(realDt, carrierAtTime, settings.pullStrength / DEFAULT_SETTINGS.pullStrength);
  placement.update(realDt);
  prepareProfiles();
  updateDropWells();
  updateGeometry(realDt);
  const simulationDt = realDt * .42 * tempo;
  elapsed += simulationDt;
  // The tip may travel behind the core while the remaining tail feeds in.
  // Reset only after the entire streak has become invisible.
  for (const ray of rayPool) {
    ray.phase = streakPhase(ray.phase, simulationDt, profiles[ray.profile].duration, ray.length * settings.rayLength, flow);
  }
  paintFrame();
  frameCount++;
  frameTotal += performance.now() - started;
  if (timestamp - lastReport > 250) {
    reportState(frameTotal / frameCount);
    frameCount = frameTotal = 0;
    lastReport = timestamp;
  }
}

function announce(message) { document.querySelector('#status').textContent = message; }
function updatePause() {
  pauseButton.textContent = paused ? 'Play' : 'Pause';
  pauseButton.setAttribute('aria-label', paused ? 'Play animation' : 'Pause animation');
  canvas.dataset.state = paused ? 'paused' : 'running';
}
function togglePause() { paused = !paused; previousTime = 0; updatePause(); }
function toggleNotes(open = notes.hidden) {
  notes.hidden = !open;
  document.querySelector('#about').setAttribute('aria-expanded', String(open));
}
function toggleControls() {
  if (document.body.classList.contains('banner-presentation')) return;
  const hidden = document.body.classList.toggle('artwork-only');
  document.querySelector('.controls').hidden = hidden;
  document.querySelector('#restore-controls').hidden = !hidden;
  tuning.hidden = hidden || !tuningOpen;
  toggleNotes(false);
  measureChrome();
}

function loadSettings() {
  try { return resolveSettings(JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')); }
  catch { storageAvailable = false; return { ...DEFAULT_SETTINGS }; }
}

function syncTuning() {
  for (const input of tuning.querySelectorAll('[data-setting]')) {
    const key = input.dataset.setting;
    input.value = settings[key];
    const formatted = key === 'density' ? String(settings[key])
      : key === 'reach' ? `${Math.round(settings[key] * 50)}% of height`
      : `${Math.round(settings[key] * 100)}%`;
    input.setAttribute('aria-label', input.closest('label').querySelector('.tune-label > span').textContent);
    input.setAttribute('aria-valuetext', formatted);
    document.querySelector(`#${input.id}-value`).value = formatted;
  }
}

function applySettings(values) {
  const previous = settings;
  settings = resolveSettings({ ...settings, ...values });
  if (settings.rayLength !== previous.rayLength) for (const ray of rayPool) {
    const duration = profiles[ray.profile].duration;
    const oldLength = ray.length * previous.rayLength;
    const length = ray.length * settings.rayLength;
    const head = streakHead(ray.phase, duration, oldLength, flow);
    const phase = (flow === 'converge' ? head + length : head) / (duration + length);
    ray.phase = ((phase % 1) + 1) % 1;
  }
  focus.configure(settings);
  if (settings.density !== previous.density) setDensity();
  syncTuning();
  updateDropWells();
  paintFrame();
  reportState(0);
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    storageAvailable = true;
  } catch { storageAvailable = false; }
  tuningStatus.textContent = storageAvailable ? 'Saved in this browser' : 'Live changes · saving is unavailable';
}

function measureChrome() {
  const height = document.querySelector('.controls').getBoundingClientRect().height + tuning.getBoundingClientRect().height;
  document.documentElement.style.setProperty('--chrome-height', `${height}px`);
}

function toggleTuning() {
  tuningOpen = !tuningOpen;
  tuning.hidden = !tuningOpen;
  const button = document.querySelector('#tune-toggle');
  button.setAttribute('aria-expanded', String(tuningOpen));
  button.querySelector('span').textContent = tuningOpen ? '−' : '+';
  measureChrome();
}
tuning.querySelectorAll('[data-setting]').forEach(input => input.addEventListener('input', () => applySettings({ [input.dataset.setting]: Number(input.value) })));
document.querySelector('#reset-settings').addEventListener('click', () => applySettings(DEFAULT_SETTINGS));
document.querySelector('#tune-toggle').addEventListener('click', toggleTuning);
syncTuning();
tuningStatus.textContent = storageAvailable ? 'Changes save in this browser' : 'Live changes · saving is unavailable';
const chromeObserver = new ResizeObserver(measureChrome);
chromeObserver.observe(document.querySelector('.controls'));
chromeObserver.observe(tuning);
measureChrome();
document.querySelectorAll('[data-flow]').forEach(button => button.addEventListener('click', () => {
  if (flow === button.dataset.flow) return;
  flow = button.dataset.flow;
  document.querySelectorAll('[data-flow]').forEach(item => {
    item.classList.toggle('selected', item === button);
    item.setAttribute('aria-pressed', String(item === button));
  });
  canvas.setAttribute('aria-label', `Fine luminous filaments ${flow === 'converge' ? 'falling into' : 'radiating from'} one softly glowing center`);
  reset();
}));
pauseButton.addEventListener('click', togglePause);
document.querySelector('#restart').addEventListener('click', reset);
document.querySelector('#tempo').addEventListener('input', event => {
  tempo = Number(event.target.value);
  document.querySelector('#tempo-value').value = `${tempo.toFixed(2)}×`;
});
document.querySelector('#artwork-only').addEventListener('click', toggleControls);
document.querySelector('#restore-controls').addEventListener('click', toggleControls);
document.querySelector('#about').addEventListener('click', () => toggleNotes());
document.querySelector('#close-notes').addEventListener('click', () => toggleNotes(false));

function pointAtCursor(event) {
  if (event.pointerType === 'touch' || !hoverEnabled) return;
  canvas.dataset.pointerEvent = event.type;
  canvas.dataset.pointerTrusted = String(event.isTrusted);
  const bounds = canvas.getBoundingClientRect();
  focus.point((event.clientX - bounds.left - width * .5) / scale, (event.clientY - bounds.top - height * .49) / scale, event.timeStamp / 1000);
}
canvas.addEventListener('pointerenter', pointAtCursor);
canvas.addEventListener('pointermove', pointAtCursor);
canvas.addEventListener('click', event => {
  if (event.button !== 0) return;
  const bounds = canvas.getBoundingClientRect();
  const x = event.clientX - bounds.left, y = event.clientY - bounds.top;
  let nearest = null, minimum = Infinity;
  // Attach to the closest point on a visible, currently deformed filament.
  // Its future position continues to use that very same filament geometry.
  for (let index = 0; index < settings.density; index++) {
    const ray = rayPool[index], points = profiles[ray.profile].points;
    let a = placeNode(ray, 0);
    for (let n = 1; n < points.length; n++) {
      const b = placeNode(ray, n), dx = b.x - a.x, dy = b.y - a.y;
      const u = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / Math.max(.0001, dx * dx + dy * dy)));
      const px = a.x + dx * u, py = a.y + dy * u;
      const distance2 = (x - px) ** 2 + (y - py) ** 2;
      if (distance2 < minimum) {
        minimum = distance2;
        nearest = { ray: index, time: points[n - 1].t + (points[n].t - points[n - 1].t) * u, distance: Math.hypot((x - width * .5) / scale, (y - height * .49) / scale), offsetX: (x - px) / scale, offsetY: (y - py) / scale };
      }
      a = b;
    }
  }
  if (nearest) {
    // Capture the visible click position relative to an independent carrier.
    // Future line deformation cannot feed back into the body's force sample.
    const carrier = carrierAtTime(nearest.ray, nearest.time);
    nearest.offsetX = (x - width * .5) / scale - carrier.x;
    nearest.offsetY = (y - height * .49) / scale - carrier.y;
  }
  if(nearest)Object.assign(nearest,{influence:focus.influence,radius:focus.radius,orb:orbOption});
  const drop = nearest && lightDrops.add(nearest);
  if (!drop) return;
  // A paused preview can still show the placed point without starting motion.
  drop.opacity = 1;
  placement.add((x-width*.5)/scale,(y-height*.49)/scale);
  chooseOrb(nextOrb(orbCycle,orbOption));
  try{localStorage.setItem(ORB_KEY,orbOption);}catch{}
  depositedCursorPoint={x:focus.targetX,y:focus.targetY};
  updateDropWells();
  paintFrame();
  reportState(0);
  announce(`Light placed. Nearby lines settle gently; the next cursor light is ${resolveOrb(orbOption).name}.`);
});
canvas.addEventListener('pointerenter', () => { depositedCursorPoint=null; });
canvas.addEventListener('pointerleave', () => focus.leave());
window.addEventListener('blur', () => focus.leave());
document.querySelector('#hover').addEventListener('click', event => {
  hoverEnabled = !hoverEnabled;
  focus.leave();
  event.currentTarget.textContent = hoverEnabled ? 'Hover on' : 'Hover off';
  event.currentTarget.setAttribute('aria-pressed', String(hoverEnabled));
  event.currentTarget.setAttribute('aria-label', hoverEnabled ? 'Disable cursor gravity' : 'Enable cursor gravity');
  canvas.dataset.hover = hoverEnabled ? 'enabled' : 'disabled';
});
document.addEventListener('keydown', event => {
  if (['INPUT', 'BUTTON', 'A', 'TEXTAREA'].includes(event.target.tagName)) return;
  if (event.code === 'Space') { event.preventDefault(); togglePause(); }
  if (event.key.toLowerCase() === 'h') toggleControls();
  if (event.key.toLowerCase() === 'r') reset();
  if (event.key === 'Escape') toggleNotes(false);
});
document.addEventListener('visibilitychange', () => { focus.leave(); previousTime = 0; });
reducedMotion.addEventListener('change', event => { paused = event.matches; previousTime = 0; updatePause(); });
warmOrbTextures();
new ResizeObserver(resize).observe(artwork);
updatePause();
requestAnimationFrame(frame);
