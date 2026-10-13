import * as THREE from 'three';

// Three flat shades instead of a smooth gradient: the cartoon look.
const ramp = new THREE.DataTexture(new Uint8Array([150, 215, 255]), 3, 1, THREE.RedFormat);
ramp.minFilter = ramp.magFilter = THREE.NearestFilter;
ramp.needsUpdate = true;

export const toon = (color, options = {}) => new THREE.MeshToonMaterial({ color, gradientMap: ramp, ...options });

// Draws a dark line around a mesh by adding a slightly bigger, inside-out copy.
// `size` is the rough radius of the mesh's geometry, which must be centred.
export function addOutline(mesh, material, size, thickness = 0.006) {
  const shell = new THREE.Mesh(mesh.geometry, material);
  shell.scale.setScalar(1 + thickness / size);
  mesh.add(shell);
  return mesh;
}
