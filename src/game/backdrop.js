import * as THREE from 'three';
import { makeCloud } from './clouds.js';
import { toon } from './toon.js';

function skyTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 256;
  const g = canvas.getContext('2d');
  const gradient = g.createLinearGradient(0, 0, 0, 256);
  gradient.addColorStop(0, '#7f6bf2');
  gradient.addColorStop(0.3, '#b79bff');
  gradient.addColorStop(0.5, '#ffd1ec');
  gradient.addColorStop(1, '#ffd1ec');
  g.fillStyle = gradient;
  g.fillRect(0, 0, 4, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// The dream world shown on a screen and in headsets without passthrough:
// pastel sky, soft hills, drifting clouds and twinkling stars.
export class Backdrop extends THREE.Group {
  constructor() {
    super();
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(45, 24, 16),
      new THREE.MeshBasicMaterial({ map: skyTexture(), side: THREE.BackSide, depthWrite: false }),
    );
    const floor = new THREE.Mesh(new THREE.CircleGeometry(30, 48), toon(0xe9d8ff));
    floor.rotation.x = -Math.PI / 2;
    this.add(sky, floor);

    const hill = new THREE.SphereGeometry(1, 32, 16);
    for (const [x, z, radius, color] of [
      [-9, -15, 8, 0xcdb4f7],
      [6, -18, 10, 0xf7c6e6],
      [17, -9, 7, 0xb8e8dc],
      [-18, -4, 7, 0xf7c6e6],
      [0, 19, 10, 0xcdb4f7],
    ]) {
      const mesh = new THREE.Mesh(hill, toon(color));
      mesh.position.set(x, -radius * 0.78, z);
      mesh.scale.setScalar(radius);
      this.add(mesh);
    }

    this.clouds = new THREE.Group();
    for (let i = 0; i < 14; i++) {
      const cloud = makeCloud(2.5 + Math.random() * 3);
      const angle = (i / 14) * Math.PI * 2 + Math.random() * 0.3;
      const distance = 14 + Math.random() * 10;
      cloud.position.set(Math.sin(angle) * distance, 4 + Math.random() * 7, Math.cos(angle) * distance);
      cloud.rotation.y = angle + Math.PI;
      this.clouds.add(cloud);
    }
    this.add(this.clouds);

    const positions = [];
    for (let i = 0; i < 140; i++) {
      const direction = new THREE.Vector3().randomDirection();
      direction.y = Math.abs(direction.y) * 0.8 + 0.25;
      positions.push(...direction.normalize().multiplyScalar(38).toArray());
    }
    const twinkle = new THREE.BufferGeometry();
    twinkle.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    this.twinkles = new THREE.Points(
      twinkle,
      new THREE.PointsMaterial({ color: 0xffffff, size: 0.35, transparent: true, depthWrite: false }),
    );
    this.add(this.twinkles);
  }

  update(dt, t) {
    if (!this.visible) return;
    this.clouds.rotation.y += dt * 0.01;
    this.twinkles.material.opacity = 0.65 + Math.sin(t * 1.7) * 0.25;
  }
}
