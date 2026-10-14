import * as THREE from 'three';
import { toon, addOutline } from '../game/toon.js';
import { FONT } from '../ui/board.js';

// The pet's room, built at real size around a player standing at the origin and looking
// along -z, so it works on a screen now and in a headset later. The floor is y = 0.
export const ROOM = { left: -3, right: 3, back: -3.3, front: 1.6, height: 2.8 };
export const WINDOW = { x: -2.3, width: 1, bottom: 0.95, top: 2.05 };

function canvasTexture(width, height, draw, repeat = [1, 1]) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d'), width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(...repeat);
  texture.anisotropy = 8;
  return texture;
}

// Lilac wallpaper with little stars and hearts, 0.5 m per tile.
const wallpaper = () =>
  canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#e9dcff';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#f4ecff';
    for (let x = 0; x < w; x += 64) g.fillRect(x, 0, 28, h);
    g.font = `48px ${FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#ffffff';
    g.fillText('★', 64, 64);
    g.fillStyle = '#ffc2e2';
    g.fillText('♥', 192, 192);
  });

// Warm wooden planks, 1 m per tile.
const planks = () =>
  canvasTexture(512, 512, (g, w, h) => {
    const colors = ['#e8b98a', '#e2b080', '#ecc296', '#deaa79'];
    const plank = h / 6;
    for (let i = 0; i < 6; i++) {
      g.fillStyle = colors[i % colors.length];
      g.fillRect(0, i * plank, w, plank);
      g.fillStyle = '#c99566';
      g.fillRect(0, i * plank, w, 3);
      g.fillRect(((i * 197) % w) + 40, i * plank, 3, plank);
    }
  });

const rugTexture = () =>
  canvasTexture(512, 512, (g, w) => {
    const middle = w / 2;
    for (const [radius, color] of [
      [256, '#ff9fcf'],
      [220, '#ffd6ec'],
      [190, '#ff9fcf'],
      [150, '#fff1f8'],
    ]) {
      g.beginPath();
      g.arc(middle, middle, radius, 0, Math.PI * 2);
      g.fillStyle = color;
      g.fill();
    }
    g.fillStyle = '#ffffff';
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2;
      g.beginPath();
      g.arc(middle + Math.cos(angle) * 205, middle + Math.sin(angle) * 205, 9, 0, Math.PI * 2);
      g.fill();
    }
  });

function box(width, height, depth, material, x, y, z, outline) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.set(x, y, z);
  if (outline) addOutline(mesh, outline, Math.min(width, height, depth) * 4, 0.006);
  return mesh;
}

// A wall in the plane x-y, `width` by ROOM.height, with an optional rectangular hole.
function wall(width, material, hole) {
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, 0);
  shape.lineTo(width / 2, 0);
  shape.lineTo(width / 2, ROOM.height);
  shape.lineTo(-width / 2, ROOM.height);
  shape.closePath();
  if (hole) {
    const path = new THREE.Path();
    path.moveTo(hole.left, hole.bottom);
    path.lineTo(hole.left, hole.top);
    path.lineTo(hole.right, hole.top);
    path.lineTo(hole.right, hole.bottom);
    path.closePath();
    shape.holes.push(path);
  }
  const geometry = new THREE.ShapeGeometry(shape);
  // ShapeGeometry's texture coordinates are in metres; the wallpaper repeats every half metre.
  const uv = geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2, uv.getY(i) * 2);
  return new THREE.Mesh(geometry, material);
}

function windowFrame() {
  const group = new THREE.Group();
  const white = toon(0xffffff);
  const { width, bottom, top } = WINDOW;
  const height = top - bottom;
  const middle = (top + bottom) / 2;
  const bar = 0.07;
  group.add(
    box(width + bar * 2, bar, 0.12, white, 0, top + bar / 2, 0),
    box(width + bar * 2, bar, 0.12, white, 0, bottom - bar / 2, 0),
    box(bar, height, 0.12, white, -width / 2 - bar / 2, middle, 0),
    box(bar, height, 0.12, white, width / 2 + bar / 2, middle, 0),
    box(0.035, height, 0.05, white, 0, middle, 0),
    box(width, 0.035, 0.05, white, 0, middle, 0),
    box(width + 0.3, 0.05, 0.22, white, 0, bottom - bar - 0.02, 0.08),
  );
  // Curtains in soft pleats, held open at the sides, under a rod.
  const cloth = toon(0xff9fcf);
  const pleat = new THREE.CylinderGeometry(0.045, 0.06, height + 0.35, 10);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const fold = new THREE.Mesh(pleat, cloth);
      fold.position.set(side * (width / 2 + 0.06 + i * 0.07), middle - 0.08, 0.12);
      fold.scale.z = 0.6;
      group.add(fold);
    }
    const tie = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.018, 8, 20), toon(0xffd166));
    tie.position.set(side * (width / 2 + 0.17), middle - 0.15, 0.13);
    tie.scale.set(1.1, 0.25, 1);
    group.add(tie);
  }
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, width + 0.9, 10), toon(0xffd166));
  rod.rotation.z = Math.PI / 2;
  rod.position.set(0, top + 0.18, 0.12);
  group.add(rod);
  group.position.set(WINDOW.x, 0, ROOM.back);
  return group;
}

// Little flags on a string, sagging between two points on the back wall.
function bunting(from, to) {
  const group = new THREE.Group();
  const colors = [0xff9fcf, 0xffd166, 0x8fd3ff, 0xc7a6ff, 0x9be3c3];
  const flag = new THREE.ConeGeometry(0.07, 0.16, 3);
  const count = 9;
  const points = [];
  for (let i = 0; i <= count; i++) {
    const p = i / count;
    const point = new THREE.Vector3().lerpVectors(from, to, p);
    point.y -= Math.sin(p * Math.PI) * 0.22;
    points.push(point);
    if (i < count) {
      const mesh = new THREE.Mesh(flag, toon(colors[i % colors.length]));
      mesh.rotation.z = Math.PI;
      mesh.scale.z = 0.25;
      const next = new THREE.Vector3().lerpVectors(from, to, (i + 0.5) / count);
      next.y -= Math.sin(((i + 0.5) / count) * Math.PI) * 0.22 + 0.09;
      mesh.position.copy(next);
      group.add(mesh);
    }
  }
  group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: 0x7d4fc9 })));
  return group;
}

function plant() {
  const group = new THREE.Group();
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.13, 0.3, 20), toon(0xffad5c));
  pot.position.y = 0.15;
  group.add(pot);
  const leaf = new THREE.SphereGeometry(1, 14, 10);
  const green = toon(0x52b788);
  for (const [x, y, z, size] of [
    [0, 0.5, 0, 0.17],
    [-0.12, 0.42, 0.05, 0.13],
    [0.13, 0.44, -0.03, 0.14],
    [0.03, 0.66, 0.02, 0.12],
  ]) {
    const mesh = new THREE.Mesh(leaf, green);
    mesh.position.set(x, y, z);
    mesh.scale.set(size, size * 1.3, size);
    group.add(mesh);
  }
  return group;
}

// Stars, a moon and a heart hanging from the ceiling on threads, turning slowly.
export function mobile() {
  const group = new THREE.Group();
  const thread = new THREE.LineBasicMaterial({ color: 0xc7a6ff });
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.9, 8), toon(0xffd166));
  bar.rotation.z = Math.PI / 2;
  group.add(bar, new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0.5, 0)]), thread));
  const shapes = [
    [new THREE.SphereGeometry(0.07, 16, 12), 0xffd166],
    [new THREE.OctahedronGeometry(0.08), 0xff9fcf],
    [new THREE.SphereGeometry(0.06, 16, 12), 0x8fd3ff],
    [new THREE.OctahedronGeometry(0.07), 0xc7a6ff],
  ];
  shapes.forEach(([geometry, color], i) => {
    const x = -0.42 + i * 0.28;
    const drop = 0.25 + (i % 2) * 0.15;
    const charm = new THREE.Mesh(geometry, toon(color));
    charm.position.set(x, -drop, 0);
    group.add(charm, new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, 0, 0), new THREE.Vector3(x, -drop, 0)]), thread));
  });
  return group;
}

// Toy blocks with a letter or a number on each side.
function blocks() {
  const group = new THREE.Group();
  const block = (text, color, x, y, z, turn) => {
    const face = canvasTexture(128, 128, (g, w) => {
      g.fillStyle = color;
      g.fillRect(0, 0, w, w);
      g.strokeStyle = '#ffffff';
      g.lineWidth = 10;
      g.strokeRect(5, 5, w - 10, w - 10);
      g.fillStyle = '#ffffff';
      g.font = `700 86px ${FONT}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(text, w / 2, w / 2 + 6);
    });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.18), toon(0xffffff, { map: face }));
    mesh.position.set(x, y, z);
    mesh.rotation.y = turn;
    group.add(mesh);
  };
  block('A', '#f15bb5', 0, 0.09, 0, 0.2);
  block('3', '#4cc9f0', 0.21, 0.09, 0.03, -0.25);
  block('B', '#9b5de5', 0.1, 0.27, 0.01, 0.5);
  return group;
}

