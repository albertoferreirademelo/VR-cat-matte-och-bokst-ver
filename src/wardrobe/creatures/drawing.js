import * as THREE from 'three';

// Faces are drawn in 2D, one picture per expression, and wrapped around the
// front of a creature's head. All coordinates are in a 512 × 512 square.
// These are the parts every creature's face is made of.
export const SIZE = 512;
export const MID = SIZE / 2;
export const INK = '#2b1b3d';

export const hex = (number) => `#${number.toString(16).padStart(6, '0')}`;

export function ellipse(g, x, y, rx, ry) {
  g.beginPath();
  g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
}

function star(g, x, y, outer, inner) {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const radius = i % 2 ? inner : outer;
    const angle = (i / 10) * Math.PI * 2 - Math.PI / 2;
    g.lineTo(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius);
  }
  g.closePath();
}

function heart(g, x, y, s) {
  g.beginPath();
  g.moveTo(x, y + s * 0.9);
  g.bezierCurveTo(x - s * 1.4, y + s * 0.05, x - s * 0.85, y - s, x, y - s * 0.4);
  g.bezierCurveTo(x + s * 0.85, y - s, x + s * 1.4, y + s * 0.05, x, y + s * 0.9);
}

function openEye(g, x, y, iris, look, pupil) {
  const rx = 44;
  const ry = 58;
  g.save();
  ellipse(g, x, y, rx, ry);
  g.fillStyle = INK;
  g.fill();
  g.clip();
  const gradient = g.createLinearGradient(0, y - ry, 0, y + ry);
  gradient.addColorStop(0.2, iris[0]);
  gradient.addColorStop(1, iris[1]);
  ellipse(g, x + look[0] * 0.5, y + 6 + look[1] * 0.5, rx - 8, ry - 10);
  g.fillStyle = gradient;
  g.fill();
  ellipse(g, x + look[0], y + look[1], 19 * pupil, 27 * pupil);
  g.fillStyle = INK;
  g.fill();
  g.fillStyle = '#ffffff';
  ellipse(g, x - 15 + look[0], y - 24 + look[1], 15, 15);
  g.fill();
  ellipse(g, x + 17 + look[0] * 0.5, y + 25 + look[1] * 0.5, 7, 7);
  g.fill();
  g.restore();
  // Upper lash line with a small flick.
  g.beginPath();
  g.ellipse(x, y, rx + 2, ry + 2, 0, Math.PI * 1.06, Math.PI * 1.94);
  g.lineWidth = 11;
  g.strokeStyle = INK;
  g.stroke();
}

// A closed eye: a happy arch (^) or a relaxed curve.
function arcEye(g, x, y, happy) {
  g.beginPath();
  if (happy) g.arc(x, y + 24, 42, Math.PI * 1.15, Math.PI * 1.85);
  else g.arc(x, y - 26, 42, Math.PI * 0.2, Math.PI * 0.8);
  g.lineWidth = 13;
  g.strokeStyle = INK;
  g.stroke();
}

function starEye(g, x, y) {
  ellipse(g, x, y, 44, 58);
  g.fillStyle = INK;
  g.fill();
  star(g, x, y, 40, 17);
  g.fillStyle = '#ffd166';
  g.fill();
  ellipse(g, x - 14, y - 26, 8, 8);
  g.fillStyle = '#ffffff';
  g.fill();
}

function heartEye(g, x, y) {
  heart(g, x, y + 4, 46);
  g.fillStyle = '#ff4f9a';
  g.fill();
  g.lineWidth = 8;
  g.strokeStyle = INK;
  g.stroke();
  ellipse(g, x - 20, y - 14, 9, 12);
  g.fillStyle = '#ffffff';
  g.fill();
}

export function mouth(g, kind, y = 330) {
  g.lineWidth = 8;
  g.strokeStyle = INK;
  if (kind === 'grin') {
    g.beginPath();
    g.arc(MID, y, 32, 0, Math.PI);
    g.closePath();
    g.save();
    g.fillStyle = '#8a1f45';
    g.fill();
    g.clip();
    ellipse(g, MID, y + 30, 20, 14);
    g.fillStyle = '#ff7fae';
    g.fill();
    g.restore();
    g.stroke();
  } else if (kind === 'wavy') {
    g.beginPath();
    g.moveTo(MID - 26, y + 14);
    g.quadraticCurveTo(MID - 13, y + 2, MID, y + 14);
    g.quadraticCurveTo(MID + 13, y + 26, MID + 26, y + 14);
    g.stroke();
  } else {
    // The classic cat mouth: two small curves under the nose.
    for (const side of [-1, 1]) {
      g.beginPath();
      g.arc(MID + side * 17, y, 17, Math.PI * 0.05, Math.PI * 0.95);
      g.stroke();
    }
  }
}

