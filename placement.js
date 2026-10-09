// A small click impulse affects nearby light, never the deposited source.
// It uses the filament's existing inertia and settles independently of tempo.
export function placementWave(age){return age<0?0:.0055*Math.exp(-3.8*age)*Math.sin(7*age);}
export class PlacementResponse{
  constructor(){this.reset();}
  reset(){this.items=[];}
  add(x,y){this.items.push({x,y,age:0,amplitude:0});if(this.items.length>8)this.items.shift();}
  update(dt){for(const item of this.items){item.age+=dt;item.amplitude=placementWave(item.age);}this.items=this.items.filter(item=>item.age<1.8);}
  apply(target,x,y){
    let dx=0,dy=0;
    for(const item of this.items){
      const ox=x-item.x,oy=y-item.y,d2=ox*ox+oy*oy;
      if(d2>.36)continue;
      const strength=item.amplitude*Math.exp(-d2/.04)/Math.sqrt(d2+.0025);
      dx+=ox*strength;dy+=oy*strength;
    }
    // Feather to zero at the fixed star and bound rapid repeated clicks.
    const center=Math.min(1,(x*x+y*y)/.04),limit=Math.max(1,Math.hypot(dx,dy)/.0035);
    target.x+=dx*center/limit;target.y+=dy*center/limit;
    return target;
  }
}
