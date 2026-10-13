export const ease = {
  outCubic: (x) => 1 - (1 - x) ** 3,
  inOutQuad: (x) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2),
  outBack: (x) => 1 + 2.70158 * (x - 1) ** 3 + 1.70158 * (x - 1) ** 2,
};

// A value that bounces toward its target. Used for anything that should pop.
export class Spring {
  constructor(value = 0, stiffness = 260, damping = 16) {
    this.value = value;
    this.target = value;
    this.velocity = 0;
    this.stiffness = stiffness;
    this.damping = damping;
  }

  update(dt) {
    let left = dt;
    while (left > 0) {
      const step = Math.min(left, 1 / 120);
      this.velocity += ((this.target - this.value) * this.stiffness - this.velocity * this.damping) * step;
      this.value += this.velocity * step;
      left -= step;
    }
    return this.value;
  }
}

// Timed animations and delayed calls that are all dropped when a round stops.
export class Tweens {
  constructor() {
    this.items = [];
  }

  add(duration, update, { ease: curve = (x) => x, delay = 0, done } = {}) {
    this.items.push({ time: -delay, duration, update, curve, done, finished: false });
  }

  after(delay, done) {
    this.add(0, () => {}, { delay, done });
  }

  update(dt) {
    for (const item of this.items) {
      item.time += dt;
      if (item.time < 0) continue;
      const progress = item.duration > 0 ? Math.min(1, item.time / item.duration) : 1;
      item.update(item.curve(progress));
      if (progress === 1) {
        item.finished = true;
        item.done?.();
      }
    }
    this.items = this.items.filter((item) => !item.finished);
  }

  clear() {
    this.items = [];
  }
}
