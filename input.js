// No pointer capture or preventDefault: scrolling and zooming belong to the browser.
export class TapGesture {
  constructor() { this.pointers = new Set(); this.pending = null; }
  down(event) {
    this.pointers.add(event.pointerId);
    if (this.pointers.size !== 1 || !event.isPrimary) { this.pending = null; return; }
    this.pending = { id: event.pointerId, x: event.clientX, y: event.clientY, time: event.timeStamp };
  }
  move(event) {
    if (this.pending?.id === event.pointerId && Math.hypot(event.clientX - this.pending.x, event.clientY - this.pending.y) > 10) this.pending = null;
  }
  up(event) {
    const tap = this.pending;
    const valid = tap && tap.id === event.pointerId && this.pointers.size === 1
      && event.timeStamp - tap.time <= 350
      && Math.hypot(event.clientX - tap.x, event.clientY - tap.y) <= 10;
    this.pointers.delete(event.pointerId); this.pending = null;
    return !!valid;
  }
  cancel(id) { this.pending = null; if (id !== undefined) this.pointers.delete(id); }
  reset() { this.pending = null; this.pointers.clear(); }
}
