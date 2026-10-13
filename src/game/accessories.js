import * as THREE from 'three';
import { toon } from './toon.js';
import { starShape } from './shapes.js';

// Each builder returns a group placed relative to the centre of the kitten's
// head, which is a ball of radius 0.13 that looks along +z.
const HEAD = 0.13;

function mesh(geometry, material, x = 0, y = 0, z = 0) {
  const part = new THREE.Mesh(geometry, material);
  part.position.set(x, y, z);
  return part;
}

function stripes(colors) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const g = canvas.getContext('2d');
  const band = 128 / colors.length;
  // Slanted bands that wrap into a spiral around a cone.
  for (let i = -colors.length; i < colors.length * 2; i++) {
    g.fillStyle = colors[((i % colors.length) + colors.length) % colors.length];
    g.beginPath();
    g.moveTo(i * band, 0);
    g.lineTo((i + 1) * band, 0);
    g.lineTo((i + 1) * band + 128, 128);
    g.lineTo(i * band + 128, 128);
    g.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  return texture;
}

const BUILDERS = {
  bow() {
    const group = new THREE.Group();
    const pink = toon(0xff4f9a);
    const lobe = new THREE.ConeGeometry(0.042, 0.075, 16);
    for (const side of [-1, 1]) {
      const part = mesh(lobe, pink, side * 0.036);
      part.rotation.z = side * (Math.PI / 2);
      part.scale.z = 0.55;
      group.add(part);
    }
    group.add(mesh(new THREE.SphereGeometry(0.018, 12, 8), toon(0xffd166)));
    group.position.set(0.085, HEAD * 0.92, 0.04);
    group.rotation.z = -0.45;
    return group;
  },

  party() {
    const group = new THREE.Group();
    const cone = mesh(
      new THREE.ConeGeometry(0.058, 0.15, 24),
      toon(0xffffff, { map: stripes(['#f15bb5', '#ffd166', '#4cc9f0', '#9b5de5']) }),
      0,
      0.075,
    );
    const brim = mesh(new THREE.TorusGeometry(0.058, 0.009, 8, 24), toon(0xffffff));
    brim.rotation.x = Math.PI / 2;
    group.add(cone, brim, mesh(new THREE.SphereGeometry(0.022, 12, 8), toon(0xffd166), 0, 0.155));
    group.position.set(-0.02, HEAD * 0.93, 0.01);
    group.rotation.z = 0.2;
    return group;
  },

  crown() {
    const group = new THREE.Group();
    const gold = toon(0xffc93c, { side: THREE.DoubleSide });
    group.add(mesh(new THREE.CylinderGeometry(0.062, 0.055, 0.035, 24, 1, true), gold));
    const point = new THREE.ConeGeometry(0.016, 0.04, 8);
    const gem = new THREE.SphereGeometry(0.009, 8, 6);
    const gems = [0xff4f9a, 0x4cc9f0, 0x9b5de5];
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const x = Math.sin(angle) * 0.06;
      const z = Math.cos(angle) * 0.06;
      group.add(mesh(point, gold, x, 0.036, z), mesh(gem, toon(gems[i % 3]), x * 1.04, 0, z * 1.04));
    }
    group.position.y = HEAD * 0.99;
    group.scale.setScalar(1.25);
    return group;
  },

  wizard() {
    const group = new THREE.Group();
    const cloth = toon(0x5a189a);
    const gold = toon(0xffd166, { side: THREE.DoubleSide });
    group.add(mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.008, 32), cloth));
    group.add(mesh(new THREE.CylinderGeometry(0.034, 0.068, 0.09, 24), cloth, 0, 0.049));
    const tip = mesh(new THREE.ConeGeometry(0.034, 0.1, 24), cloth, 0.012, 0.135, -0.012);
    tip.rotation.set(-0.35, 0, -0.3);
    const band = mesh(new THREE.TorusGeometry(0.068, 0.008, 8, 24), gold, 0, 0.012);
    band.rotation.x = Math.PI / 2;
    const badge = mesh(new THREE.ShapeGeometry(starShape(0.02)), gold, 0, 0.05, 0.057);
    badge.rotation.x = -0.35;
    group.add(tip, band, badge);
    group.position.y = HEAD * 0.86;
    group.rotation.x = -0.12;
    return group;
  },

  glasses() {
    const group = new THREE.Group();
    const frame = toon(0xff4f9a);
    const glass = new THREE.MeshStandardMaterial({ color: 0x241536, roughness: 0.15 });
    const lens = new THREE.CylinderGeometry(0.043, 0.043, 0.006, 24).rotateX(Math.PI / 2);
    const rim = new THREE.TorusGeometry(0.043, 0.007, 8, 24);
    for (const side of [-1, 1]) {
      const eye = new THREE.Group();
      eye.add(mesh(lens, glass), mesh(rim, frame));
      eye.position.set(side * 0.054, -0.004, 0.128);
      eye.rotation.y = side * 0.38;
      group.add(eye);
      const arm = mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.1, 6).rotateX(Math.PI / 2), frame);
      arm.position.set(side * 0.125, 0, 0.07);
      arm.rotation.y = side * 0.5;
      group.add(arm);
    }
    group.add(mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.03, 6).rotateZ(Math.PI / 2), frame, 0, 0.004, 0.142));
    return group;
  },

  flowers() {
    const group = new THREE.Group();
    const vine = mesh(new THREE.TorusGeometry(0.104, 0.009, 8, 32), toon(0x52b788));
    vine.rotation.x = Math.PI / 2;
    group.add(vine);
    const petal = new THREE.SphereGeometry(0.024, 12, 8);
    const heart = new THREE.SphereGeometry(0.01, 8, 6);
    const yellow = toon(0xffd166);
    const petals = [0xffffff, 0xff8fab, 0x4cc9f0, 0xffd166, 0xc77dff].map((color) => toon(color));
    for (let i = 0; i < 11; i++) {
      const angle = (i / 11) * Math.PI * 2;
      const x = Math.sin(angle) * 0.108;
      const z = Math.cos(angle) * 0.108;
      const flower = mesh(petal, petals[i % petals.length], x, 0.004, z);
      flower.scale.y = 0.6;
      group.add(flower, mesh(heart, yellow, x * 1.1, 0.012, z * 1.1));
    }
    group.scale.x = 1.1;
    group.position.y = HEAD * 0.62;
    group.rotation.x = -0.22;
    return group;
  },
};

export function buildAccessory(id) {
  return BUILDERS[id]?.() ?? null;
}

export function disposeAccessory(group) {
  group.traverse((part) => {
    part.geometry?.dispose();
    part.material?.map?.dispose();
    part.material?.dispose();
  });
}
