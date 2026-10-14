import * as THREE from 'three';
import { toon, addOutline } from '../../game/toon.js';
import { buildItem, disposeItem } from '../items.js';
import { paintOf } from '../look.js';

const unitBall = new THREE.SphereGeometry(1, 28, 20);
const FACE_ANGLE = THREE.MathUtils.degToRad(55);

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

// An upright cartoon animal that stands on y = 0 and faces +z. This class moves it;
// each creature in this folder builds its own body in `this.model` and sets:
//   head: the group that turns to look around, with the face on it
//   arms, ears, tail: groups the moves swing (ears and tail may be empty)
//   decals: { name: mesh } pictures wrapped on the head; `drawDecals(colors)` makes
//     their textures, { name: { expression: texture } }
//   ownColors(colors): its paw and nose colours, { paws, nose }, for parts left unpainted
//   anchors: { slot: group } where things are worn (see items.js)
//   headHeight: head centre above the feet, for looking at things
export class Creature extends THREE.Group {
  constructor() {
    super();
    this.materials = {
      fur: toon(0xffffff),
      light: toon(0xffffff),
      dark: toon(0xffffff),
      paws: toon(0xffffff),
      nose: toon(0xffffff),
      ink: new THREE.MeshBasicMaterial({ side: THREE.BackSide }),
    };

    // rig: jump and squash, from the feet. core: turn, flip and lean, around the tummy.
    this.rig = new THREE.Group();
    this.core = new THREE.Group();
    this.core.position.y = 0.2;
    this.model = new THREE.Group();
    this.model.position.y = -0.2;
    this.add(this.rig);
    this.rig.add(this.core);
    this.core.add(this.model);

    this.head = null;
    this.arms = [];
    this.ears = [];
    this.tail = [];
    this.decals = {};
    this.anchors = {};
    this.headHeight = 0.38;
    this.earTilt = 0.36; // how far the ears lean out
    this.earDroop = 0.85; // and how much further when sad

    this.colors = null;
    this.painted = null;
    this.textures = null;
    this.worn = [];
    this.wearing = null;
    this.move = null;
    this.dancing = false;
    this.gaze = null;
    this.blink = 2;
    this.twitch = { ear: 0, time: 3 };
    // Smoothed pose values, so moves blend into each other.
    this.smooth = { yaw: 0, pitch: 0, roll: 0, lean: 0, droop: 0, armL: [0.3, 0], armR: [0.3, 0] };
    this.target = new THREE.Vector3();
  }

  ball(parent, material, radius, x, y, z, stretch = [1, 1, 1], outline = true) {
    const mesh = new THREE.Mesh(unitBall, material);
    mesh.position.set(x, y, z);
    mesh.scale.set(radius * stretch[0], radius * stretch[1], radius * stretch[2]);
    if (outline) addOutline(mesh, this.materials.ink, radius);
    parent.add(mesh);
    return mesh;
  }

  limb(parent, material, radius, length, y) {
    const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 6, 14), material);
    mesh.position.y = y;
    addOutline(mesh, this.materials.ink, radius);
    parent.add(mesh);
    return mesh;
  }

  // A picture wrapped around the front of a ball of radius 1, to be scaled onto a part
  // a little bigger than that part.
  decal(parent, name) {
    const mesh = new THREE.Mesh(
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
    parent.add(mesh);
    this.decals[name] = mesh;
    return mesh;
  }

  // Where things in `slot` are worn: the reference head of items.js, moved and scaled.
  anchor(slot, [x, y, z], scale = [1, 1, 1], tilt = [0, 0, 0]) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.scale.set(...scale);
    group.rotation.set(...tilt);
    this.head.add(group);
    this.anchors[slot] = group;
    return group;
  }

  setLook(look) {
    const painted = JSON.stringify(look.paint);
    if (this.painted !== painted) {
      this.painted = painted;
      const colors = paintOf(look);
      const own = this.ownColors(colors);
      colors.paws ??= own.paws;
      colors.nose ??= own.nose;
      this.colors = colors;
      this.materials.fur.color.set(colors.fur);
      this.materials.light.color.set(colors.light);
      this.materials.dark.color.set(colors.dark);
      this.materials.paws.color.set(colors.paws);
      this.materials.nose.color.set(colors.nose);
      this.materials.ink.color.set(colors.dark).multiplyScalar(0.35);
      for (const set of Object.values(this.textures ?? {})) Object.values(set).forEach((texture) => texture.dispose());
      this.textures = this.drawDecals(colors);
      this.showFace('open');
    }
    this.wear(look.wear);
  }

  wear(outfit) {
    const key = JSON.stringify(outfit);
    if (this.wearing === key) return;
    for (const item of this.worn) {
      item.parent.remove(item);
      disposeItem(item);
    }
    this.worn = [];
    for (const [slot, id] of Object.entries(outfit)) {
      const item = this.anchors[slot] && buildItem(id);
      if (!item) continue;
      this.anchors[slot].add(item);
      this.worn.push(item);
    }
    this.wearing = key;
  }

  showFace(expression) {
    for (const [name, mesh] of Object.entries(this.decals)) {
      const texture = this.textures[name][expression];
      if (mesh.material.map === texture) continue;
      // Going from no picture to a picture needs a new shader; swapping pictures does not.
      if (!mesh.material.map) mesh.material.needsUpdate = true;
      mesh.material.map = texture;
    }
  }

  play(name) {
    this.move = { name, time: 0 };
  }

  // A point in the world to watch, or null to face forward.
  watch(point) {
    this.gaze = point;
  }

  headPosition(target = new THREE.Vector3()) {
    return this.decals.face.getWorldPosition(target);
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
      gazePitch = -THREE.MathUtils.clamp(Math.atan2(local.y - this.headHeight, Math.hypot(local.x, local.z)), -0.3, 0.6);
    }

    if (this.dancing) MOVES.dance.pose((t % MOVES.dance.length) / MOVES.dance.length, pose);
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
      ear.rotation.z = -ear.userData.side * (this.earTilt + s.droop * this.earDroop) + flick;
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
    this.showFace(pose.face ?? resting);
  }
}
