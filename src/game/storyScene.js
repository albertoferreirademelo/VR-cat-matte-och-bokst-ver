import * as THREE from 'three';
import { Kitten, kittenLook } from './kittens.js';
import { toon } from './toon.js';
import { puffy } from './shapes.js';
import { ease } from './motion.js';
import { sfx } from '../audio.js';

// The things in a story question (see src/game/stories.js), shown above the story board:
// fish, balls of yarn or wheels, in the groups the story tells. After the answer they act it
// out: more join, some leave, groups come together, or they are dealt out to kittens or put
// into bowls and cars a few at a time. Everything lies in this group's x-y plane, which the
// adventure turns to face the player; (0, 0) is the middle of a WIDTH × HEIGHT space, shown ZOOM times bigger.

const WIDTH = 1.1; // the space, before it is blown up by ZOOM
const HEIGHT = 0.4;
const ZOOM = 1.25;
const CELL = 0.085; // room for one thing
const MAX = 20;
const KITTEN = 0.2;
const CAR_BODY = 0.62; // a car body's height, as a share of its group's height
const COLORS = { fish: ['#ff9f1c', '#4cc9f0', '#f15bb5', '#2ec4b6', '#9b5de5'], yarn: ['#ff6fae', '#9b5de5', '#4cc9f0', '#80b918', '#ff9f1c'], wheel: ['#3d3b4f'] };
const TRAYS = { basket: '#e9b872', bowl: '#a0e7ff' };

function fishGeometry() {
  const body = new THREE.Shape().absellipse(0, 0, 0.03, 0.019, 0, Math.PI * 2);
  const tail = new THREE.Shape();
  tail.moveTo(-0.024, 0);
  tail.lineTo(-0.046, 0.017);
  tail.lineTo(-0.046, -0.017);
  tail.closePath();
  return puffy([body, tail], 0.006, 0.005);
}

// Each kind of thing is a body and a detail drawn with the same instance matrices.
function makeThing(body, detail, detailColor, outline) {
  const meshes = [new THREE.InstancedMesh(body, toon(0xffffff), MAX), new THREE.InstancedMesh(detail, toon(detailColor), MAX)];
  for (const mesh of meshes) {
    mesh.frustumCulled = false;
    mesh.count = 0;
  }
  meshes[0].setColorAt(0, new THREE.Color());
  if (outline) meshes[0].material.emissive = new THREE.Color(outline);
  return meshes;
}

const eye = new THREE.SphereGeometry(0.0055, 8, 6).translate(0.017, 0.005, 0.011);
const thread = new THREE.TorusGeometry(0.024, 0.0035, 6, 20).rotateY(1.1).rotateZ(0.6);
const hub = new THREE.CylinderGeometry(0.011, 0.011, 0.03, 12).rotateX(Math.PI / 2);

// Cells for `count` things in rows of `columns`, around (0, 0).
function cluster(count, columns) {
  const rows = Math.ceil(count / columns);
  return Array.from({ length: count }, (_, i) => new THREE.Vector3(((i % columns) - (Math.min(count, columns) - 1) / 2) * CELL, ((rows - 1) / 2 - Math.floor(i / columns)) * CELL, 0));
}

// Rows of ten with a gap after five, like ten-frames, so 12 shows as 10 and 2.
function frame(count) {
  const columns = Math.min(count, 10);
  const width = columns + (columns > 5 ? 0.5 : 0);
  const rows = Math.ceil(count / 10);
  return Array.from({ length: count }, (_, i) => {
    const column = i % 10;
    return new THREE.Vector3((column + (column >= 5 ? 0.5 : 0) - (width - 1) / 2) * CELL, ((rows - 1) / 2 - Math.floor(i / 10)) * CELL, 0);
  });
}

// A small group packed nearly square: 4 as 2 × 2, 6 as 3 × 2, 10 as 5 × 2.
const columnsFor = (count) => (count <= 3 ? count : count === 4 ? 2 : count <= 6 ? 3 : count <= 8 ? 4 : 5);
const sizeOf = (count) => {
  const columns = columnsFor(count);
  return { width: columns * CELL, height: Math.ceil(count / columns) * CELL };
};
const at = (x, y, z = 0) => new THREE.Vector3(x, y, z);
// A group held by a kitten standing at `feet`: in front of its tummy, below its face.
const heldBy = (feet, count) => {
  const rows = Math.ceil(count / columnsFor(count));
  return at(feet.x, feet.y + 0.095 - ((rows - 1) / 2) * CELL, 0.05);
};
const Z = new THREE.Vector3(0, 0, 1);

