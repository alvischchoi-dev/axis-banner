// Exact base colors from AXIS Brand Elements / Gradient recipes, 3:44.
import { AXIS_PALETTE } from './color.js?revision=refined-tonal-grain-1';
export const ORB_KEY = 'axis-cursor-orb-v1';
export const ORB_SELECTION_KEY = 'axis-cursor-orb-cycle-v1';
export const ORB_PERIOD = 6;
export const ORB_BREATH_PERIOD = 2.4;
export const ORB_BREATH_AMOUNT = .12;
export const ORB_GLOW_BREATH_AMOUNT = .22;
export const CORE_BREATH_AMOUNT = .08;
export const ORB_PROTOTYPE = null;
const C = AXIS_PALETTE;
export const ORB_OPTIONS = Object.freeze([
  {id:'01',name:'Aqua / Mint',description:'Field Aqua into Ion Mint',colors:['aqua','mint'],clicked:['aqua','mint'],offset:[.11,-.08],scale:1.3,rose:0,pool:.46,rim:.20,softness:.18,glowRadius:2.15,glow:1.20},
  {id:'02',name:'Blue / Aqua',description:'Orbit Blue into Field Aqua',colors:['blue','aqua'],clicked:['blue','aqua'],offset:[.11,-.08],scale:1.3,rose:0,pool:.46,rim:.20,softness:.18,glowRadius:2.15,glow:1.20},
  {id:'03',name:'Mint / Green',description:'Ion Mint into Halo Green',colors:['mint','green'],clicked:['mint','green'],offset:[.11,-.08],scale:1.3,rose:0,pool:.46,rim:.20,softness:.18,glowRadius:2.15,glow:1.20},
  {id:'04',name:'Blue / Mint / Rose',description:'Orbit Blue and Ion Mint · rose reflection ≤7%',colors:['blue','mint'],clicked:['blue','mint'],offset:[.11,-.08],scale:1.3,rose:.07,pool:.46,rim:.20,softness:.18,glowRadius:2.15,glow:1.20},
]);
export const ORB_SETS = Object.freeze([
  {id:'reference',name:'Reference lights',ids:['01','02','03','04']},
]);
export function resolveOrbCycle(value){
  try{if(typeof value==='string')value=JSON.parse(value);}catch{value=null;}
  const ids=[...new Set((Array.isArray(value)?value:[]).filter(id=>ORB_OPTIONS.some(option=>option.id===id)))];
  return ids.length>=3?ids:ORB_OPTIONS.map(option=>option.id);
}
export function nextOrb(cycle,current){const ids=resolveOrbCycle(cycle);return ids[(ids.indexOf(current)+1)%ids.length];}
export function resolveOrb(id) { return ORB_OPTIONS.find(option => option.id === id) || ORB_OPTIONS[0]; }
export function rotationAngle(seconds) { return seconds * Math.PI * 2 / ORB_PERIOD; }
export function breathingScale(seconds, amount = ORB_BREATH_AMOUNT) { return 1 + amount * Math.sin(seconds * Math.PI * 2 / ORB_BREATH_PERIOD); }
const rgb = hex => [1,3,5].map(n => parseInt(hex.slice(n,n+2),16));
const mix = (a,b,t) => a.map((v,i)=>v+(b[i]-v)*t);
const cache = new Map();
const clamp = t => Math.max(0,Math.min(1,t));

