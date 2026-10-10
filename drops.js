import { PAIR_GRAVITY, advancePairBodies } from './coupling.js?revision=de2b55ccf165';


const clamp = value => Math.max(0, Math.min(1, value));
const smooth = value => { const t = clamp(value); return t * t * (3 - 2 * t); };
const sinkWeight = drop => 1 - smooth((drop.progress - .72) / .28);

// A placement impulse in depth: one restrained lift, a smaller return,
// then rest. It does not feed cursor motion into a heavy source's position.
export function placementSpring(age){return .13*Math.exp(-2.6*Math.max(0,age))*Math.sin(5.1*Math.max(0,age));}
export function coreProximityScale(distance){return .12+.88*smooth(Math.max(0,distance)/.60);}
export function dropAppearance(drop,position){
  const distance=Math.hypot(position.x,position.y);
  const travelScale=.10+.90*clamp(distance/drop.startDistance)**.65;
  const bounce=placementSpring(drop.age);
  const nearCore=1-smooth(distance/.65);
  return {radiusScale:travelScale*coreProximityScale(distance)*(1+bounce),settlingScale:1+bounce,distance,brightness:1+.60*nearCore,opacityScale:1-.90*nearCore};
}

// Clicked lights belong to existing filaments. They outlive hover, pause with
// the scene, and travel inward on the trajectory's own accelerating clock.
export class LightDrops {
  constructor() { this.reset(); }
  reset() { this.items = []; this.nextId = 1; }
  add({ ray, time, distance, offsetX = 0, offsetY = 0, influence = .86, radius = null, orb = '01' }) {
    if (this.items.length >= 8 || distance < .08 || time <= 0) return null;
    const drop = {
      id: this.nextId++, ray, startTime: time, offsetX, offsetY,
      age: 0, hold: .55, duration: 4 + Math.min(3.5, distance * 2),
      progress: 0, time, opacity: 1, attachment: 1, gravity: .86,
      couplingX: 0, couplingY: 0, vx: 0, vy: 0,
      rebaseX: 0, rebaseY: 0,
      initialInfluence: Math.max(.22, influence), initialRadius: radius, orb,
      startDistance: Math.max(.08,distance),
    };
    drop.gravity = drop.initialInfluence;
    this.items.push(drop);
    return drop;
  }
  updateLife(dt) {
    for (const drop of this.items) {
      drop.age += dt;
      drop.progress = clamp((drop.age - drop.hold) / drop.duration);
      const travel = drop.progress ** 1.35;
      drop.time = drop.startTime * (1 - travel);
      drop.attachment = 1 - smooth(Math.max(0, drop.age - drop.hold) / 1.4);
      drop.opacity = 1 - smooth((drop.progress - .93) / .07);
      // The deposited field stays strong during its initial hold, then
      // loses strength continuously throughout the journey into the star.
      drop.gravity = drop.initialInfluence * (1 - smooth(drop.progress));
    }
  }

  position(drop, positionAtTime) {
    const guide = this.guide(drop, positionAtTime);
    return { x: guide.x + drop.couplingX, y: guide.y + drop.couplingY };
  }

  guide(drop, positionAtTime) {
    const base = positionAtTime(drop.ray, drop.time), remaining = 1 - drop.progress ** 1.35;
    return { x: base.x + drop.offsetX * drop.attachment + (drop.rebaseX || 0) * remaining,
      y: base.y + drop.offsetY * drop.attachment + (drop.rebaseY || 0) * remaining };
  }

  rebase(previousGuides, positionAtTime, durationRatios, xFactor, yFactor) {
    for (let i = 0; i < this.items.length; i++) {
      const drop = this.items[i], previous = previousGuides[i], timeScale = durationRatios[drop.ray];
      drop.startTime *= timeScale; drop.time *= timeScale;
      drop.offsetX *= xFactor; drop.offsetY *= yFactor;
      drop.couplingX *= xFactor; drop.couplingY *= yFactor;
      drop.vx *= xFactor; drop.vy *= yFactor;
      drop.rebaseX = (drop.rebaseX || 0) * xFactor;
      drop.rebaseY = (drop.rebaseY || 0) * yFactor;
      const current = this.guide(drop, positionAtTime), remaining = Math.max(1e-8, 1 - drop.progress ** 1.35);
      // A residual carrier offset advects into the star, without a position
      // jump or a new lifetime when a window changes shape mid-flight.
      drop.rebaseX += (previous.x * xFactor - current.x) / remaining;
      drop.rebaseY += (previous.y * yFactor - current.y) / remaining;
    }
  }

