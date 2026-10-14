import * as THREE from 'three';
import { toon } from '../game/toon.js';
import { FONT } from '../ui/board.js';
import { buildItem, disposeItem } from '../wardrobe/items.js';

const hitMaterial = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });

const TAG_STYLES = {
  price: { fill: '#fff3c4', border: '#ffb703', color: '#8a5a00' },
  goal: { fill: '#f3e8ff', border: '#9b5de5', color: '#4a1487' },
  worn: { fill: '#f15bb5', border: '#ffffff', color: '#ffffff' },
  fresh: { fill: '#ffb703', border: '#ffffff', color: '#ffffff' },
  label: { fill: '#ffffff', border: '#c7a6ff', color: '#3c096c' },
};

// A small rounded label: a price, a lock with progress, a tick, or a name.
export class Tag extends THREE.Mesh {
  constructor(width = 0.28, height = 0.085) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = Math.round((256 * height) / width);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    super(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: texture, transparent: true }));
    this.canvas = canvas;
    this.text = null;
  }

  show(text, style = 'label') {
    this.visible = Boolean(text);
    const key = `${style}/${text}`;
    if (!text || this.text === key) return;
    this.text = key;
    const { width, height } = this.canvas;
    const g = this.canvas.getContext('2d');
    const { fill, border, color } = TAG_STYLES[style];
    const line = height * 0.1;
    g.clearRect(0, 0, width, height);
    g.beginPath();
    g.roundRect(line / 2, line / 2, width - line, height - line, (height - line) / 2);
    g.fillStyle = fill;
    g.fill();
    g.lineWidth = line;
    g.strokeStyle = border;
    g.stroke();
    let size = height * 0.62;
    g.font = `700 ${size}px ${FONT}`;
    while (g.measureText(text).width > width - height * 0.6 && size > 10) {
      size -= 2;
      g.font = `700 ${size}px ${FONT}`;
    }
    g.fillStyle = color;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, width / 2, height / 2 + size * 0.06);
    this.material.map.needsUpdate = true;
  }
}

// One thing in the wardrobe: a model, a tag under it and an invisible, forgiving hit area.
// The room sets `onHit` on `hit` and calls `setState` when it changes.
export class Display extends THREE.Group {
  constructor(entry, model, size) {
    super();
    this.entry = entry;
    this.model = model;
    this.base = model.scale.x;
    this.tag = new Tag();
    this.tag.position.set(0, -0.07, 0.205);
    this.hit = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], 0.25), hitMaterial);
    this.hit.position.set(0, size[1] / 2 - 0.08, 0.12);
    this.hit.userData.owner = this;
    this.add(model, this.tag, this.hit);
    this.hovered = false;
    this.trying = false;
    this.grow = 1;
  }

  setState({ tag, style, trying }) {
    this.tag.show(tag, style);
    this.trying = trying;
  }

  update(dt, t) {
    const target = this.hovered || this.trying ? 1.15 : 1;
    this.grow += (target - this.grow) * Math.min(1, dt * 12);
    this.model.scale.setScalar(this.base * this.grow);
    this.model.rotation.y = this.trying ? Math.sin(t * 2.2) * 0.35 : this.model.rotation.y * 0.9;
  }

  dispose() {
    this.traverse((part) => {
      if (part === this.hit) return;
      part.geometry?.dispose();
      part.material?.map?.dispose();
    });
  }
}

// A thing to wear on a little mannequin head.
export function itemDisplay(entry) {
  const model = new THREE.Group();
  const stand = toon(0xffffff);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.02, 20), stand);
  foot.position.y = 0.01;
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.06, 10), stand);
  neck.position.y = 0.05;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 24, 16), toon(0xf3e8ff));
  head.position.y = 0.2;
  head.scale.x = 1.12;
  // Items place themselves on a head at their origin, so they ride on a holder at the head.
  const item = buildItem(entry.id);
  const holder = new THREE.Group();
  holder.position.y = 0.2;
  holder.add(item);
  model.add(foot, neck, head, holder);
  model.scale.setScalar(0.85);
  const display = new Display(entry, model, [0.34, 0.48]);
  display.disposeItem = () => disposeItem(item);
  return display;
}

// A pot of paint. `colors` is one colour, or two for eyes (dark, light).
export function potDisplay(entry, colors) {
  const model = new THREE.Group();
  const [dark, light] = Array.isArray(colors) ? colors : [colors, colors];
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.07, 20), toon(0xffffff));
  glass.position.y = 0.035;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.051, 0.048, 0.03, 20), toon(new THREE.Color(dark)));
  band.position.y = 0.03;
  const blob = new THREE.Mesh(new THREE.SphereGeometry(0.046, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), toon(new THREE.Color(light)));
  blob.position.y = 0.07;
  blob.scale.y = 0.55;
  model.add(glass, band, blob);
  if (colors == null) {
    // The pet's own colour: an empty pot with a sparkle.
    band.material.color.set(0xe3ccff);
    blob.material.color.set(0xffffff);
  }
  model.scale.setScalar(1.2);
  const display = new Display(entry, model, [0.19, 0.2]);
  display.tag.scale.setScalar(0.62);
  display.tag.position.y = -0.045;
  return display;
}

// A small statue of a creature, alive enough to blink.
export function figurineDisplay(entry, body) {
  const model = new THREE.Group();
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.19, 0.05, 28), toon(0xffd166));
  stand.position.y = 0.025;
  body.position.y = 0.05;
  model.add(stand, body);
  const display = new Display(entry, model, [0.42, 0.62]);
  display.body = body;
  return display;
}