function roundedRect(width, height, radius) {
  const [x, y] = [-width / 2, -height / 2];
  const shape = new THREE.Shape();
  shape.moveTo(x + radius, y);
  shape.lineTo(x + width - radius, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + radius);
  shape.lineTo(x + width, y + height - radius);
  shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  shape.lineTo(x + radius, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - radius);
  shape.lineTo(x, y + radius);
  shape.quadraticCurveTo(x, y, x + radius, y);
  return shape;
}
const offset = (cells, by) => cells.map((cell) => cell.clone().add(by));

function arc(from, to, lift) {
  const point = new THREE.Vector3();
  return (p) => point.lerpVectors(from, to, p).setY(point.y + Math.sin(p * Math.PI) * lift);
}

export class StoryScene extends THREE.Group {
  constructor(tweens) {
    super();
    this.tweens = tweens;
    this.visible = false;
    this.content = new THREE.Group();
    this.add(this.content);
    this.things = {
      fish: makeThing(fishGeometry(), eye, 0x2b1b3d),
      yarn: makeThing(new THREE.SphereGeometry(0.031, 16, 12), thread, 0xffffff),
      wheel: makeThing(new THREE.TorusGeometry(0.025, 0.012, 10, 20), hub, 0xd9d9e8),
    };
    for (const meshes of Object.values(this.things)) this.content.add(...meshes);
    this.matrix = new THREE.Matrix4();
    this.turn = new THREE.Quaternion();
    this.spot = new THREE.Vector3();
    this.size3 = new THREE.Vector3();
    this.holders = [];
    this.kittens = [];
    this.items = [];
    this.story = null;
  }

  // Lays out a new story and pops its things in.
  show(story) {
    this.clear();
    this.story = story;
    this.visible = true;
    this.scale.setScalar(1);
    const colors = COLORS[story.thing];
    const plan = this.layOut(story);
    this.items = plan.start.map((position, i) => ({
      position: position.clone(),
      size: 0,
      color: new THREE.Color(colors[(plan.colorOf?.(i) ?? 0) % colors.length]),
      phase: Math.random() * 6,
    }));
    this.layout = plan;
    this.content.scale.setScalar(ZOOM * Math.min(1, WIDTH / plan.width));
    this.active = this.things[story.thing];
    this.items.forEach((item, i) => this.tweens.add(0.3, (p) => (item.size = p), { delay: 0.25 + i * 0.03, ease: ease.outBack }));
    for (const holder of this.holders) this.grow(holder, 0.2);
  }

  // Where everything is at the start and the end, worked out from the story's groups.
  layOut(story) {
    const { kind, start, end, holder } = story;
    const total = start.reduce((sum, n) => sum + n, 0);
    if (kind === 'add') {
      const [a, b] = start;
      const left = Math.min(a, 5) * CELL;
      const right = Math.min(b, 5) * CELL;
      const gap = CELL * 1.5;
      const x0 = -(left + gap + right) / 2;
      const first = offset(cluster(a, 5), at(x0 + left / 2, 0));
      const second = offset(cluster(b, 5), at(x0 + left + gap + right / 2, 0));
      return { start: [...first, ...second], end: frame(end[0]), width: left + gap + right, colorOf: (i) => (i < a ? 0 : 1) };
    }
    if (kind === 'sub') return { start: frame(total), end: frame(total), width: 11 * CELL, colorOf: () => 4 };
    if (kind === 'mul') {
      const size = sizeOf(start[0]);
      const step = Math.max(size.width, KITTEN) + CELL;
      const cells = [];
      start.forEach((count, g) => {
        const x = (g - (start.length - 1) / 2) * step;
        const feet = at(x, -HEIGHT / 2 + 0.02);
        const middle = holder === 'kitten' ? heldBy(feet, count) : at(x, 0.02, 0.04);
        cells.push(...offset(cluster(count, columnsFor(count)), middle));
        if (holder === 'kitten') this.addKitten(feet);
        else this.addTray(holder, middle, size);
      });
      return { start: cells, end: frame(end[0]), width: step * start.length, colorOf: (i) => Math.floor(i / start[0]) };
    }
    // Sharing and grouping start from one heap at the top.
    const heap = frame(total);
    const top = HEIGHT / 2 - (Math.ceil(total / 10) * CELL) / 2;
    // A car is long and low, with its wheels in a row along the bottom (see addTray).
    const car = story.holder === 'car';
    const size = car ? { width: end[0] * CELL, height: CELL * 2 } : sizeOf(end[0]);
    const step = Math.max(size.width, KITTEN) + CELL;
    const floor = -HEIGHT / 2 + 0.02;
    const feet = end.map((_, g) => at((g - (end.length - 1) / 2) * step, floor));
    const spots = feet.map((spot) => (kind === 'share' ? heldBy(spot, end[0]) : at(spot.x, floor + size.height / 2, 0.05)));
    const cells = end.map((count, g) =>
      car ? offset(cluster(count, count), at(spots[g].x, spots[g].y - CAR_BODY * size.height * 0.5, 0.05)) : offset(cluster(count, columnsFor(count)), spots[g]),
    );
    // Each kitten gets one in turn; bowls and cars are filled one after the other.
    const order = kind === 'share' ? (i) => cells[i % end.length][Math.floor(i / end.length)] : (i) => cells[Math.floor(i / end[0])][i % end[0]];
    if (kind === 'share') feet.forEach((spot) => this.addKitten(spot));
    return {
      start: offset(heap, at(0, top)),
      end: Array.from({ length: total }, (_, i) => order(i)),
      spots,
      size,
      width: Math.max(11 * CELL, step * end.length),
    };
  }

