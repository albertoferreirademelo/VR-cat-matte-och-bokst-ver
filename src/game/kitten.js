import * as THREE from 'three';
import { toon, addOutline } from './toon.js';
import { makeFaceTextures } from './faces.js';
import { buildAccessory, disposeAccessory } from './accessories.js';
import { CAT_COLORS, DEFAULT_LOOK } from '../cats.js';

const unitBall = new THREE.SphereGeometry(1, 28, 20);
const FACE_ANGLE = THREE.MathUtils.degToRad(55);
const HEAD_Y = 0.105; // head centre above the neck
const HEAD_HEIGHT = 0.38; // head centre above the feet

const arc = (p, from, to) => (p <= from || p >= to ? 0 : Math.sin((Math.PI * (p - from)) / (to - from)));
const ramp = (p, from, to) => THREE.MathUtils.smoothstep(p, from, to);
const beat = (p, times) => Math.sin(p * Math.PI * 2 * times);

function jump(p, pose, height) {
  pose.squash += arc(p, 0, 0.16) * 0.2 - arc(p, 0.16, 0.72) * 0.12 + arc(p, 0.72, 0.9) * 0.16;
  pose.y += arc(p, 0.16, 0.72) * height;
}

// Each move changes the resting pose over its length; `p` runs from 0 to 1.
// Arms are [raise sideways, swing forward] in radians.
const MOVES = {
  wave: {
    length: 1.7,
    pose(p, o) {
      o.armL = [2.5 + beat(p, 4.5) * 0.35, 0];
      o.headRoll += 0.14;
      o.y += Math.abs(beat(p, 2)) * 0.012;
      o.face = 'happy';
    },
  },
  hop: {
    length: 1,
    pose(p, o) {
      jump(p, o, 0.17);
      o.armL = o.armR = [2.7, 0];
      o.face = 'happy';
    },
  },
  spin: {
    length: 1.1,
    pose(p, o) {
      jump(p, o, 0.16);
      o.turn += ramp(p, 0.14, 0.76) * Math.PI * 2;
      o.armL = o.armR = [1.5, 0];
      o.face = 'star';
    },
  },
  flip: {
    length: 1.2,
    pose(p, o) {
      jump(p, o, 0.27);
      o.flip -= ramp(p, 0.16, 0.72) * Math.PI * 2;
      o.armL = o.armR = [2.3, 0];
      o.face = 'star';
    },
  },
  clap: {
    length: 1.3,
    pose(p, o) {
      const together = Math.abs(beat(p, 3.5));
      o.armL = o.armR = [-0.38 + together * 0.4, 1.35];
      o.y += (1 - together) * 0.018;
      o.headRoll += beat(p, 1.75) * 0.1;
      o.face = 'happy';
    },
  },
  dance: {
    length: 1.4,
    pose(p, o) {
      const sway = beat(p, 2);
      o.lean += sway * 0.22;
      o.y += Math.abs(sway) * 0.035;
      o.turn += beat(p, 1) * 0.35;
      o.armL = [1.5 + sway * 1.1, 0];
      o.armR = [1.5 - sway * 1.1, 0];
      o.headRoll -= sway * 0.16;
      o.face = 'happy';
    },
  },
  love: {
    length: 1.4,
    pose(p, o) {
      o.lean += beat(p, 2) * 0.14;
      o.headRoll += beat(p, 2) * 0.1;
      o.armL = o.armR = [0.15, 1.55];
      o.face = 'heart';
    },
  },
  // Sad for a moment, then a wink and a paw in the air: "you can do it".
  oops: {
    length: 2.2,
    pose(p, o) {
      if (p < 0.45) {
        o.droop = 1;
        o.headPitch += 0.3;
        o.squash += 0.05;
        o.armL = o.armR = [0.12, 0];
        o.face = 'worried';
      } else {
        o.armL = [2.5, 0];
        o.y += Math.abs(beat(p, 3)) * 0.02;
        o.headRoll -= 0.14;
        o.face = 'wink';
      }
    },
  },
};

