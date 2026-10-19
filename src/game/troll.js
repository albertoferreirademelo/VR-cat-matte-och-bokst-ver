import * as THREE from 'three';
import { toon } from './toon.js';
import { heartShape, puffy } from './shapes.js';
import { Spring } from './motion.js';
import { SEE_THROUGH } from '../ui/board.js';

// Molntrollet: a grumpy storm cloud who has blown the kittens into bubbles. Silly, never scary.
// When it has lost all its hearts it turns into a small, friendly white cloud.

const INK = '#2b1b3d';
const puffGeo = new THREE.SphereGeometry(1, 20, 14);
const heartGeo = puffy(heartShape(0.05), 0.02, 0.018);
const crownGeo = new THREE.ConeGeometry(0.065, 0.19, 4);
// x, y, z, radius: a round, lumpy cloud body.
const BODY = [
  [0, 0, 0, 0.42],
  [-0.34, -0.06, 0.02, 0.3],
  [0.34, -0.05, 0.02, 0.31],
  [-0.18, 0.26, -0.04, 0.27],
  [0.17, 0.27, -0.03, 0.29],
  [0, 0.36, -0.08, 0.24],
  [-0.52, -0.14, 0, 0.18],
  [0.53, -0.13, 0, 0.19],
  [0, -0.25, 0.04, 0.3],
];

function ellipse(g, x, y, rx, ry) {
  g.beginPath();
  g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
}

// Faces: grumpy, laugh (a mean little giggle), blow (blowing bubbles), ouch (dizzy) and happy.
function drawFace(g, kind) {
  g.clearRect(0, 0, 512, 360);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const eyeY = 150;
  const brows = (tilt) => {
    g.strokeStyle = INK;
    g.lineWidth = 22;
    for (const side of [-1, 1]) {
      g.beginPath();
      g.moveTo(256 + side * 40, eyeY - 62 + tilt);
      g.lineTo(256 + side * 150, eyeY - 62 - tilt);
      g.stroke();
    }
  };
  const openEyes = (look = 0) => {
    for (const side of [-1, 1]) {
      ellipse(g, 256 + side * 92, eyeY, 50, 54);
      g.fillStyle = '#ffffff';
      g.fill();
      g.lineWidth = 10;
      g.strokeStyle = INK;
      g.stroke();
      ellipse(g, 256 + side * 86, eyeY + 12 + look, 26, 28);
      g.fillStyle = INK;
      g.fill();
      ellipse(g, 256 + side * 78, eyeY + 2 + look, 9, 9);
      g.fillStyle = '#ffffff';
      g.fill();
    }
  };
  const cheeks = (alpha) => {
    g.fillStyle = `rgba(255, 105, 170, ${alpha})`;
    for (const side of [-1, 1]) {
      ellipse(g, 256 + side * 165, eyeY + 80, 40, 22);
      g.fill();
    }
  };
  g.strokeStyle = INK;
  g.fillStyle = INK;

  if (kind === 'grumpy' || kind === 'blow') {
    openEyes(8);
    brows(22);
    cheeks(0.25);
    if (kind === 'blow') {
      ellipse(g, 256, 270, 30, 34);
      g.fillStyle = '#5a2a6e';
      g.fill();
      g.lineWidth = 10;
      g.stroke();
    } else {
      // A pout with one little tooth.
      g.lineWidth = 14;
      g.beginPath();
      g.arc(256, 310, 60, Math.PI * 1.2, Math.PI * 1.8);
      g.stroke();
      g.beginPath();
      g.moveTo(276, 262);
      g.lineTo(290, 286);
      g.lineTo(300, 266);
      g.fillStyle = '#ffffff';
      g.fill();
    }
  } else if (kind === 'laugh') {
    g.lineWidth = 16;
    for (const side of [-1, 1]) {
      g.beginPath();
      g.arc(256 + side * 92, eyeY + 20, 40, Math.PI * 1.15, Math.PI * 1.85);
      g.stroke();
    }
    brows(14);
    cheeks(0.35);
    g.beginPath();
    g.moveTo(176, 240);
    g.quadraticCurveTo(256, 250, 336, 240);
    g.quadraticCurveTo(320, 340, 256, 340);
    g.quadraticCurveTo(192, 340, 176, 240);
    g.fillStyle = '#5a2a6e';
    g.fill();
    g.lineWidth = 10;
    g.stroke();
    ellipse(g, 256, 315, 34, 18);
    g.fillStyle = '#ff7fae';
    g.fill();
  } else if (kind === 'ouch') {
    // Spiral eyes and a wobbly mouth.
    g.lineWidth = 11;
    for (const side of [-1, 1]) {
      g.beginPath();
      for (let a = 0; a < Math.PI * 5; a += 0.2) {
        const r = 4 + a * 3.2;
        g.lineTo(256 + side * 92 + Math.cos(a * side) * r, eyeY + Math.sin(a * side) * r);
      }
      g.stroke();
    }
    g.lineWidth = 13;
    g.beginPath();
    for (let x = 0; x <= 140; x += 10) g.lineTo(186 + x, 285 + Math.sin(x / 11) * 12);
    g.stroke();
  } else {
    // Happy: big friendly eyes, rosy cheeks and a smile.
    openEyes(-4);
    cheeks(0.6);
    g.lineWidth = 14;
    g.beginPath();
    g.arc(256, 240, 62, Math.PI * 0.18, Math.PI * 0.82);
    g.stroke();
  }
}

