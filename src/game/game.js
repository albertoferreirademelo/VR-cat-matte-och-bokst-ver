import * as THREE from 'three';
import { Balloon, BALLOON_COLORS, shapeFor } from './balloon.js';
import { Pet } from '../wardrobe/creatures/index.js';
import { Effects } from './effects.js';
import { Rainbow } from './rainbow.js';
import { StarRow } from './hud.js';
import { makeCloud } from './clouds.js';
import { starShape, puffy } from './shapes.js';
import { Spring, Tweens, ease } from './motion.js';
import { Board, BOARD_STYLES } from '../ui/board.js';
import { Session } from '../learner.js';
import { sfx, say, loadClip } from '../audio.js';
import { sv } from '../i18n/sv.js';
import { DEFAULT_LOOK, creatureOf, partyLook } from '../wardrobe/look.js';
import { nameOf } from '../wardrobe/catalog.js';
import { updateUnlocks } from '../wardrobe/unlocks.js';
import { payRound } from '../wardrobe/shop.js';

// Everything is placed around a player standing at the origin and looking along -z.
const TOP_Y = 2.3;
const BOTTOM_Y = 1.35;
const REST_Y = 1.72; // where balloons wait in games without a time limit
const REPEAT_AFTER = 7; // seconds until a spoken question is said again
const DISTANCE = 2;
const SPREAD = 0.36; // radians between two balloons
// Where the right balloon floats to after a miss, so the answer is easy to see.
const ANSWER_SPOT = new THREE.Vector3(0, 1.85, -1.75);

const GREEN = '#1b8a4b';
const CELEBRATIONS = ['hop', 'spin', 'flip', 'clap', 'dance', 'love'];
const STREAKS = [3, 5, 7, 10];

const pick = (list) => list[Math.floor(Math.random() * list.length)];
const angleToPlayer = (position) => Math.atan2(-position.x, -position.z);
const facePlayer = (object) => {
  object.rotation.y = angleToPlayer(object.position);
};

export class Game {
  constructor(scene, camera, { onExit, onSave }) {
    this.camera = camera;
    this.onExit = onExit;
    this.onSave = onSave;
    this.state = 'idle'; // idle | showcase | asking | feedback | results
    this.balloons = [];
    this.streak = 0;
    this.tweens = new Tweens();
    this.cameraPosition = new THREE.Vector3();
    this.gaze = new THREE.Vector3();

    this.root = new THREE.Group();
    this.root.visible = false;
    scene.add(this.root);

    // The pet on its own little cloud.
    this.perch = new THREE.Group();
    this.perch.position.set(-0.62, 0.5, -1.5);
    facePlayer(this.perch);
    const seat = makeCloud(0.75);
    seat.position.y = -0.13;
    this.pet = new Pet();
    this.pet.scale.setScalar(1.15);
    this.perch.add(seat, this.pet);

    // Everything that belongs to a round, hidden while the menu is open.
    this.stage = new THREE.Group();

    this.sign = new Board(0.8, 0.4, BOARD_STYLES.sign);
    this.sign.position.set(0.3, 0.92, -1.6);
    facePlayer(this.sign);
    this.signSize = new Spring(1, 320, 14);
    // Shooting the sign says a spoken question again.
    this.sign.userData.onHit = () => this.sayQuestion();

    this.cheer = this.makeBanner(BOARD_STYLES.cheer, 0.78, 0.36);
    this.note = this.makeBanner(BOARD_STYLES.note, 0.62, 0.2);
    this.banners = [this.cheer, this.note];

    this.stars = new StarRow();
    this.stars.position.set(0.3, 0.66, -1.6);
    facePlayer(this.stars);

    // Balloons drift down out of these clouds.
    this.clouds = [-0.62, -0.2, 0.22, 0.62].map((angle, i) => {
      const cloud = makeCloud(1.25 + (i % 2) * 0.25);
      cloud.position.set(Math.sin(angle) * (DISTANCE + 0.05), TOP_Y + 0.22, -Math.cos(angle) * (DISTANCE + 0.05));
      facePlayer(cloud);
      return cloud;
    });

    this.rainbow = new Rainbow(1.9);
    this.rainbow.position.set(0, 0.75, -3);

    this.againButton = this.makeButton(sv.again, -0.45, () => this.restart());
    this.quitButton = this.makeButton(sv.quit, 0.45, () => this.onExit());
    this.buttons = [this.againButton, this.quitButton];

    // The star that flies from a popped balloon to the score row.
    this.flyer = new THREE.Mesh(
      puffy(starShape(0.045, 0.021), 0.006, 0.008),
      new THREE.MeshBasicMaterial({ color: 0xffc93c }),
    );
    this.flyer.visible = false;

    this.effects = new Effects();
    this.stage.add(this.sign, ...this.banners, this.stars, ...this.clouds, this.rainbow, ...this.buttons, this.flyer);
    this.root.add(this.perch, this.stage, this.effects);
  }