const HAPPY_FACES = ['happy', 'star', 'heart', 'wink'];

// An upright cartoon kitten. It stands on y = 0 and faces +z.
export class Kitten extends THREE.Group {
  constructor(look = DEFAULT_LOOK) {
    super();
    this.materials = {
      fur: toon(0xffffff),
      light: toon(0xffffff),
      dark: toon(0xffffff),
      pink: toon(0xff9ecb),
      collar: toon(0xff4f9a),
      gold: toon(0xffd166),
      ink: new THREE.MeshBasicMaterial({ side: THREE.BackSide }),
    };
    const { fur, light, dark, pink, collar, gold, ink } = this.materials;

    const ball = (parent, material, radius, x, y, z, stretch = [1, 1, 1], outline = true) => {
      const mesh = new THREE.Mesh(unitBall, material);
      mesh.position.set(x, y, z);
      mesh.scale.set(radius * stretch[0], radius * stretch[1], radius * stretch[2]);
      if (outline) addOutline(mesh, ink, radius);
      parent.add(mesh);
      return mesh;
    };
    const limb = (parent, material, radius, length, y) => {
      const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 6, 14), material);
      mesh.position.y = y;
      addOutline(mesh, ink, radius);
      parent.add(mesh);
      return mesh;
    };

    // rig: jump and squash, from the feet. core: turn, flip and lean, around the tummy.
    this.rig = new THREE.Group();
    this.core = new THREE.Group();
    this.core.position.y = 0.2;
    const model = new THREE.Group();
    model.position.y = -0.2;
    this.add(this.rig);
    this.rig.add(this.core);
    this.core.add(model);

    for (const side of [-1, 1]) {
      const leg = new THREE.Group();
      leg.position.set(side * 0.046, 0, 0);
      limb(leg, fur, 0.036, 0.03, 0.052);
      ball(leg, light, 0.042, 0, 0.024, 0.024, [1, 0.6, 1.3]);
      model.add(leg);
    }
    ball(model, fur, 0.1, 0, 0.165, 0, [1, 1.15, 0.92]);
    ball(model, light, 0.07, 0, 0.152, 0.036, [1, 1.15, 0.8], false);

    const band = new THREE.Mesh(new THREE.TorusGeometry(0.064, 0.012, 8, 24), collar);
    band.position.y = 0.264;
    band.rotation.x = Math.PI / 2;
    model.add(band);
    ball(model, gold, 0.017, 0, 0.246, 0.072);

    this.arms = [1, -1].map((side) => {
      const arm = new THREE.Group();
      arm.position.set(side * 0.09, 0.236, 0);
      limb(arm, fur, 0.027, 0.065, -0.05);
      ball(arm, light, 0.031, 0, -0.098, 0);
      model.add(arm);
      return arm;
    });

    // The tail is a chain of segments, so a wave can travel along it.
    this.tail = [];
    let parent = model;
    for (let i = 0; i < 5; i++) {
      const segment = new THREE.Group();
      if (i === 0) segment.position.set(0, 0.085, -0.075);
      else segment.position.y = 0.05;
      limb(segment, i === 4 ? light : i % 2 ? dark : fur, 0.022 - i * 0.0015, 0.03, 0.025);
      parent.add(segment);
      this.tail.push(segment);
      parent = segment;
    }

    this.head = new THREE.Group();
    this.head.position.y = 0.275;
    this.head.rotation.order = 'YXZ';
    model.add(this.head);
    ball(this.head, fur, 0.13, 0, HEAD_Y, 0, [1.12, 1, 1]);

    this.face = new THREE.Mesh(
      new THREE.SphereGeometry(
        1,
        24,
        16,
        Math.PI / 2 - FACE_ANGLE,
        FACE_ANGLE * 2,
        Math.PI / 2 - FACE_ANGLE,
        FACE_ANGLE * 2,
      ),
      new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }),
    );
    this.face.position.y = HEAD_Y;
    this.face.scale.set(0.1306 * 1.12, 0.1306, 0.1306);
    this.head.add(this.face);
    ball(this.head, pink, 0.014, 0, HEAD_Y - 0.027, 0.129, [1.2, 0.85, 1], false);

    const earShape = new THREE.ConeGeometry(0.058, 0.115, 20);
    this.ears = [1, -1].map((side) => {
      const ear = new THREE.Group();
      ear.position.set(side * 0.08, HEAD_Y + 0.09, 0);
      ear.userData.side = side;
      const outer = new THREE.Mesh(earShape, fur);
      outer.position.y = 0.045;
      outer.scale.z = 0.6;
      addOutline(outer, ink, 0.058);
      const inner = new THREE.Mesh(earShape, pink);
      inner.position.set(0, 0.04, 0.014);
      inner.scale.set(0.6, 0.7, 0.4);
      ear.add(outer, inner);
      this.head.add(ear);
      return ear;
    });

    // Fluffy cheeks.
    const tuft = new THREE.ConeGeometry(0.03, 0.07, 10);
    for (const side of [-1, 1]) {
      for (const [y, tilt, size] of [
        [0.085, 0.25, 1],
        [0.055, 0.6, 0.8],
      ]) {
        const fluff = new THREE.Mesh(tuft, fur);
        fluff.position.set(side * 0.138, y, 0.012);
        fluff.rotation.z = -side * (Math.PI / 2 + tilt);
        fluff.scale.set(size, size, size * 0.7);
        addOutline(fluff, ink, 0.03);
        this.head.add(fluff);
      }
    }

    this.mount = new THREE.Group();
    this.mount.position.y = HEAD_Y;
    this.head.add(this.mount);

    this.look = null;
    this.textures = null;
    this.worn = null;
    this.wearing = null;
    this.move = null;
    this.party = false;
    this.partyOutfit = 'party';
    this.gaze = null;
    this.blink = 2;
    this.twitch = { ear: 0, time: 3 };
    // Smoothed pose values, so moves blend into each other.
    this.smooth = { yaw: 0, pitch: 0, roll: 0, lean: 0, droop: 0, armL: [0.3, 0], armR: [0.3, 0] };
    this.target = new THREE.Vector3();
    this.setLook(look);
  }

  setLook({ color, accessory }) {
    if (this.look?.color !== color) {
      const colors = CAT_COLORS[color] ?? CAT_COLORS[DEFAULT_LOOK.color];
      this.materials.fur.color.set(colors.fur);
      this.materials.light.color.set(colors.light);
      this.materials.dark.color.set(colors.dark);
      this.materials.ink.color.set(colors.dark).multiplyScalar(0.35);
      if (this.textures) Object.values(this.textures).forEach((texture) => texture.dispose());
      this.textures = makeFaceTextures(colors);
      this.face.material.map = this.textures.open;
      this.face.material.needsUpdate = true;
    }
    this.look = { color, accessory };
    this.wear(this.party ? this.partyOutfit : accessory);
  }

  wear(id) {
    if (this.wearing === id) return;
    if (this.worn) {
      this.mount.remove(this.worn);
      disposeAccessory(this.worn);
    }
    this.worn = buildAccessory(id);
    this.wearing = id;
    if (this.worn) this.mount.add(this.worn);
  }

  play(name) {
    this.move = { name, time: 0 };
  }

  // A party is a dance that keeps going, in a party hat or another outfit to show off.
  setParty(on, outfit = 'party') {
    this.party = on;
    this.partyOutfit = outfit;
    this.wear(on ? outfit : this.look.accessory);
  }

  // A point in the world to watch, or null to face forward.
  watch(point) {
    this.gaze = point;
  }

  headPosition(target = new THREE.Vector3()) {
    return this.face.getWorldPosition(target);
  }

  update(dt, t) {
    const pose = {
      y: 0,
      squash: Math.sin(t * 2.4) * 0.012,
      turn: 0,
      flip: 0,
      lean: 0,
      headYaw: 0,
      headPitch: 0,
      headRoll: Math.sin(t * 0.9) * 0.04,
      armL: [0.3 + Math.sin(t * 2.4) * 0.03, 0],
      armR: [0.3 + Math.sin(t * 2.4) * 0.03, 0],
      droop: 0,
      face: null,
    };

    let gazeYaw = 0;
    let gazePitch = 0;
    if (this.gaze) {
      const local = this.worldToLocal(this.target.copy(this.gaze));
      gazeYaw = THREE.MathUtils.clamp(Math.atan2(local.x, local.z), -0.75, 0.75);
      gazePitch = -THREE.MathUtils.clamp(Math.atan2(local.y - HEAD_HEIGHT, Math.hypot(local.x, local.z)), -0.3, 0.6);
    }

    if (this.party) MOVES.dance.pose((t % MOVES.dance.length) / MOVES.dance.length, pose);
    if (this.move) {
      const move = MOVES[this.move.name];
      this.move.time += dt;
      if (this.move.time >= move.length) this.move = null;
      else move.pose(this.move.time / move.length, pose);
    }

    const s = this.smooth;
    const k = Math.min(1, dt * 12);
    s.yaw += (gazeYaw - s.yaw) * Math.min(1, dt * 6);
    s.pitch += (gazePitch + pose.headPitch - s.pitch) * Math.min(1, dt * 6);
    s.roll += (pose.headRoll - s.roll) * k;
    s.lean += (pose.lean - s.lean) * k;
    s.droop += (pose.droop - s.droop) * k;
    for (const arm of ['armL', 'armR']) {
      s[arm][0] += (pose[arm][0] - s[arm][0]) * k;
      s[arm][1] += (pose[arm][1] - s[arm][1]) * k;
    }

    this.rig.position.y = pose.y;
    this.rig.scale.set(1 + pose.squash * 0.6, 1 - pose.squash, 1 + pose.squash * 0.6);
    // The body follows the gaze a little; the head does the rest.
    this.core.rotation.set(pose.flip, s.yaw * 0.35 + pose.turn, s.lean);
    this.head.rotation.set(s.pitch, s.yaw * 0.65, s.roll);
    this.arms[0].rotation.set(-s.armL[1], 0, s.armL[0]);
    this.arms[1].rotation.set(-s.armR[1], 0, -s.armR[0]);

    this.twitch.time -= dt;
    if (this.twitch.time < 0) this.twitch = { ear: Math.random() < 0.5 ? 0 : 1, time: 2.5 + Math.random() * 4 };
    this.ears.forEach((ear, i) => {
      const flick = this.twitch.ear === i && this.twitch.time < 0.25 ? Math.sin(this.twitch.time * 50) * 0.18 : 0;
      ear.rotation.z = -ear.userData.side * (0.36 + s.droop * 0.85) + flick;
      ear.rotation.x = s.droop * 0.3;
    });

    const happy = HAPPY_FACES.includes(pose.face);
    const speed = happy ? 9 : 2.6;
    this.tail.forEach((segment, i) => {
      segment.rotation.x = (i === 0 ? -1.25 : 0.36) + Math.sin(t * 1.3 - i * 0.5) * 0.07;
      segment.rotation.z = Math.sin(t * speed - i * 0.7) * (happy ? 0.22 : 0.16);
    });

    this.blink -= dt;
    if (this.blink < 0) this.blink = 2 + Math.random() * 3;
    const resting = this.blink < 0.13 ? 'blink' : this.gaze ? 'up' : 'open';
    const texture = this.textures[pose.face ?? resting];
    if (this.face.material.map !== texture) this.face.material.map = texture;
  }
}
