import * as THREE from 'three';

export function starShape(outer, inner = outer * 0.5, points = 5) {
  const shape = new THREE.Shape();
  for (let i = 0; i < points * 2; i++) {
    const radius = i % 2 ? inner : outer;
    const angle = (i / (points * 2)) * Math.PI * 2 + Math.PI / 2;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}

// Point down, about 1.7 × size wide.
export function heartShape(size) {
  const s = size;
  const shape = new THREE.Shape();
  shape.moveTo(0, -s * 0.9);
  shape.bezierCurveTo(-s * 1.4, -s * 0.05, -s * 0.85, s, 0, s * 0.4);
  shape.bezierCurveTo(s * 0.85, s, s * 1.4, -s * 0.05, 0, -s * 0.9);
  return shape;
}

// A flat shape blown up into a soft, pillow-like solid.
export function puffy(shape, depth, bevel) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel * 0.85,
    bevelSegments: 6,
    curveSegments: 20,
  });
  geometry.center();
  return geometry;
}
