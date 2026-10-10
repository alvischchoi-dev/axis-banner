// Only sustained rendering work lowers quality; physical clocks never change.
export class RenderQuality {
  constructor() { this.level = 0; this.pixelCap = 1.5; this.rayCap = Infinity; this.cost = 0; this.overload = 0; }
  observe(milliseconds, dt, ratio) {
    this.cost += (milliseconds - this.cost) * (1 - Math.exp(-dt / .15));
    this.overload = this.cost > 20 ? this.overload + dt : 0;
    if (this.overload < 2 || this.level >= 4) return false;
    this.overload = 0;
    this.level++;
    if (this.level <= 2) this.pixelCap = Math.max(.5, ratio * .8);
    else this.rayCap = this.level === 3 ? 900 : 600;
    return true;
  }
}
