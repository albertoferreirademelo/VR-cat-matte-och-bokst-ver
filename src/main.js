import '@fontsource-variable/fredoka';
import * as THREE from 'three';
import { Game } from './game/game.js';
import { Backdrop } from './game/backdrop.js';
import { starShape, puffy } from './game/shapes.js';
import { Menu } from './ui/menu.js';
import { DECKS } from './decks/index.js';
import { save } from './profiles.js';
import { unlockAudio, sfx } from './audio.js';
import { sv } from './i18n/sv.js';
import { creatureOf } from './wardrobe/look.js';
import { detectXRMode, requestGameXR } from './xr.js';

// Text is drawn onto canvases, so the font has to be there before anything is built.
await Promise.race([
  document.fonts.load('700 48px "Fredoka Variable"'),
  new Promise((resolve) => setTimeout(resolve, 2500)),
]);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearAlpha(0);
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
document.body.prepend(renderer.domElement);
const canvas = renderer.domElement;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.05, 80);

scene.add(new THREE.HemisphereLight(0xffffff, 0xc9b3ff, 1.9));
const sun = new THREE.DirectionalLight(0xffffff, 1.7);
sun.position.set(1.5, 3, 2.5);
scene.add(sun);

// The sky world, hidden when the headset shows the real room instead.
const backdrop = new Backdrop();
scene.add(backdrop);

const game = new Game(scene, camera, { onExit: exit, onSave: save });
const menu = new Menu(document.getElementById('menu'), {
  onStart: start,
  onPreview: (look, move) => game.showcase(look, move),
});
if (import.meta.env.DEV) Object.assign(window, { game, camera, menu });
const exitButton = document.getElementById('exit');
exitButton.textContent = sv.exit;
exitButton.addEventListener('click', exit);

// --- Camera on a screen ------------------------------------------------------

let view = 'menu';

// In the menus the camera visits the pet, shifted so it stands beside the card.
function menuCamera() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const wide = width >= height;
  const spot = game.perch.position;
  const yaw = Math.atan2(-spot.x, -spot.z);
  const distance = wide ? 1.9 : 4.2;
  camera.fov = 38;
  camera.position.set(spot.x + Math.sin(yaw) * distance, 0.95, spot.z + Math.cos(yaw) * distance);
  camera.lookAt(spot.x, 0.9, spot.z);
  if (wide) camera.setViewOffset(width, height, width * 0.24, 0, width, height);
  else camera.setViewOffset(width, height, 0, height * 0.3, width, height);
}

// In the game the camera stands where a child's head would be in the headset.
// On a narrow window the view widens so all balloons stay on screen.
function gameCamera() {
  camera.clearViewOffset();
  const needed = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(38)) / camera.aspect));
  camera.fov = THREE.MathUtils.clamp(needed, 60, 100);
  camera.position.set(0, 1.4, 0.9);
  camera.lookAt(0, 1.4, -2);
}

function fitCamera() {
  camera.aspect = window.innerWidth / window.innerHeight;
  if (view === 'menu') menuCamera();
  else gameCamera();
  camera.updateProjectionMatrix();
}
fitCamera();

window.addEventListener('resize', () => {
  if (renderer.xr.isPresenting) return;
  renderer.setSize(window.innerWidth, window.innerHeight);
  fitCamera();
});

// --- Starting and stopping ---------------------------------------------------

// Passthrough when the headset offers it, otherwise ordinary VR.
let xrMode = null;
async function detectXR() {
  const available = Boolean(window.isSecureContext && navigator.xr);
  menu.setXRAvailable(available);
  if (!available) return;
  xrMode = await detectXRMode(navigator.xr);
  if (xrMode) menu.setXRSupported(true);
}
detectXR();

async function start(profile, level, useXR) {
  unlockAudio();
  view = 'game';
  fitCamera();
  if (useXR) {
    try {
      const session = await requestGameXR(navigator.xr, xrMode);
      session.addEventListener('end', backToMenu);
      await renderer.xr.setSession(session);
      backdrop.visible = session.environmentBlendMode === 'opaque';
      menu.setXRSupported(true);
    } catch (error) {
      console.error(error);
      view = 'menu';
      fitCamera();
      menu.showError(error.name === 'NotSupportedError' ? sv.xrUnavailable : sv.xrFailed);
      return;
    }
  } else {
    exitButton.hidden = false;
    canvas.classList.add('playing');
  }
  menu.hide();
  game.start(DECKS[profile.track], profile, level);
}

function exit() {
  const session = renderer.xr.getSession();
  if (session) session.end();
  else backToMenu();
}

function backToMenu() {
  exitButton.hidden = true;
  canvas.classList.remove('playing');
  backdrop.visible = true;
  view = 'menu';
  fitCamera();
  menu.show();
}