  addKitten(position) {
    const kitten = new Kitten(kittenLook(), KITTEN);
    kitten.position.copy(position);
    kitten.scale.setScalar(0.0001);
    this.content.add(kitten);
    this.kittens.push(kitten);
    this.holders.push(kitten);
    return kitten;
  }

  // A soft rounded tray behind a group: a basket or a bowl. A car is a box with the wheels on.
  addTray(kind, position, size) {
    let mesh;
    if (kind === 'car') {
      mesh = new THREE.Mesh(new THREE.BoxGeometry(size.width + 0.05, size.height * CAR_BODY, 0.05), toon('#ef476f'));
      const window = new THREE.Mesh(new THREE.BoxGeometry(size.width * 0.55, size.height * 0.4, 0.04), toon('#bde0fe'));
      window.position.set(0, size.height * 0.42, -0.01);
      mesh.add(window);
    } else {
      mesh = new THREE.Mesh(puffy(roundedRect(size.width + 0.04, size.height + 0.04, 0.035), 0.008, 0.006), toon(TRAYS[kind]));
    }
    mesh.position.copy(position).setZ(position.z - 0.03);
    mesh.scale.setScalar(0.0001);
    this.content.add(mesh);
    this.holders.push(mesh);
    return mesh;
  }

  grow(object, delay) {
    this.tweens.add(0.35, (p) => object.scale.setScalar(Math.max(0.0001, p)), { delay, ease: ease.outBack });
  }

  // Flies thing `i` to `to` along a little arc.
  fly(i, to, { delay = 0, duration = 0.4, lift = 0.08, done } = {}) {
    const item = this.items[i];
    let path = null;
    this.tweens.add(
      duration,
      (p) => {
        path ??= arc(item.position.clone(), to.clone(), lift);
        item.position.copy(path(p));
      },
      { delay, ease: ease.inOutQuad, done },
    );
  }