  makeBanner(style, width, height) {
    const banner = new Board(width, height, style);
    banner.position.set(0.3, 1.14 + height / 2, -1.58);
    facePlayer(banner);
    banner.userData.size = new Spring(0, 300, 13);
    banner.scale.setScalar(0.0001);
    return banner;
  }

  makeButton(text, x, onHit) {
    const button = new Board(0.7, 0.22, BOARD_STYLES.button);
    button.setText(text);
    button.position.set(x, 1.72, -1.85);
    facePlayer(button);
    button.visible = false;
    button.userData.owner = button;
    button.userData.onHit = onHit;
    button.userData.size = new Spring(0, 300, 14);
    return button;
  }

  // Shows only the pet, for the menus.
  showcase(look = DEFAULT_LOOK, move) {
    if (this.state !== 'showcase') {
      this.endRound();
      this.state = 'showcase';
      this.root.visible = true;
      this.stage.visible = false;
    }
    this.pet.setLook(look);
    if (move) this.pet.play(move);
  }

  start(deck, profile, level) {
    this.deck = deck;
    this.profile = profile;
    this.level = level;
    this.root.visible = true;
    this.stage.visible = true;
    this.pet.setLook(profile.look);
    for (const item of level.items) if (item.sound) loadClip(item.sound);
    this.restart();
  }

  restart() {
    this.endRound();
    this.session = new Session(this.profile, this.deck, this.level);
    this.stars.reset(this.session.length);
    this.sign.setText('');
    this.announce(this.cheer, sv.hello(this.profile.name));
    this.pet.play('wave');
    sfx[creatureOf(this.profile.look).sound]();
    this.state = 'feedback';
    this.timer = 1.9;
  }

  stop() {
    this.endRound();
    this.state = 'idle';
    this.root.visible = false;
  }

  endRound() {
    this.tweens.clear();
    this.effects.clear();
    this.clearBalloons();
    this.streak = 0;
    this.rainbow.hide();
    this.flyer.visible = false;
    this.pet.setParty(false);
    this.pet.watch(null);
    for (const banner of this.banners) banner.userData.size.target = 0;
    for (const button of this.buttons) button.visible = false;
  }

  // Pops up one banner with a text and puts the other one away.
  announce(banner, text) {
    for (const other of this.banners) other.userData.size.target = other === banner ? 1 : 0;
    if (banner) banner.setText(text);
  }

  ask() {
    this.sendBalloonsAway();
    this.announce(null);
    const question = this.session.next();
    this.question = question;
    this.sign.setText(this.deck.ask(question), undefined, { speaker: Boolean(question.sound) });
    this.signSize.value = 0.7;
    this.sayQuestion(0.4);

    const colors = [...BALLOON_COLORS].sort(() => Math.random() - 0.5);
    const shape = shapeFor(this.profile.gear.balloon);
    const count = question.choices.length;
    question.choices.forEach((value, i) => {
      const angle = (i - (count - 1) / 2) * SPREAD;
      const balloon = new Balloon(value, colors[i % colors.length], shape, i * 0.12);
      balloon.place(Math.sin(angle) * DISTANCE, -Math.cos(angle) * DISTANCE);
      balloon.lift = (Math.random() - 0.5) * 0.16;
      balloon.setHeight(TOP_Y);
      balloon.hit.userData.onHit = () => this.resolve(balloon);
      this.balloons.push(balloon);
      this.root.add(balloon);
      this.tweens.after(i * 0.12, () => sfx.bloop());
    });
    this.elapsed = 0;
    this.state = 'asking';
  }

  sayQuestion(delay = 0) {
    if (this.state === 'results' || !this.question?.sound) return;
    say(this.question.sound, delay);
    this.repeatIn = REPEAT_AFTER;
  }