// --- Pointing and shooting -------------------------------------------------

const raycaster = new THREE.Raycaster();
const rotation = new THREE.Matrix4();
const BEAM_LENGTH = 4;
const starTip = puffy(starShape(0.032, 0.015), 0.004, 0.006);

function makeWand() {
  const wand = new THREE.Group();
  const stick = new THREE.Mesh(
    new THREE.CylinderGeometry(0.007, 0.009, 0.22, 8).rotateX(Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x8b3fd9, roughness: 0.4 }),
  );
  stick.position.z = -0.11;
  const star = new THREE.Mesh(starTip, new THREE.MeshBasicMaterial({ color: 0xffd166 }));
  star.position.z = -0.25;
  const beam = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -1)]),
    new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 }),
  );
  beam.scale.z = BEAM_LENGTH;
  wand.add(stick, star, beam);
  wand.userData = { beam, star };
  return wand;
}

const controllers = [0, 1].map((index) => {
  const controller = renderer.xr.getController(index);
  const wand = makeWand();
  controller.add(wand);
  Object.assign(controller.userData, wand.userData, { flash: 0 });
  controller.addEventListener('connected', (event) => (controller.userData.source = event.data));
  controller.addEventListener('disconnected', () => (controller.userData.source = null));
  controller.addEventListener('selectstart', () => {
    aimFromController(controller);
    controller.userData.flash = 1;
    controller.userData.source?.gamepad?.hapticActuators?.[0]?.pulse?.(0.5, 50);
    shoot(raycaster.ray.origin);
  });
  scene.add(controller);
  return controller;
});

function aimFromController(controller) {
  rotation.extractRotation(controller.matrixWorld);
  raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
  raycaster.ray.direction.set(0, 0, -1).applyMatrix4(rotation);
}

const firstHit = () => raycaster.intersectObjects(game.targets(), false)[0];
const sparkleStart = new THREE.Vector3();
const sparkleAim = new THREE.Vector3();

// Shoots along the ray the raycaster is set to. Sparkles fly from `from` to where it lands.
function shoot(from) {
  sfx.zap();
  const hit = firstHit();
  const reach = hit ? hit.distance : 2.5;
  raycaster.ray.at(reach, sparkleAim);
  sparkleStart.copy(from);
  const length = sparkleStart.distanceTo(sparkleAim);
  game.effects.zap(sparkleStart, sparkleAim.sub(sparkleStart).normalize(), length);
  if (hit) game.hit(hit.object);
}

const mouse = new THREE.Vector2();
const TRICKS = ['hop', 'spin', 'flip', 'dance', 'clap', 'wave'];
let mouseInside = false;
function trackMouse(event) {
  mouse.set((event.clientX / window.innerWidth) * 2 - 1, -(event.clientY / window.innerHeight) * 2 + 1);
  mouseInside = true;
}
canvas.addEventListener('pointermove', trackMouse);
canvas.addEventListener('pointerleave', () => (mouseInside = false));
canvas.addEventListener('pointerdown', (event) => {
  if (renderer.xr.isPresenting) return;
  if (view === 'menu') {
    // Tapping the pet in the menu makes it do a trick.
    unlockAudio();
    sfx[creatureOf(game.pet.look).sound]();
    game.pet.play(TRICKS[Math.floor(Math.random() * TRICKS.length)]);
    return;
  }
  trackMouse(event);
  raycaster.setFromCamera(mouse, camera);
  // On a screen the sparkles come from the lower right, as if from a wand in your hand.
  shoot(camera.localToWorld(new THREE.Vector3(0.22, -0.2, -0.5)));
});

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !exitButton.hidden) exit();
});

// --- Frame loop ------------------------------------------------------------

const hovered = new Set();
let last = 0;
renderer.setAnimationLoop((time) => {
  const t = time / 1000;
  const dt = Math.min(t - last, 0.1);
  last = t;

  hovered.clear();
  if (renderer.xr.isPresenting) {
    for (const controller of controllers) {
      if (!controller.visible) continue;
      aimFromController(controller);
      const hit = firstHit();
      if (hit) hovered.add(hit.object);
      const data = controller.userData;
      data.flash = Math.max(0, data.flash - dt * 5);
      data.beam.scale.z = hit ? hit.distance : BEAM_LENGTH;
      data.beam.material.opacity = 0.35 + 0.65 * data.flash;
      data.star.rotation.z = t * 2.5;
      data.star.scale.setScalar(1 + data.flash * 0.8);
    }
  } else if (mouseInside && view === 'game') {
    raycaster.setFromCamera(mouse, camera);
    const hit = firstHit();
    if (hit) hovered.add(hit.object);
  }
  game.setHover(hovered);

  backdrop.update(dt, t);
  game.update(dt, t);
  renderer.render(scene, camera);
});