// Distance from an offset light center produces curved, circular contours.
// The Closing animation's spherical backlight informs the shaded interior;
// the circular mode uses radius, never angular sectors or a conic gradient.
export function orbColorWeights(option,clicked,nx,ny){
  if(option.pool){
    // Overlapping rounded light volumes keep the inner color continuous.
    // Both rotate with the sphere; clicked and hover share one material.
    const first=Math.exp(-((nx+.18)**2+(ny+.22)**2)/.46);
    const second=Math.exp(-((nx-.20)**2+(ny-.20)**2)/.35);
    const blend=.12+.52*second/(first+second+.05);
    const rose=Math.min(.08,option.rose)*Math.exp(-((nx+.22)**2+(ny-.18)**2)/.24);
    return {[option.colors[0]]:(1-blend)*(1-rose),[option.colors[1]]:blend*(1-rose),rose};
  }
  const [ox,oy]=clicked?[-option.offset[0],option.offset[1]*.78]:option.offset;
  const prototype=Boolean(option.pool);
  const t=clamp(Math.hypot(nx-ox,ny-oy)/(prototype?1.3:option.scale))**(prototype?1.65:3),q=1-t;
  const colors=clicked?option.clicked:option.colors;
  // A Bezier color ramp has no stop-by-stop plateaus or colored ring bands.
  const weights={};
  const blend=colors.length===4?[q**3,3*t*q*q,3*t*t*q,t**3]:[q*q,2*t*q,t*t];
  colors.forEach((name,index)=>{weights[name]=(weights[name]||0)+blend[index];});
  // A small rounded rose reflection is at most 8% at any pixel. It never
  // replaces a main hue or occupies a whole color stop, even after clicking.
  const rose=Math.min(.08,option.rose+(clicked ? .02 : 0))*Math.exp(-((nx-.66)**2+(ny+.12)**2)/.19);
  for(const name of Object.keys(weights))weights[name]*=1-rose;
  weights.rose=rose;
  return weights;
}
export function orbMaterial(option, clicked=false) {
  const palette=Object.fromEntries(Object.entries(C).map(([name,hex])=>[name,rgb(hex)]));
  return (nx,ny)=>{
    const r=Math.hypot(nx,ny);
    if(r>=1)return [0,0,0,0];
    const weights=orbColorWeights(option,clicked,nx,ny);
    const color=[0,1,2].map(channel=>Object.entries(weights).reduce((sum,[name,weight])=>sum+palette[name][channel]*weight,0));
    if(option.pool){
      // The user's reference: a broad cyan pool fading continuously into
      // the luminous white body. The white annulus is part of this radial
      // material, never a separate contour stroke or a central white pin.
      const [ox,oy]=option.offset;
      const pool=Math.exp(-((nx-ox)**2+(ny-oy)**2)/(option.pool**2));
      const lit=mix([253,255,254],color,pool*.85);
      const feather=clamp((r-(1-option.softness))/option.softness),alpha=1-feather*feather*(3-2*feather);
      return [...lit,alpha*255];
    }
    const core=Math.exp(-((nx+.04)**2+(ny+.16)**2)/.22);
    const below=(.5+.5*ny)**2;
    const backlight=clamp(.22+.53*r*r+.50*below-.26*core);
    let lit=color.map(value=>value*(.97+.04*backlight));
    lit=mix(lit,[247,255,254],option.white+backlight*backlight*.075);
    // A feathered subpixel edge, rather than a thick white outline.
    const edge=Math.exp(-(((r-.993)/.014)**2));
    lit=mix(lit,[246,255,254],edge*.24);
    return [...lit,Math.min(1,(1-r)*160)*255];
  };
}

