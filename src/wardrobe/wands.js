import * as THREE from 'three';
import { toon } from '../game/toon.js';
import { heartShape, starShape, puffy } from '../game/shapes.js';
import { GEAR_PALETTES } from './catalog.js';

// Each wand's own look, used where the player has not decorated it.
// stick: the shaft. tip: its top. sparkles: what it shoots.
const KINDS = {
  star: { stick: 0x9b5de5, glitter: [0xffd166, 0xffffff, 0xff8fab] },
  wizard: { stick: 0x8b5a2b, glitter: [0xfff6c9, 0xffffff, 0x8fd3ff] },
  heart: { stick: 0xffffff, glitter: [0xff4f9a, 0xffffff, 0xff8fab] },
  lollipop: { stick: 0xffffff, glitter: [0xff8fab, 0xffffff, 0x9be3c3] },
  unicorn: { stick: 0xf3e8ff, glitter: [0xffd166, 0xffffff, 0xc77dff, 0x8fd3ff] },
};

const hex = (number) => `#${number.toString(16).padStart(6, '0')}`;

// The colours a gear's wand ends up with: { stick, tip, sparkles, ribbon }.
export function wandColors(gear) {
  const kind = KINDS[gear.wand] ?? KINDS.star;
  const glitter = GEAR_PALETTES.glitter[gear.glitter] ?? kind.glitter;
  return {
    stick: GEAR_PALETTES.stick[gear.stick] ?? kind.stick,
    tip: glitter[0],
    sparkles: glitter,
    ribbon: GEAR_PALETTES.ribbon[gear.ribbon] ?? null,
  };
}

function swirlTexture(a, b) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const g = canvas.getContext('2d');
  g.fillStyle = hex(b);
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = hex(a);
  g.lineWidth = 11;
  g.beginPath();
  for (let i = 0; i < 120; i++) {
    const angle = i * 0.22;
    const radius = i * 0.52;
    g.lineTo(64 + Math.cos(angle) * radius, 64 + Math.sin(angle) * radius);
  }
  g.stroke();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function ribbonBow(color, z) {
  const group = new THREE.Group();
  const material = toon(color);
  const loop = new THREE.ConeGeometry(0.014, 0.026, 10);
  for (const side of [-1, 1]) {
    const part = new THREE.Mesh(loop, material);
    part.rotation.z = side * (Math.PI / 2);
    part.position.x = side * 0.012;
    part.scale.z = 0.5;
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.03, 0.002), material);
    tail.position.set(side * 0.006, -0.018, 0);
    tail.rotation.z = side * 0.3;
    group.add(part, tail);
  }
  group.add(new THREE.Mesh(new THREE.SphereGeometry(0.006, 8, 6), material));
  group.position.set(0, 0.012, z);
  group.rotation.x = -Math.PI / 2;
  return group;
}