  // `picked` is the balloon the player popped, or null when time ran out.
  resolve(picked) {
    if (this.state !== 'asking') return;
    const question = this.question;
    const correct = picked?.value === question.answer;
    const index = this.session.index;
    this.session.answer(correct, this.elapsed * 1000);
    this.onSave();
    this.streak = correct ? this.streak + 1 : 0;

    for (const balloon of this.balloons) {
      if (balloon === picked && correct) {
        this.effects.pop(balloon.position, balloon.color);
        this.flyStar(balloon.position, index);
        balloon.done = true;
      } else if (balloon === picked) {
        this.effects.puff(balloon.position);
        balloon.mode = 'deflate';
      } else if (balloon.value === question.answer) {
        balloon.mode = 'glow';
        balloon.goal = ANSWER_SPOT;
      } else {
        balloon.mode = 'away';
      }
    }

    this.pet.watch(null);
    this.sign.setText(this.deck.tell(question), correct ? GREEN : undefined);
    this.signSize.value = correct ? 1.25 : 0.9;
    // Hearing it once more with the right answer in view ties the two together.
    if (question.sound) say(question.sound, 0.7);
    if (correct) {
      sfx.pop();
      sfx.correct();
      const onStreak = STREAKS.includes(this.streak);
      const move = onStreak ? 'flip' : pick(CELEBRATIONS);
      this.pet.play(move);
      if (move === 'love') this.effects.hearts(this.pet.headPosition());
      else sfx.boing();
      if (onStreak) sfx.combo();
      this.announce(this.cheer, onStreak ? sv.streak(this.streak) : pick(sv.praise));
      if (this.streak >= STREAKS[0]) this.rainbow.show();
      this.timer = 1.7;
    } else {
      sfx.wrong();
      this.stars.fill(index, false);
      this.rainbow.hide();
      this.pet.play('oops');
      this.announce(this.note, pick(sv.encourage));
      this.timer = 3.2;
    }
    this.state = 'feedback';
  }

  flyStar(from, index) {
    const start = from.clone();
    const end = this.stars.slotPosition(index);
    const middle = start.clone().lerp(end, 0.5).add(new THREE.Vector3(0, 0.45, 0.4));
    const flyer = this.flyer;
    flyer.position.copy(start);
    flyer.visible = true;
    this.tweens.add(
      0.7,
      (p) => {
        const q = 1 - p;
        flyer.position
          .copy(start)
          .multiplyScalar(q * q)
          .addScaledVector(middle, 2 * q * p)
          .addScaledVector(end, p * p);
        flyer.rotation.set(0, angleToPlayer(flyer.position), p * 12);
        flyer.scale.setScalar(1 + Math.sin(p * Math.PI) * 1.2);
        if (Math.random() < 0.6) this.effects.trail(flyer.position);
      },
      {
        ease: ease.inOutQuad,
        delay: 0.12,
        done: () => {
          flyer.visible = false;
          this.stars.fill(index, true);
          this.effects.twinkle(end);
          sfx.ding();
        },
      },
    );
  }

  showResults() {
    this.sendBalloonsAway();
    const { correct, length } = this.session;
    const ratio = correct / length;
    // Anything earned this round is announced, and the pet tries it on for the party.
    const perfect = correct === length;
    const earned = updateUnlocks(this.profile, { perfect });
    const coins = payRound(this.profile, { correct, perfect });
    this.onSave();
    const result = `${sv.result(correct, length)} ${sv.coinsEarned(coins)}`;
    const news = sv.unlocked(earned.map(nameOf));
    this.sign.setText(earned.length ? [result, news] : result);
    this.signSize.value = 1.25;
    this.announce(this.cheer, sv.resultPraise(ratio));
    sfx.fanfare();
    if (earned.length) this.tweens.after(0.9, () => sfx.combo());

    // The party: hat, dance, rainbow, confetti and fireworks.
    this.pet.setParty(true, partyLook(this.profile.look, earned));
    this.rainbow.show();
    this.effects.confettiRain(4.5);
    const rockets = 4 + Math.round(ratio * 6);
    for (let i = 0; i < rockets; i++) {
      this.tweens.after(0.3 + i * 0.5, () => {
        const angle = (Math.random() - 0.5) * 1.5;
        const distance = 2.6 + Math.random() * 0.8;
        this.effects.firework(
          new THREE.Vector3(Math.sin(angle) * distance, 1.9 + Math.random() * 0.8, -Math.cos(angle) * distance),
        );
        sfx.firework();
      });
    }
    this.buttons.forEach((button, i) => {
      this.tweens.after(1.2 + i * 0.15, () => {
        button.userData.size.value = 0;
        button.visible = true;
        sfx.bloop();
      });
    });
    this.state = 'results';
  }