function textures(option, clicked) {
  if(option.pool&&clicked)return textures(option,false);
  const key = option.id + clicked;
  if (cache.has(key)) return cache.get(key);
  const colors = (clicked ? option.clicked : option.colors).map(name=>rgb(C[name]));
  const surface = document.createElement('canvas'),size=option.pool?512:256; surface.width=surface.height=size;
  const paint = surface.getContext('2d'), pixels=paint.createImageData(size,size);
  const sample=orbMaterial(option,clicked);
  for(let y=0;y<size;y++) for(let x=0;x<size;x++) {
    pixels.data.set(sample((x+.5-size*.5)/(size*.5-1),(y+.5-size*.5)/(size*.5-1)),(y*size+x)*4);
  }
  paint.putImageData(pixels,0,0);
  const glow=document.createElement('canvas');glow.width=glow.height=option.pool?1024:384;
  if(option.pool){
    const size=glow.width,half=size*.5,light=glow.getContext('2d'),pixels=light.createImageData(size,size);
    const tints=[[252,255,254],mix(colors[0],[252,255,254],.48),mix(colors[1],[252,255,254],.48),mix(rgb(C.blue),[252,255,254],.30)];
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const nx=(x+.5-half)/(half-1)*option.glowRadius,ny=(y+.5-half)/(half-1)*option.glowRadius,r=Math.hypot(nx,ny);
      const fade=clamp((option.glowRadius-r)/.65),feather=fade*fade*(3-2*fade),spread=option.glowRadius/2.15;
      const weights=[Math.min(.98,.78*option.glow)*Math.exp(-(r*r/(.70*spread))),.20*option.glow*Math.exp(-((nx+.18)**2+(ny-.24)**2)/(1.1*spread)),.14*option.glow*Math.exp(-((nx-.24)**2+(ny-.18)**2)/(1.0*spread)),.09*option.glow*Math.exp(-(r*r/(1.8*spread)))];
      const total=weights.reduce((sum,value)=>sum+value,0),alpha=(1-weights.reduce((remain,value)=>remain*(1-value),1))*feather;
      const tint=[0,1,2].map(channel=>weights.reduce((sum,weight,i)=>sum+weight*tints[i][channel],0)/Math.max(.0001,total));
      // Sub-byte quantization dithering prevents concentric 8-bit contours.
      const dither=(((x*17+y*29)&63)/63-.5);
      pixels.data.set([...tint,clamp(alpha+dither/255)*255],(y*size+x)*4);
    }
    light.putImageData(pixels,0,0);
    const result={surface,glow,lighting:document.createElement('canvas')};result.lighting.width=result.lighting.height=1;
    cache.set(key,result);return result;
  }
  const light=glow.getContext('2d'), g=light.createRadialGradient(192,192,0,192,192,191);
  const accent=mix(colors[1],[242,248,255],.48),gain=.8+.2*option.glow;
  g.addColorStop(0,`rgba(${accent.join(',')},${.42*gain})`);
  g.addColorStop(.30,`rgba(${accent.join(',')},${.28*gain})`);
  g.addColorStop(.42,`rgba(${accent.join(',')},${.21*gain})`);
  g.addColorStop(.55,`rgba(${accent.join(',')},${.055*gain})`);
  g.addColorStop(.75,`rgba(${accent.join(',')},0)`);
  g.addColorStop(1,`rgba(${accent.join(',')},0)`);
  light.fillStyle=g;light.fillRect(0,0,384,384);
  const fringe=light.createRadialGradient(192,192,0,192,192,191);
  fringe.addColorStop(0,'rgba(246,255,254,0)');fringe.addColorStop(.335,'rgba(246,255,254,0)');
  fringe.addColorStop(.375,'rgba(246,255,254,.15)');fringe.addColorStop(.40,'rgba(246,255,254,.045)');
  fringe.addColorStop(.435,'rgba(246,255,254,0)');fringe.addColorStop(1,'rgba(246,255,254,0)');
  light.fillStyle=fringe;light.fillRect(0,0,384,384);
  const lighting=document.createElement('canvas');lighting.width=lighting.height=256;
  const shade=lighting.getContext('2d');shade.beginPath();shade.arc(128,128,127,0,Math.PI*2);shade.clip();
  const highlight=shade.createRadialGradient(110,68,0,110,68,110);
  highlight.addColorStop(0,'rgba(255,255,255,.045)');highlight.addColorStop(.40,'rgba(255,255,255,.02)');highlight.addColorStop(1,'rgba(255,255,255,0)');
  shade.fillStyle=highlight;shade.fillRect(0,0,256,256);
  const result={surface,glow,lighting};cache.set(key,result);return result;
}
// Prepare each reusable light before pointer interaction, avoiding a texture
// build inside the first hover or click frame.
export function warmOrbTextures(){for(const option of ORB_OPTIONS)textures(option,false);}
let blendSurface,blendPaint;
function blendedSurface(hover,pressed,weight){
  if(weight<=.001)return hover.surface;
  if(weight>=.999)return pressed.surface;
  if(!blendSurface){blendSurface=document.createElement('canvas');blendSurface.width=blendSurface.height=256;blendPaint=blendSurface.getContext('2d');}
  blendPaint.clearRect(0,0,256,256);
  blendPaint.globalCompositeOperation='source-over';blendPaint.globalAlpha=1-weight;blendPaint.drawImage(hover.surface,0,0);
  blendPaint.globalCompositeOperation='lighter';blendPaint.globalAlpha=weight;blendPaint.drawImage(pressed.surface,0,0);
  blendPaint.globalAlpha=1;blendPaint.globalCompositeOperation='source-over';
  return blendSurface;
}
export function paintOrb(ctx,{x,y,radius,seconds=0,option='01',clicked=0,opacity=1,brightness=1}) {
  if(opacity<=.0001) return;
  // Body and feathered glow breathe together, independently of travel and
  // the gravity field. Use the existing clock so Pause freezes the pulse.
  const baseRadius = radius;
  radius *= breathingScale(seconds);
  const spec=resolveOrb(option), angle=rotationAngle(seconds), mixState=Math.max(0,Math.min(1,clicked));
  ctx.save();ctx.translate(x,y);if(spec.pool)ctx.rotate(angle);if(brightness>1.001)ctx.filter=`brightness(${brightness})`;
  for(const [state,weight] of [[false,1-mixState],[true,mixState]]) {
    if(weight<.001) continue;
    const texture=textures(spec,state), extent=baseRadius*breathingScale(seconds,ORB_GLOW_BREATH_AMOUNT)*(spec.glowRadius||2.65);
    ctx.globalAlpha=opacity*weight;ctx.drawImage(texture.glow,-extent,-extent,extent*2,extent*2);
  }
  ctx.save();if(!spec.pool)ctx.rotate(angle);
  const hover=textures(spec,false), pressed=textures(spec,true);
  ctx.globalAlpha=opacity;ctx.drawImage(blendedSurface(hover,pressed,mixState),-radius,-radius,radius*2,radius*2);
  ctx.restore();ctx.globalAlpha=opacity;ctx.drawImage(hover.lighting,-radius,-radius,radius*2,radius*2);
  ctx.restore();
}