  // Acts out what the story means. Returns how many seconds that takes.
  play() {
    const { kind, start, end } = this.story;
    const plan = this.layout;
    const tick = (step) => () => sfx.tick(step);
    if (kind === 'add') {
      // The first group slides into the frame, then the new ones join one at a time: 8, 9, 10…
      const [a] = start;
      for (let i = 0; i < a; i++) this.fly(i, plan.end[i], { duration: 0.35, lift: 0 });
      for (let i = a; i < this.items.length; i++) {
        this.fly(i, plan.end[i], { delay: 0.45 + (i - a) * 0.22, duration: 0.35, done: tick(i) });
      }
      return 0.8 + (this.items.length - a) * 0.22;
    }
    if (kind === 'sub') {
      // The last ones swim away, one at a time.
      const left = end[0];
      const away = at(WIDTH / 2 + 0.25, HEIGHT / 2 + 0.15, 0.1);
      for (let i = this.items.length - 1, k = 0; i >= left; i--, k++) {
        const item = this.items[i];
        this.fly(i, away, { delay: 0.2 + k * 0.22, duration: 0.5, lift: 0.1, done: tick(this.items.length - k) });
        this.tweens.add(0.5, (p) => (item.size = 1 - p), { delay: 0.2 + k * 0.22 });
      }
      for (let i = 0; i < left; i++) this.tweens.add(0.3, (p) => (this.items[i].hop = Math.sin(p * Math.PI) * 0.03), { delay: 0.5 + (this.items.length - left) * 0.22 });
      return 0.9 + (this.items.length - left) * 0.22;
    }
    if (kind === 'mul') {
      // Each group hops in turn, then they all come together.
      const per = start[0];
      start.forEach((_, g) => {
        for (let k = 0; k < per; k++) {
          const item = this.items[g * per + k];
          this.tweens.add(0.3, (p) => (item.hop = Math.sin(p * Math.PI) * 0.04), { delay: 0.2 + g * 0.45 });
        }
        this.tweens.after(0.2 + g * 0.45, tick(g * 3));
      });
      const gather = 0.3 + start.length * 0.45;
      this.items.forEach((_, i) => this.fly(i, plan.end[i], { delay: gather + i * 0.03, duration: 0.45, lift: 0.06 }));
      for (const holder of this.holders) this.tweens.add(0.3, (p) => holder.scale.setScalar(Math.max(0.0001, 1 - p)), { delay: gather });
      this.tweens.after(gather + 0.5, () => sfx.ding());
      return gather + 0.6 + this.items.length * 0.03;
    }
    if (kind === 'share') {
      // Dealt out like cards: one to each kitten, round and round.
      const gap = Math.min(0.16, 2.6 / this.items.length);
      this.items.forEach((_, i) => {
        const kitten = this.kittens[i % end.length];
        this.fly(i, plan.end[i], { delay: 0.2 + i * gap, duration: 0.38, lift: 0.1, done: () => {
          kitten.hop(0.04, 'happy');
          sfx.tick(Math.floor(i / end.length) * 3);
        } });
      });
      this.tweens.after(0.8 + this.items.length * gap, () => this.kittens.forEach((kitten) => kitten.hop(0.07, 'star')));
      return 1 + this.items.length * gap;
    }
    // Grouping: a bowl (or a car) at a time, filled with `size` things.
    const per = end[0];
    const each = 0.25 + per * 0.06 + 0.25;
    end.forEach((_, g) => {
      const t = 0.2 + g * each;
      const holder = this.addTray(this.story.holder, plan.spots[g], plan.size);
      this.grow(holder, t);
      for (let k = 0; k < per; k++) this.fly(g * per + k, plan.end[g * per + k], { delay: t + 0.2 + k * 0.06, duration: 0.3 });
      this.tweens.after(t + 0.5 + per * 0.06, tick(g * 4));
    });
    return 0.4 + end.length * each;
  }

  // Shrinks away; the next show starts fresh.
  hide() {
    const story = this.story;
    if (!story) return;
    const mine = () => this.story === story;
    this.tweens.add(0.25, (p) => mine() && this.scale.setScalar(Math.max(0.0001, 1 - p)), { done: () => mine() && this.clear() });
  }

  clear() {
    for (const holder of this.holders) {
      holder.removeFromParent();
      if (holder.isMesh) {
        holder.traverse((part) => {
          part.geometry.dispose();
          part.material.dispose();
        });
      }
    }
    this.holders = [];
    this.kittens = [];
    this.items = [];
    this.story = null;
    this.visible = false;
    for (const meshes of Object.values(this.things)) for (const mesh of meshes) mesh.count = 0;
  }

  update(dt, t) {
    if (!this.visible) return;
    for (const kitten of this.kittens) kitten.update(dt, t);
    if (!this.active) return;
    const [body, detail] = this.active;
    const fish = this.story?.thing === 'fish';
    this.items.forEach((item, i) => {
      this.turn.setFromAxisAngle(Z, fish ? Math.sin(t * 5 + item.phase) * 0.18 : 0);
      this.spot.copy(item.position);
      this.spot.y += (item.hop ?? 0) + Math.sin(t * 2 + item.phase) * 0.004;
      this.size3.setScalar(Math.max(0.0001, item.size));
      this.matrix.compose(this.spot, this.turn, this.size3);
      body.setMatrixAt(i, this.matrix);
      detail.setMatrixAt(i, this.matrix);
      body.setColorAt(i, item.color);
    });
    body.count = detail.count = this.items.length;
    body.instanceMatrix.needsUpdate = detail.instanceMatrix.needsUpdate = true;
    if (body.instanceColor) body.instanceColor.needsUpdate = true;
  }
}