  sendBalloonsAway() {
    for (const balloon of this.balloons) balloon.mode = 'away';
  }

  clearBalloons() {
    for (const balloon of this.balloons) {
      this.root.remove(balloon);
      balloon.dispose();
    }
    this.balloons = [];
  }

  // The meshes a wand or mouse click can hit right now.
  targets() {
    if (this.state === 'asking') {
      const balloons = this.balloons.filter((b) => b.mode === 'fall' && b.age > 0).map((b) => b.hit);
      return this.question.sound ? [...balloons, this.sign] : balloons;
    }
    if (this.state === 'results') return this.buttons.filter((button) => button.visible);
    return [];
  }

  hit(mesh) {
    mesh.userData.onHit?.();
  }

  setHover(meshes) {
    for (const balloon of this.balloons) balloon.hovered = meshes.has(balloon.hit);
    for (const button of this.buttons) button.hovered = meshes.has(button);
    this.sign.hovered = meshes.has(this.sign);
  }

  // The pet watches the balloon you aim at, or else all of them.
  watchBalloons() {
    const falling = this.balloons.filter((balloon) => balloon.mode === 'fall');
    if (falling.length === 0) {
      this.pet.watch(null);
      return;
    }
    const aimed = falling.find((balloon) => balloon.hovered);
    if (aimed) {
      this.gaze.copy(aimed.position);
    } else {
      this.gaze.set(0, 0, 0);
      for (const balloon of falling) this.gaze.addScaledVector(balloon.position, 1 / falling.length);
    }
    this.pet.watch(this.gaze);
  }

  update(dt, t) {
    if (this.state === 'idle') return;
    this.camera.getWorldPosition(this.cameraPosition);
    this.tweens.update(dt);

    if (this.state === 'asking') {
      this.elapsed += dt;
      const timed = this.deck.timed !== false;
      // With a time limit the balloons sink all the way down; without one they come down and wait.
      const progress = timed ? this.elapsed / this.session.pace : ease.outCubic(Math.min(1, this.elapsed / 1.6));
      const y = TOP_Y + ((timed ? BOTTOM_Y : REST_Y) - TOP_Y) * Math.min(progress, 1);
      for (const balloon of this.balloons) if (balloon.mode === 'fall') balloon.setHeight(y);
      this.watchBalloons();
      if (this.question.sound) {
        this.repeatIn -= dt;
        if (this.repeatIn <= 0) this.sayQuestion();
      }
      if (timed && progress >= 1) this.resolve(null);
    } else if (this.state === 'feedback') {
      this.timer -= dt;
      if (this.timer <= 0) {
        if (this.session.done) this.showResults();
        else this.ask();
      }
    }

    for (const balloon of this.balloons) {
      balloon.update(dt, this.cameraPosition);
      if (balloon.done) {
        this.root.remove(balloon);
        balloon.dispose();
      }
    }
    this.balloons = this.balloons.filter((balloon) => !balloon.done);

    this.signSize.target = this.sign.hovered ? 1.12 : 1;
    this.sign.scale.setScalar(this.signSize.update(dt));
    for (const banner of this.banners) {
      banner.scale.setScalar(Math.max(0.0001, banner.userData.size.update(dt)));
      banner.rotation.z = Math.sin(t * 2.4) * 0.03;
    }
    for (const button of this.buttons) {
      const size = button.userData.size;
      size.target = button.hovered ? 1.14 : 1;
      button.scale.setScalar(Math.max(0.0001, size.update(dt)));
    }
    this.clouds.forEach((cloud, i) => (cloud.position.y = TOP_Y + 0.22 + Math.sin(t * 0.8 + i * 1.7) * 0.03));

    this.perch.position.y = 0.5 + Math.sin(t * 1.2) * 0.02;
    this.pet.update(dt, t);
    this.stars.update(dt, t);
    this.rainbow.update(dt, t);
    this.effects.update(dt, this.cameraPosition);
  }
}