  update(dt, positionAtTime, gravityScale = 1) {
    if (!positionAtTime || (this.items.length < 2 && this.items.every(drop => !drop.couplingX && !drop.couplingY && !drop.vx && !drop.vy))) {
      this.updateLife(dt);
    } else {
      const count = Math.max(1, Math.ceil(dt / PAIR_GRAVITY.step)), step = dt / count;
      const pairModel = { ...PAIR_GRAVITY, G: PAIR_GRAVITY.G * gravityScale };
      for (let n = 0; n < count; n++) {
        const guides = this.items.map(drop => {
          return { ...this.guide(drop, positionAtTime), sink: sinkWeight(drop) };
        });
        const bodies = this.items.map((drop, i) => ({ x: guides[i].x + drop.couplingX,
          y: guides[i].y + drop.couplingY, vx: drop.vx, vy: drop.vy, mass: drop.gravity }));
        advancePairBodies(bodies, step, () => {
          this.updateLife(step);
          for (let i = 0; i < bodies.length; i++) {
            const drop = this.items[i], body = bodies[i], previous = guides[i];
            const guide = this.guide(drop, positionAtTime);
            const nextX = guide.x, nextY = guide.y;
            // Inward advection is retained. The final absorption gradually
            // dissipates the relative offset and velocity into the fixed star.
            const absorption = previous.sink > 1e-8 ? sinkWeight(drop) / previous.sink : 0;
            body.x = nextX + (body.x - previous.x) * absorption;
            body.y = nextY + (body.y - previous.y) * absorption;
            body.vx *= absorption;
            body.vy *= absorption;
            body.mass = drop.gravity;
          }
        }, pairModel);
        for (let i = 0; i < bodies.length; i++) {
          const drop = this.items[i], body = bodies[i], guide = this.guide(drop, positionAtTime);
          drop.couplingX = body.x - guide.x;
          drop.couplingY = body.y - guide.y;
          drop.vx = body.vx; drop.vy = body.vy;
        }
      }
    }
    this.items = this.items.filter(drop => drop.progress < 1);
  }

  fields(positionAtTime, reach) {
    return this.items.filter(drop => drop.gravity >= .003).map(drop => {
      const position = this.position(drop, positionAtTime);
      return {
        id: drop.id, hostRay: drop.ray,
        x: position.x, y: position.y,
        influence: drop.gravity,
        radius: (drop.initialRadius || reach) * (.65 + .35 * drop.gravity / drop.initialInfluence),
        z: 0,
      };
    });
  }
}

// Marker positions use independent carrier coordinates, so their source
// filament can respond too without feeding its deformation into the source.
export function lightFieldsForRay(fields, ray) {
  return fields.filter(well => {
    const along = Math.max(0, well.x * ray.cos + well.y * ray.sin);
    const dx = well.x - along * ray.cos, dy = well.y - along * ray.sin;
    return dx * dx + dy * dy < well.radius * well.radius;
  });
}

// Deposit precisely the existing hover lens. Bodies keep independent guide
// coordinates; the cursor only enters this light-geometry calculation.
export function projectLightFields(focus,x,y,cursor,fields,flow){
  if(!fields.length)return {...focus.project(x,y,cursor,flow),placedInfluence:0};
  const duplicate=fields.reduce((v,w)=>Math.max(v,Math.exp(-((cursor.x-w.x)**2+(cursor.y-w.y)**2)/(.10**2))),0);
  const hover={...cursor,influence:cursor.influence*(1-duplicate)};
  const target=focus.project(x,y,hover,flow);
  let dx=target.x-x,dy=target.y-y,placedInfluence=0,contributions=Math.hypot(dx,dy)>1e-12?1:0,reach=cursor.radius;
  for(const well of fields){
    const projected=focus.project(x,y,well,flow),px=projected.x-x,py=projected.y-y;
    if(Math.hypot(px,py)<1e-12)continue;
    dx+=px;dy+=py;contributions++;reach=Math.max(reach,well.radius);
    const q=((x-well.x)**2+(y-well.y)**2)/well.radius**2;
    placedInfluence+=well.influence*(1-q)**2;
  }
  // A single deposited field is mathematically identical to hover. Only
  // genuine overlaps receive a soft display limit after vector addition.
  if(contributions>1){const size=Math.hypot(dx,dy),limit=reach*focus.settings.pullStrength*.75;const gain=size>1e-12?limit*Math.tanh(size/limit)/size:1;dx*=gain;dy*=gain;}
  return {x:x+dx,y:y+dy,placedInfluence};
}
