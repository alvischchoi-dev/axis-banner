import { ORB_OPTIONS, ORB_KEY, ORB_SELECTION_KEY, ORB_PERIOD, ORB_BREATH_PERIOD, breathingScale, resolveOrb, paintOrb } from './orbs.js?revision=2517ad9ee71f';
const grid=document.querySelector('#options'),reduced=matchMedia('(prefers-reduced-motion: reduce)');
let selected='01';try{selected=resolveOrb(localStorage.getItem(ORB_KEY)).id;}catch{}
let paused=reduced.matches,previous=0,seconds=0;
const views=ORB_OPTIONS.map(option=>{
  const card=document.createElement('article');card.className='option';card.dataset.option=option.id;
  card.innerHTML=`<div class="option-top"><h2><span class="number">${option.id}</span>${option.name}</h2><button class="select" aria-label="Try ${option.name}" aria-pressed="false">Try this</button></div><p class="variant-note">${option.description}</p><canvas role="img" aria-label="${option.name}: soft circular inner gradient inside the Reference light's luminous white body and close glow"></canvas>`;
  grid.append(card);card.querySelector('button').addEventListener('click',()=>{selected=option.id;try{localStorage.setItem(ORB_SELECTION_KEY,JSON.stringify(ORB_OPTIONS.map(item=>item.id)));localStorage.setItem(ORB_KEY,selected);}catch{}sync();});
  return {option,card,canvas:card.querySelector('canvas'),ctx:card.querySelector('canvas').getContext('2d')};
});
function sync(){for(const view of views){const chosen=view.option.id===selected,button=view.card.querySelector('button');view.card.classList.toggle('selected',chosen);button.setAttribute('aria-pressed',String(chosen));button.textContent=chosen?'Selected':'Try this';}document.querySelector('#choice').textContent=`${selected} ${resolveOrb(selected).name} selected`;document.querySelector('#try').href=`./?orb=${selected}`;const button=document.querySelector('#pause');button.textContent=paused?'Resume motion':'Pause motion';button.setAttribute('aria-pressed',String(paused));}
function paint(){for(const view of views){const {ctx,width,height,option}=view;ctx.clearRect(0,0,width,height);paintOrb(ctx,{x:width*.5,y:height*.5,radius:Math.min(95,height*.158,width*.145),seconds,option:option.id});view.canvas.dataset.rotation=(seconds*360/ORB_PERIOD).toFixed(3);view.canvas.dataset.period=String(ORB_PERIOD);view.canvas.dataset.breathScale=breathingScale(seconds).toFixed(4);view.canvas.dataset.breathPeriod=String(ORB_BREATH_PERIOD);}}
function resize(){for(const view of views){const bounds=view.canvas.getBoundingClientRect(),ratio=Math.min(2,devicePixelRatio||1);view.width=bounds.width;view.height=bounds.height;view.canvas.width=Math.round(bounds.width*ratio);view.canvas.height=Math.round(bounds.height*ratio);view.ctx.setTransform(ratio,0,0,ratio,0,0);}paint();}
document.querySelector('#pause').addEventListener('click',()=>{paused=!paused;sync();});
reduced.addEventListener('change',event=>{paused=event.matches;sync();});
window.addEventListener('storage',event=>{if(event.key===ORB_KEY){selected=resolveOrb(event.newValue).id;sync();}});
new ResizeObserver(resize).observe(grid);sync();resize();
function frame(now){requestAnimationFrame(frame);if(!previous)previous=now;const dt=(now-previous)/1000;previous=now;if(!paused&&!document.hidden){seconds+=dt;paint();}}
requestAnimationFrame(frame);