export const EXPRESSIONS = {
  open: { eyes: ['open', 'open'], mouth: 'cat' },
  up: { eyes: ['open', 'open'], look: [0, -15], mouth: 'cat' },
  blink: { eyes: ['shut', 'shut'], mouth: 'cat' },
  happy: { eyes: ['arc', 'arc'], mouth: 'grin', blush: 0.75 },
  star: { eyes: ['star', 'star'], mouth: 'grin', blush: 0.6 },
  heart: { eyes: ['heart', 'heart'], mouth: 'grin', blush: 0.8 },
  wink: { eyes: ['arc', 'open'], mouth: 'grin', blush: 0.6 },
  worried: { eyes: ['open', 'open'], look: [0, 9], pupil: 0.8, mouth: 'wavy', worried: true },
};

// A small shiny button eye, for creatures drawn in the simple round style.
function dotEye(g, x, y, look) {
  ellipse(g, x + look[0] * 0.4, y + look[1] * 0.4, 30, 36);
  g.fillStyle = INK;
  g.fill();
  g.fillStyle = '#ffffff';
  ellipse(g, x - 9 + look[0] * 0.4, y - 13 + look[1] * 0.4, 11, 11);
  g.fill();
}

// Both eyes for an expression, `x` from the middle and `scale` times the cat's size.
// `dots` draws open eyes as button eyes instead of the cat's big ones.
export function drawEyes(g, face, iris, { x, y, scale = 1, dots = false }) {
  face.eyes.forEach((kind, i) => {
    g.save();
    g.translate(MID + (i ? x : -x), y);
    g.scale(scale, scale);
    if (kind === 'open' && dots) dotEye(g, 0, 0, face.look ?? [0, 0]);
    else if (kind === 'open') openEye(g, 0, 0, iris, face.look ?? [0, 0], face.pupil ?? 1);
    else if (kind === 'star') starEye(g, 0, 0);
    else if (kind === 'heart') heartEye(g, 0, 0);
    else arcEye(g, 0, 0, kind === 'arc');
    g.restore();
  });
}

// Pink cheeks, rosier when happy.
export function drawBlush(g, face, { x, y, scale = 1 }) {
  g.fillStyle = `rgba(255, 95, 160, ${face.blush ?? 0.4})`;
  for (const side of [-1, 1]) {
    ellipse(g, MID + side * x, y, 32 * scale, 18 * scale);
    g.fill();
  }
}

// Worried eyebrows over eyes placed as in drawEyes, and a little sweat drop.
export function drawWorry(g, { x, y, scale = 1 }) {
  g.strokeStyle = INK;
  g.lineWidth = 10 * scale;
  for (const side of [-1, 1]) {
    g.beginPath();
    g.moveTo(MID + side * (x + 38 * scale), y - 78 * scale);
    g.lineTo(MID + side * (x - 30 * scale), y - 96 * scale);
    g.stroke();
  }
  g.beginPath();
  g.moveTo(420, 150);
  g.quadraticCurveTo(446, 196, 420, 204);
  g.quadraticCurveTo(394, 196, 420, 150);
  g.fillStyle = '#8fd8ff';
  g.fill();
}

// One texture per expression, drawn by `draw(g, expression)`.
export function expressionTextures(draw, size = SIZE) {
  const textures = {};
  for (const [name, face] of Object.entries(EXPRESSIONS)) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const g = canvas.getContext('2d');
    g.scale(size / SIZE, size / SIZE);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    draw(g, face);
    textures[name] = new THREE.CanvasTexture(canvas);
    textures[name].colorSpace = THREE.SRGBColorSpace;
    textures[name].anisotropy = 4;
  }
  return textures;
}

// A flat picture for the menus, drawn by `draw(g, expression)` in the same 512 square.
export function pictureURL(draw, size = 160) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d');
  g.scale(size / SIZE, size / SIZE);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  draw(g);
  return canvas.toDataURL();
}