export class Troll extends THREE.Group {
  constructor() {
    super();
    this.material = toon(0x9a86d6, { emissive: 0x4a2f96, emissiveIntensity: 0.22 });
    this.body = new THREE.Group();
    for (const [x, y, z, r] of BODY) {
      const puff = new THREE.Mesh(puffGeo, this.material);
      puff.position.set(x, y, z);
      puff.scale.set(r, r * 0.92, r * 0.85);
      this.body.add(puff);
    }

    this.hands = [-1, 1].map((side) => {
      const hand = new THREE.Mesh(puffGeo, this.material);
      hand.scale.setScalar(0.13);
      hand.userData.rest = new THREE.Vector3(side * 0.72, -0.08, 0.12);
      hand.position.copy(hand.userData.rest);
      this.body.add(hand);
      return hand;
    });

    this.canvas = document.createElement('canvas');
    this.canvas.width = 512;
    this.canvas.height = 360;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.face = new THREE.Mesh(
      new THREE.PlaneGeometry(0.74, 0.52),
      new THREE.MeshBasicMaterial({ map: this.texture, transparent: true, alphaTest: SEE_THROUGH }),
    );
    this.face.position.set(0, 0.06, 0.4);
    this.body.add(this.face);

    // A crown for the big boss of a master round.
    this.crown = new THREE.Group();
    const gold = toon(0xffc93c, { emissive: 0xffa000, emissiveIntensity: 0.35 });
    for (let i = 0; i < 5; i++) {
      const point = new THREE.Mesh(crownGeo, gold);
      point.position.set((i - 2) * 0.1, 0, Math.abs(i - 2) * -0.02);
      this.crown.add(point);
    }
    this.crown.position.set(0, 0.62, -0.04);
    this.body.add(this.crown);

    this.hearts = new THREE.Group();
    this.hearts.position.set(0, 0.86, 0);
    this.add(this.body, this.hearts);

    this.squash = new Spring(1, 260, 9);
    this.shake = 0;
    this.throwTime = 1;
    this.laughTime = 1;
    this.friendly = false;
    this.expression = null;
    this.expressionTimer = 0;
    this.setFace('grumpy');
  }

  setFace(kind, seconds = 0) {
    this.faceAfter = seconds ? (this.friendly ? 'happy' : 'grumpy') : null;
    this.expressionTimer = seconds;
    if (kind === this.expression) return;
    this.expression = kind;
    drawFace(this.canvas.getContext('2d'), kind);
    this.texture.needsUpdate = true;
  }