// A wand pointing along -z from the hand at the origin, as held in a headset, with a flat
// tip facing the player. `upright` turns flat tips to face +y instead, for a wand that
// stands on a shelf. `userData.tip` is the part at the top, which may spin and flash.
export function buildWand(gear, { upright = false } = {}) {
  const colors = wandColors(gear);
  const wand = new THREE.Group();
  const stick = toon(colors.stick);
  const tipMaterial = new THREE.MeshBasicMaterial({ color: colors.tip });
  let tip;
  let length = 0.22;

  if (gear.wand === 'wizard') {
    // A classic wand: a carved grip and a long, tapering shaft with a glowing point.
    length = 0.3;
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.008, length, 10).rotateX(-Math.PI / 2), stick);
    shaft.position.z = -length / 2;
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.01, 0.08, 12).rotateX(Math.PI / 2), stick);
    grip.position.z = -0.03;
    const dark = toon(new THREE.Color(colors.stick).multiplyScalar(0.6));
    for (const z of [-0.004, -0.072]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.0115, 0.003, 6, 14), dark);
      ring.position.z = z;
      wand.add(ring);
    }
    const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.012, 10, 8), dark);
    pommel.position.z = 0.008;
    tip = new THREE.Mesh(new THREE.SphereGeometry(0.008, 10, 8), tipMaterial);
    tip.position.z = -length;
    wand.add(shaft, grip, pommel);
  } else {
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.009, length, 8).rotateX(Math.PI / 2), stick);
    shaft.position.z = -length / 2;
    wand.add(shaft);
    if (gear.wand === 'heart') {
      tip = new THREE.Mesh(puffy(heartShape(0.026), 0.004, 0.006), tipMaterial);
      tip.position.z = -length - 0.028;
      tip.rotation.x = -Math.PI / 2;
    } else if (gear.wand === 'lollipop') {
      const swirl = new THREE.MeshBasicMaterial({ map: swirlTexture(colors.tip, 0xffffff) });
      tip = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.014, 32).rotateX(Math.PI / 2), [tipMaterial, swirl, swirl]);
      tip.position.z = -length - 0.038;
    } else if (gear.wand === 'unicorn') {
      // A spiral horn with a golden band twisting around it.
      tip = new THREE.Group();
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.11, 16).rotateX(-Math.PI / 2), toon(0xfff6fb));
      const turns = [];
      for (let i = 0; i <= 40; i++) {
        const p = i / 40;
        const radius = 0.019 * (1 - p);
        turns.push(new THREE.Vector3(Math.cos(p * 18) * radius, Math.sin(p * 18) * radius, 0.055 - p * 0.11));
      }
      const band = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(turns), 80, 0.0028, 6), tipMaterial);
      tip.add(horn, band);
      tip.position.z = -length - 0.05;
    } else {
      tip = new THREE.Mesh(puffy(starShape(0.032, 0.015), 0.004, 0.006), tipMaterial);
      tip.position.z = -length - 0.03;
    }
  }
  if (upright && ['star', 'heart', 'lollipop'].includes(gear.wand)) tip.rotation.x += Math.PI / 2;
  wand.add(tip);
  if (colors.ribbon != null) wand.add(ribbonBow(colors.ribbon, gear.wand === 'wizard' ? -0.08 : -0.06));
  wand.userData = { tip, length, sparkles: colors.sparkles };
  return wand;
}

// A mouse pointer drawn like the wand, for playing on a screen.
export function wandCursor(gear) {
  const { stick, tip } = wandColors(gear);
  const kind = gear.wand;
  let head;
  if (kind === 'heart') head = `<path d='M10 16 C2 10 3 3 10 7 C17 3 18 10 10 16Z' fill='${hex(tip)}' stroke='%237b2cbf' stroke-width='1.5'/>`;
  else if (kind === 'wizard') head = `<circle cx='9' cy='9' r='4' fill='${hex(tip)}' stroke='%237b2cbf' stroke-width='1.5'/>`;
  else if (kind === 'lollipop') head = `<circle cx='10' cy='10' r='8' fill='${hex(tip)}' stroke='%237b2cbf' stroke-width='1.5'/><path d='M10 10 m-4 0 a4 4 0 1 0 8 0 a3 3 0 1 0 -6 0' fill='none' stroke='white' stroke-width='2'/>`;
  else if (kind === 'unicorn') head = `<polygon points='3,3 15,8 8,15' fill='${hex(tip)}' stroke='%237b2cbf' stroke-width='1.5' stroke-linejoin='round'/>`;
  else head = `<polygon points='10,1 12.4,6.8 18.6,7.2 13.8,11.2 15.3,17.3 10,14 4.7,17.3 6.2,11.2 1.4,7.2 7.6,6.8' fill='${hex(tip)}' stroke='%237b2cbf' stroke-width='1.5' stroke-linejoin='round'/>`;
  const width = kind === 'wizard' ? 4 : 6;
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='44' height='44'>` +
    `<line x1='14' y1='14' x2='38' y2='38' stroke='%237b2cbf' stroke-width='${width + 3}' stroke-linecap='round'/>` +
    `<line x1='14' y1='14' x2='38' y2='38' stroke='${hex(stick)}' stroke-width='${width}' stroke-linecap='round'/>` +
    `${head}</svg>`;
  return `url("data:image/svg+xml,${svg.replaceAll('#', '%23').replaceAll('<', '%3C').replaceAll('>', '%3E')}") 10 10, crosshair`;
}