// Everything in the room that never changes.
export function buildHouse() {
  const house = new THREE.Group();
  const width = ROOM.right - ROOM.left;
  const depth = ROOM.front - ROOM.back;
  const paper = toon(0xffffff, { map: wallpaper() });

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), toon(0xffffff, { map: planks() }));
  floor.material.map.repeat.set(width, depth);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0.002, (ROOM.front + ROOM.back) / 2);

  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), toon(0xfdf8ff));
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, ROOM.height, (ROOM.front + ROOM.back) / 2);

  const { x, width: open, bottom, top } = WINDOW;
  const back = wall(width, paper, { left: x - open / 2, right: x + open / 2, bottom, top });
  back.position.z = ROOM.back;
  const front = wall(width, paper);
  front.rotation.y = Math.PI;
  front.position.z = ROOM.front;
  const left = wall(depth, paper);
  left.rotation.y = Math.PI / 2;
  left.position.set(ROOM.left, 0, (ROOM.front + ROOM.back) / 2);
  const right = wall(depth, paper);
  right.rotation.y = -Math.PI / 2;
  right.position.set(ROOM.right, 0, (ROOM.front + ROOM.back) / 2);

  const skirting = box(width, 0.1, 0.03, toon(0xffffff), 0, 0.05, ROOM.back + 0.015);

  const rug = new THREE.Mesh(new THREE.CircleGeometry(1.15, 48), toon(0xffffff, { map: rugTexture() }));
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(0, 0.006, -2.05);

  const greenery = plant();
  greenery.position.set(2.6, 0, -2.95);
  const toys = blocks();
  toys.position.set(-2.55, 0, -2.75);

  const wallY = ROOM.height - 0.25;
  house.add(
    floor,
    ceiling,
    back,
    front,
    left,
    right,
    skirting,
    rug,
    windowFrame(),
    bunting(new THREE.Vector3(-2.95, wallY, ROOM.back + 0.03), new THREE.Vector3(-1.1, wallY, ROOM.back + 0.03)),
    bunting(new THREE.Vector3(1.1, wallY, ROOM.back + 0.03), new THREE.Vector3(2.95, wallY, ROOM.back + 0.03)),
    greenery,
    toys,
  );
  return house;
}

// A round, pink stage for the pet to stand on.
export function podium() {
  const group = new THREE.Group();
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.36, 0.2, 40), toon(0xff9fcf));
  top.position.y = 0.1;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.345, 0.018, 8, 40), toon(0xffd166));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.2;
  group.add(top, rim);
  return group;
}

// A picture frame on the wall, for the pet's portrait.
export function frame(width, height) {
  const group = new THREE.Group();
  const gold = toon(0xffd166);
  const bar = 0.05;
  group.add(
    box(width + bar * 2, bar, 0.04, gold, 0, height / 2 + bar / 2, 0),
    box(width + bar * 2, bar, 0.04, gold, 0, -height / 2 - bar / 2, 0),
    box(bar, height, 0.04, gold, -width / 2 - bar / 2, 0, 0),
    box(bar, height, 0.04, gold, width / 2 + bar / 2, 0, 0),
  );
  const picture = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ color: 0xfff1f8 }));
  picture.position.z = -0.005;
  group.add(picture);
  group.userData.picture = picture;
  return group;
}