  // A fresh troll for a round: stormy, with `count` hearts and maybe a crown.
  reset(count, crowned) {
    this.friendly = false;
    this.material.color.set(0x9a86d6);
    this.material.emissive.set(0x4a2f96);
    this.crown.visible = crowned;
    this.body.scale.setScalar(1);
    this.body.rotation.set(0, 0, 0);
    this.hearts.clear();
    this.heartCount = count;
    for (let i = 0; i < count; i++) {
      const heart = new THREE.Mesh(heartGeo, toon(0xff4f9a, { emissive: 0xff4f9a, emissiveIntensity: 0.3 }));
      heart.position.x = (i - (count - 1) / 2) * 0.13;
      heart.userData.size = new Spring(1, 300, 12);
      this.hearts.add(heart);
    }
    this.hearts.visible = false;
    this.setFace('grumpy');
  }

  // Where bubbles and storm balls come from.
  mouth(target = new THREE.Vector3()) {
    return this.face.localToWorld(target.set(0, -0.12, 0.05));
  }

  hand(side, target = new THREE.Vector3()) {
    return this.hands[side > 0 ? 1 : 0].getWorldPosition(target);
  }

  throwBall() {
    this.throwTime = 0;
    this.setFace('grumpy');
  }

  laugh() {
    this.laughTime = 0;
    this.setFace('laugh', 1.3);
  }

  blow() {
    this.setFace('blow', 0.9);
    this.squash.value = 1.12;
  }

  // Loses `damage` hearts. Returns how many are left.
  hurt(damage = 1) {
    this.shake = 0.6;
    this.squash.value = 0.72;
    this.setFace('ouch', 1.1);
    for (let i = 0; i < damage && this.heartCount > 0; i++) {
      this.heartCount -= 1;
      this.hearts.children[this.heartCount].userData.size.target = 0;
    }
    return this.heartCount;
  }

  heartPosition(index, target = new THREE.Vector3()) {
    return this.hearts.children[index].getWorldPosition(target);
  }

  // The storm blows over: a small, white, happy cloud.
  makeFriendly() {
    this.friendly = true;
    this.hearts.visible = false;
    this.crown.visible = false;
    this.material.color.set(0xffffff);
    this.material.emissive.set(0xc9b6ff);
    this.squash.value = 0.5;
    this.setFace('happy');
  }

  update(dt, t) {
    if (this.expressionTimer > 0 && (this.expressionTimer -= dt) <= 0 && this.faceAfter) this.setFace(this.faceAfter);

    const squash = this.squash.update(dt);
    this.body.scale.set(1 / Math.sqrt(squash), squash, 1 / Math.sqrt(squash));
    this.shake = Math.max(0, this.shake - dt);
    this.body.position.x = Math.sin(t * 60) * this.shake * 0.08;
    this.body.position.y = Math.sin(t * 1.4) * 0.05;
    this.body.rotation.z = Math.sin(t * 0.9) * 0.04;

    this.laughTime = Math.min(1, this.laughTime + dt / 1.2);
    this.body.position.y += Math.abs(Math.sin(this.laughTime * Math.PI * 5)) * 0.06 * (1 - this.laughTime);

    // A throw: the right hand winds back, then swings forward.
    this.throwTime = Math.min(1, this.throwTime + dt / 0.6);
    this.hands.forEach((hand, i) => {
      hand.position.copy(hand.userData.rest);
      hand.position.y += Math.sin(t * 2 + i * 2) * 0.04;
      if (i === 1 && this.throwTime < 1) {
        const swing = Math.sin(this.throwTime * Math.PI * 2);
        hand.position.y += 0.18 * Math.sin(this.throwTime * Math.PI);
        hand.position.z += swing * 0.25;
      }
    });

    for (const heart of this.hearts.children) {
      const size = heart.userData.size.update(dt);
      heart.scale.setScalar(Math.max(0.0001, size));
      heart.rotation.y = Math.sin(t * 2 + heart.position.x * 10) * 0.4;
    }
  }
}
