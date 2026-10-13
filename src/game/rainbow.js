import * as THREE from 'three';
import { makeCloud } from './clouds.js';

const BANDS = [0xff6b8b, 0xffa94d, 0xffe066, 0x7be495, 0x66c7ff, 0xb48cff];

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform float reveal;
  uniform float fade;
  uniform float time;
  uniform vec3 bands[6];
  varying vec2 vUv;
  void main() {
    vec2 p = vec2((vUv.x - 0.5) * 2.0, vUv.y);
    float band = (1.0 - length(p)) / 0.3; // 0 at the outer edge, 1 at the inner edge
    if (band < 0.0 || band > 1.0) discard;
    float along = atan(p.y, -p.x) / 3.14159265; // 0 at the left foot, 1 at the right foot
    float shown = 1.0 - smoothstep(reveal - 0.03, reveal, along);
    vec3 color = bands[int(min(band * 6.0, 5.0))];
    float edge = smoothstep(0.0, 0.07, band) * smoothstep(1.0, 0.93, band);
    float shimmer = 0.92 + 0.08 * sin(along * 70.0 - time * 3.0);
    gl_FragColor = vec4(color * shimmer, edge * shown * fade * 0.9);
    #include <colorspace_fragment>
  }
`;

// A rainbow that draws itself from left to right, with a cloud at each foot.
export class Rainbow extends THREE.Group {
  constructor(radius = 1.9) {
    super();
    this.uniforms = {
      reveal: { value: 0 },
      fade: { value: 0 },
      time: { value: 0 },
      bands: { value: BANDS.map((color) => new THREE.Color(color)) },
    };
    this.arc = new THREE.Mesh(
      new THREE.PlaneGeometry(radius * 2, radius),
      new THREE.ShaderMaterial({
        uniforms: this.uniforms,
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    this.arc.position.y = radius / 2;
    this.clouds = [-1, 1].map((side) => {
      const cloud = makeCloud(1.1);
      cloud.position.set(side * radius * 0.85, 0.05, 0.1);
      return cloud;
    });
    this.add(this.arc, ...this.clouds);
    this.shown = false;
    this.visible = false;
  }

  show() {
    if (this.shown) return;
    this.shown = true;
    this.visible = true;
    this.uniforms.reveal.value = 0;
  }

  hide() {
    this.shown = false;
  }

  update(dt, t) {
    if (!this.visible) return;
    const { reveal, fade, time } = this.uniforms;
    time.value = t;
    if (this.shown) reveal.value = Math.min(1.05, reveal.value + dt * 0.9);
    fade.value = THREE.MathUtils.clamp(fade.value + (this.shown ? dt * 3 : -dt * 2), 0, 1);
    // The left cloud arrives first, the right one when the rainbow lands on it.
    this.clouds[0].scale.setScalar(1.1 * fade.value);
    this.clouds[1].scale.setScalar(1.1 * fade.value * THREE.MathUtils.smoothstep(reveal.value, 0.85, 1));
    this.clouds.forEach((cloud, i) => (cloud.position.y = 0.05 + Math.sin(t * 1.1 + i * 2) * 0.03));
    if (!this.shown && fade.value === 0) this.visible = false;
  }
}
