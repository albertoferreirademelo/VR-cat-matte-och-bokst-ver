import * as THREE from 'three';
import { toon } from './toon.js';

const puff = new THREE.SphereGeometry(1, 16, 12);
const white = toon(0xffffff, { emissive: 0xc9b6ff, emissiveIntensity: 0.3 });
// x, y, z, radius of each puff
const PUFFS = [
  [0, 0, 0, 0.2],
  [-0.2, -0.03, 0, 0.15],
  [0.2, -0.02, 0.02, 0.16],
  [-0.08, 0.09, -0.02, 0.13],
  [0.1, 0.08, 0, 0.14],
  [0.34, -0.06, 0, 0.1],
  [-0.34, -0.06, 0, 0.1],
];

export function makeCloud(size = 1, material = white) {
  const cloud = new THREE.Group();
  for (const [x, y, z, radius] of PUFFS) {
    const mesh = new THREE.Mesh(puff, material);
    mesh.position.set(x, y, z);
    mesh.scale.set(radius, radius * 0.85, radius);
    cloud.add(mesh);
  }
  cloud.scale.setScalar(size);
  return cloud;
}
