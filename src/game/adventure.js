import * as THREE from 'three';
import { Orb } from './orbs.js';
import { Kitten, kittenLook } from './kittens.js';
import { Troll } from './troll.js';
import { makeCloud } from './clouds.js';
import { BALLOON_COLORS } from './balloon.js';
import { Spring, ease } from './motion.js';
import { Board, BOARD_STYLES } from '../ui/board.js';
import { FactPicture } from '../ui/factPicture.js';
import { Session, SPEEDS } from '../learner.js';
import { sfx, music } from '../audio.js';
import { sv } from '../i18n/sv.js';
import { friendOf, rescueFriend } from '../friends.js';
import { updateUnlocks } from '../wardrobe/unlocks.js';
import { nameOf } from '../wardrobe/catalog.js';
import { partyLook } from '../wardrobe/look.js';
import { logRound } from '../stats.js';

// The kitten rescue, how math rounds are played (decks with `adventure: true`).
//
// Molntrollet, a grumpy storm cloud, has blown kittens into bubbles. A round has two parts:
//   1. Rescue: the troll blows bubbles with kittens and answers. Popping the right one frees
//      its kitten, who joins the gang on the cloud bench. With a time limit the bubbles drift
//      back toward the troll, and one not popped in time is slurped back (it comes back later).
//   2. Boss: the troll comes closer and throws storm balls with answers. Shooting the right
//      one sends it back: BONK, the troll loses a heart and lets a kitten go. Three right in a
//      row makes a super shot that takes two hearts. Without hearts the troll turns friendly
//      and gives up the golden bubble with the level's own kitten, kept in the collection.
// Right answers in a row raise the coin combo (×2, ×3). A miss shows the right answer and
// a picture of the fact (see FactPicture). Nothing is ever lost: the round is always won.

const RESCUE_QUESTIONS = 6;
const HEARTS = 5;
const MASTER_HEARTS = 7;
const MAX_BOSS_QUESTIONS = 12; // after this many the troll is too tired to go on
const SUPER_STREAK = 3;
const WIN_BONUS = 3;
const PERFECT_BONUS = 5;

const DISTANCE = 2;
const SPREAD = 0.4; // radians between two answers
const SHIELD = 1.05; // how close storm balls come before they splat
const TROLL_FAR = new THREE.Vector3(0, 2.5, -4.3);
const TROLL_NEAR = new THREE.Vector3(0, 2.15, -3.2);
const ANSWER_SPOT = new THREE.Vector3(0, 1.8, -1.65);
const GOLDEN_SPOT = new THREE.Vector3(0, 1.82, -1.8);
const BENCH = new THREE.Vector3(1.02, 0.44, -1.38);
// The rainbow stands far behind the troll and frames it, instead of cutting through it.
const RAINBOW_SPOT = new THREE.Vector3(0, 0.4, -5.8);
const RAINBOW_SIZE = 1.75;
const SEATS_PER_ROW = 6;
const SEAT_GAP = 0.125;
const GREEN = '#1b8a4b';

const pick = (list) => list[Math.floor(Math.random() * list.length)];
const facePlayer = (object) => (object.rotation.y = Math.atan2(-object.position.x, -object.position.z));

// A path from `from` to `to` that bulges `lift` metres upward in the middle.
function arc(from, to, lift) {
  const a = from.clone();
  const b = to.clone();
  const point = new THREE.Vector3();
  return (p) => point.lerpVectors(a, b, p).setY(point.y + Math.sin(p * Math.PI) * lift);
}

export class Adventure {
  constructor(game) {
    this.game = game;
    this.group = new THREE.Group();
    this.group.visible = false;
    this.orbs = [];
    this.gang = [];
    this.flying = [];
    this.step = 'idle'; // intro | asking | feedback | cutscene | golden | results

    this.troll = new Troll();

    // The cloud bench where rescued kittens sit and cheer.
    this.bench = new THREE.Group();
    this.bench.position.copy(BENCH);
    facePlayer(this.bench);
    this.bench.add(makeCloud(1.2));

    // Kittens rescued and coins earned in this round.
    this.hud = new Board(0.46, 0.13, BOARD_STYLES.note);
    this.hud.position.set(0.3, 0.66, -1.6);
    facePlayer(this.hud);
    this.hudSize = new Spring(1, 320, 12);

    this.picture = new FactPicture(0.5, 0.42);
    this.picture.position.set(-0.42, 1.3, -1.52);
    facePlayer(this.picture);
    this.pictureSize = new Spring(0, 300, 14);
    this.picture.scale.setScalar(0.0001);

    this.trollSpot = new THREE.Vector3();
    this.gaze = new THREE.Vector3();
    this.group.add(this.troll, this.bench, this.hud, this.picture);
    game.stage.add(this.group);
  }

  get timed() {
    return this.session.timed;
  }

  later(seconds, done) {
    this.game.tweens.after(seconds, done);
  }

  begin() {
    const game = this.game;
    this.session = game.session = new Session(game.profile, game.deck, game.level);
    this.master = Boolean(game.level.master);
    this.friend = friendOf(game.deck, game.level);
    this.asked = 0;
    this.bossAsked = 0;
    this.rescued = 0;
    this.coins = 0;
    this.streak = 0;
    this.boss = false;
    this.group.visible = true;
    for (const cloud of game.clouds) cloud.visible = false;
    game.stars.visible = false;
    this.rainbowHome ??= game.rainbow.position.clone();
    game.rainbow.position.copy(RAINBOW_SPOT);
    game.rainbow.scale.setScalar(RAINBOW_SIZE);
    game.state = 'adventure';

    this.troll.reset(this.master ? MASTER_HEARTS : HEARTS, this.master);
    this.troll.position.copy(TROLL_FAR);
    this.troll.scale.setScalar(0.0001);
    facePlayer(this.troll);
    this.updateHud();
    game.sign.setText('');
    game.announce(game.cheer, sv.hello(game.profile.name));
    game.pet.play('wave');
    music.play('rescue');

    this.step = 'intro';
    this.later(0.6, () => {
      this.game.tweens.add(0.7, (p) => this.troll.scale.setScalar(Math.max(0.0001, p)), { ease: ease.outBack });
      this.troll.laugh();
      sfx.giggle();
    });
    this.later(1.7, () => game.announce(game.note, sv.adventure.intro));
    this.later(3.6, () => {
      game.announce(game.cheer, sv.adventure.go);
      game.pet.play('hop');
    });
    this.later(4.4, () => this.ask());
  }

  end() {
    for (const orb of this.orbs) this.dropOrb(orb);
    this.orbs = [];
    for (const kitten of [...this.gang, ...this.flying]) kitten.removeFromParent();
    this.gang = [];
    this.flying = [];
    this.friendKitten?.removeFromParent();
    this.friendKitten = null;
    this.golden = null;
    this.pictureSize.target = 0;
    this.step = 'idle';
    if (this.group.visible) music.stop();
    this.group.visible = false;
    for (const cloud of this.game.clouds) cloud.visible = true;
    this.game.stars.visible = true;
    if (this.rainbowHome) this.game.rainbow.position.copy(this.rainbowHome);
    this.game.rainbow.scale.setScalar(1);
  }

  dropOrb(orb) {
    orb.removeFromParent();
    orb.dispose();
  }

  updateHud() {
    const times = this.multiplier();
    this.hud.setText(`🐱 ${this.rescued}   🪙 ${this.coins}${times > 1 ? `   x${times}` : ''}`);
    this.hudSize.value = 1.25;
  }

  // Coins per right answer: more for a run of right answers in a row.
  multiplier() {
    return this.streak >= 6 ? 3 : this.streak >= 3 ? 2 : 1;
  }

  // --- Questions ---------------------------------------------------------------

  ask() {
    const game = this.game;
    game.announce(null);
    this.pictureSize.target = 0;
    this.boss = this.asked >= RESCUE_QUESTIONS;
    const question = this.session.next();
    this.question = question;
    game.sign.setText(game.deck.ask(question));
    game.signSize.value = 0.7;

    const colors = [...BALLOON_COLORS].sort(() => Math.random() - 0.5);
    const count = question.choices.length;
    question.choices.forEach((value, i) => {
      const angle = (i - (count - 1) / 2) * SPREAD;
      const slot = new THREE.Vector3(Math.sin(angle) * DISTANCE, 1.5 + (i % 2) * 0.16, -Math.cos(angle) * DISTANCE);
      const delay = i * 0.16;
      const orb = this.boss
        ? new Orb('storm', value, { delay })
        : new Orb('bubble', value, { color: colors[i % colors.length], look: kittenLook(), delay });
      orb.slot = slot;
      orb.hit.userData.onHit = () => this.resolve(orb);
      const start = this.boss ? this.troll.hand(1) : this.troll.mouth();
      orb.position.copy(start);
      orb.fly(arc(start, slot, this.boss ? 0.5 : 0.2), 0.75, () => {
        orb.mode = 'float';
        orb.anchor.copy(slot);
      });
      this.orbs.push(orb);
      this.group.add(orb);
      this.later(delay, () => {
        if (this.boss) {
          this.troll.throwBall();
          sfx.whoosh();
        } else {
          this.troll.blow();
          sfx.bloop();
        }
      });
    });
    // The clock starts once the answers have arrived.
    this.elapsed = -0.75 - (count - 1) * 0.16;
    this.step = 'asking';
  }

  // `picked` is the orb shot, or null when time ran out.
  resolve(picked) {
    if (this.step !== 'asking') return;
    const game = this.game;
    const question = this.question;
    const correct = picked?.value === question.answer;
    const before = this.session.pace;
    this.session.answer(correct, Math.max(0, this.elapsed) * 1000, picked?.value ?? null);
    const faster = this.timed && SPEEDS.some((speed) => before > speed && this.session.pace <= speed);
    game.onSave();
    this.asked += 1;
    if (this.boss) this.bossAsked += 1;
    this.streak = correct ? this.streak + 1 : 0;
    this.step = 'feedback';
    game.pet.watch(null);
    game.sign.setText(game.deck.tell(question), correct ? GREEN : undefined);
    game.signSize.value = correct ? 1.25 : 0.9;

    const right = this.orbs.find((orb) => orb.value === question.answer && !orb.done);
    // Storm balls nobody shot in time hit the shield; everything else goes back to the troll.
    for (const orb of this.orbs) {
      if (orb === right || orb === picked) continue;
      if (this.boss && !picked) this.splat(orb);
      else this.sendBack(orb);
    }

    if (correct) {
      this.coins += this.multiplier();
      this.updateHud();
      sfx.correct();
      game.pet.play(pick(['hop', 'spin', 'clap', 'dance', 'flip']));
      this.cheerGang();
      const times = this.multiplier();
      const comboNow = this.streak === 3 || this.streak === 6;
      game.announce(game.cheer, comboNow ? sv.adventure.combo(times) : faster ? sv.faster : pick(sv.praise));
      if (comboNow) sfx.combo();
      if (this.streak >= 3) game.rainbow.show();
      if (this.boss) this.strikeBack(picked);
      else {
        this.freeKitten(picked);
        this.later(1.5, () => this.next());
      }
      return;
    }

    sfx.wrong();
    game.rainbow.hide();
    if (picked) {
      if (this.boss) this.splat(picked);
      else {
        picked.bump();
        this.later(0.7, () => this.sendBack(picked));
      }
    }
    if (right) {
      right.mode = 'goal';
      right.goal = ANSWER_SPOT;
    }
    if (FactPicture.fits(question)) {
      this.picture.show(question);
      this.pictureSize.target = 1;
    }
    game.pet.play('oops');
    for (const kitten of this.gang) kitten.setFace('worried', 1.4);
    game.announce(game.note, pick(sv.encourage));
    this.troll.laugh();
    sfx.giggle();
    this.later(2.6, () => right && this.sendBack(right));
    this.later(3.3, () => this.next());
  }

  next() {
    if (this.step !== 'feedback') return;
    if (this.boss && this.troll.heartCount === 0) return; // the win is already on its way
    if (this.boss && this.bossAsked >= MAX_BOSS_QUESTIONS) this.win(true);
    else if (!this.boss && this.asked >= RESCUE_QUESTIONS) this.toBoss();
    else this.ask();
  }

  // --- What happens to the answers ----------------------------------------------

  // Back to the troll: bubbles are slurped in, storm balls float back up.
  sendBack(orb) {
    if (orb.mode === 'gone' || orb.returning) return;
    orb.returning = true;
    orb.fading = true;
    const to = this.boss ? this.troll.hand(-1) : this.troll.mouth();
    orb.fly(arc(orb.position, to, 0.15), 0.6);
    if (!this.boss) sfx.slurp();
  }

  // A storm ball hits the invisible shield in front of the player.
  splat(orb) {
    this.game.effects.puff(orb.position);
    this.game.effects.ring(orb.position, 0xb388ff, 0.35);
    sfx.splat();
    orb.mode = 'gone';
  }

  // The right bubble pops and its kitten jumps to the bench.
  freeKitten(orb) {
    const game = this.game;
    game.effects.pop(orb.position, orb.material.emissive.getHex());
    sfx.pop();
    const kitten = orb.kitten;
    const start = kitten.getWorldPosition(new THREE.Vector3());
    orb.remove(kitten);
    orb.mode = 'gone';
    this.rescued += 1;
    this.updateHud();
    this.joinGang(kitten, start);
  }

  // The right storm ball turns golden and flies back at the troll.
  strikeBack(orb) {
    const game = this.game;
    const superShot = this.streak >= SUPER_STREAK;
    orb.returning = true;
    orb.material.color.set(superShot ? 0xff4fd8 : 0xffd84a);
    orb.material.emissive.set(superShot ? 0xff4fd8 : 0xffb703);
    orb.material.emissiveIntensity = 0.8;
    const target = this.troll.mouth();
    const path = arc(orb.position, target, 0.25);
    orb.fly(
      (p) => {
        game.effects.trail(orb.position, superShot ? 0xff8fab : 0xffc93c);
        return path(p);
      },
      superShot ? 0.35 : 0.5,
      () => this.bonk(target, superShot),
    );
    sfx.zap();
  }

  bonk(at, superShot) {
    const game = this.game;
    sfx.bonk();
    if (superShot) sfx.power();
    game.effects.firework(at, superShot ? 0xff4fd8 : 0xffc93c);
    const hearts = this.troll.heartCount;
    const left = this.troll.hurt(superShot ? 2 : 1);
    for (let i = left; i < hearts; i++) game.effects.hearts(this.troll.heartPosition(i));
    game.announce(game.cheer, superShot ? sv.adventure.superShot : pick(sv.adventure.hits));
    // Every hit shakes a kitten loose.
    const kitten = new Kitten(kittenLook());
    this.group.add(kitten);
    this.rescued += 1;
    this.updateHud();
    this.joinGang(kitten, this.troll.mouth());
    if (left === 0) this.later(0.9, () => this.win(false));
    else this.later(1.3, () => this.next());
  }

  // --- The gang of rescued kittens ------------------------------------------------

  seat(index) {
    const row = Math.floor(index / SEATS_PER_ROW) % 3;
    const column = index % SEATS_PER_ROW;
    return new THREE.Vector3((column - (SEATS_PER_ROW - 1) / 2) * SEAT_GAP + row * 0.06, 0.16 + row * 0.08, 0.06 - row * 0.07);
  }

  // Flies a kitten from `start` (world) to the next free place on the bench, with a flip.
  joinGang(kitten, start) {
    const seat = this.seat(this.gang.length + this.flying.length);
    const end = this.bench.localToWorld(seat.clone());
    this.group.add(kitten);
    kitten.position.copy(start);
    kitten.setFace('star', 2);
    this.flying.push(kitten);
    const path = arc(start, end, 0.45);
    this.game.tweens.add(
      0.9,
      (p) => {
        kitten.position.copy(path(p));
        kitten.sprite.material.rotation = p < 1 ? -p * Math.PI * 2 : 0;
      },
      {
        ease: ease.inOutQuad,
        done: () => {
          this.flying = this.flying.filter((other) => other !== kitten);
          this.bench.add(kitten);
          kitten.position.copy(seat);
          kitten.hop(0.06, 'happy');
          this.gang.push(kitten);
          sfx.ding();
        },
      },
    );
  }

  cheerGang() {
    this.gang.forEach((kitten, i) => this.later(i * 0.05, () => kitten.hop(0.05 + Math.random() * 0.04, pick(['happy', 'star', 'heart']))));
  }

  // --- The boss and the win ----------------------------------------------------

  toBoss() {
    const game = this.game;
    this.step = 'cutscene';
    game.announce(game.note, sv.adventure.angry);
    game.sign.setText('');
    this.troll.laugh();
    sfx.giggle();
    music.play('boss');
    const from = this.troll.position.clone();
    game.tweens.add(1.4, (p) => this.troll.position.lerpVectors(from, TROLL_NEAR, p), {
      ease: ease.inOutQuad,
      done: () => {
        this.troll.hearts.visible = true;
        this.troll.hearts.children.forEach((heart, i) => {
          heart.userData.size.value = 0;
          this.later(i * 0.1, () => {
            heart.userData.size.value = 1.6;
            sfx.bloop();
          });
        });
      },
    });
    this.later(2.2, () => game.announce(game.cheer, sv.adventure.bossHint));
    this.later(3.6, () => this.ask());
  }

  // The troll is beaten (or too tired): it turns friendly and hands over the golden bubble.
  win(tired) {
    const game = this.game;
    this.step = 'cutscene';
    for (const orb of this.orbs) if (!orb.done) this.sendBack(orb);
    game.announce(game.cheer, tired ? sv.adventure.tired : sv.adventure.friendly);
    music.stop();
    sfx.fanfare();
    const troll = this.troll;
    game.tweens.add(1, (p) => (troll.body.rotation.y = ease.inOutQuad(p) * Math.PI * 4), {
      done: () => {
        troll.makeFriendly();
        game.effects.firework(troll.mouth());
        sfx.firework();
      },
    });
    for (let i = 0; i < 3; i++) {
      this.later(0.4 + i * 0.35, () => {
        game.effects.firework(troll.position.clone().add(new THREE.Vector3((i - 1) * 0.7, 0.4, 0.3)));
        sfx.firework();
      });
    }
    this.later(2.2, () => this.offerGolden());
  }

  offerGolden() {
    const game = this.game;
    const orb = new Orb('bubble', null, { look: this.friend.look, golden: true });
    const start = this.troll.mouth();
    orb.position.copy(start);
    orb.wobble = 0.05;
    orb.fly(arc(start, GOLDEN_SPOT, 0.3), 1, () => {
      orb.mode = 'float';
      orb.anchor.copy(GOLDEN_SPOT);
    });
    orb.hit.userData.onHit = () => this.openGolden(orb);
    this.golden = orb;
    this.orbs.push(orb);
    this.group.add(orb);
    this.troll.blow();
    sfx.combo();
    game.sign.setText(this.friend.name);
    game.announce(game.cheer, sv.adventure.golden);
    // The friendly troll floats away, waving.
    const from = this.troll.position.clone();
    game.tweens.add(3, (p) => {
      this.troll.position.lerpVectors(from, from.clone().add(new THREE.Vector3(1.6, 1.4, -1.5)), p);
      this.troll.scale.setScalar(Math.max(0.0001, 1 - p * 0.7));
    }, { delay: 1.2, ease: ease.inOutQuad });
    this.step = 'golden';
  }

  openGolden(orb) {
    if (this.step !== 'golden') return;
    const game = this.game;
    this.step = 'cutscene';
    game.effects.pop(orb.position, 0xffc93c);
    game.effects.firework(orb.position, 0xffc93c);
    sfx.pop();
    sfx.combo();
    const kitten = orb.kitten;
    const start = kitten.getWorldPosition(new THREE.Vector3());
    orb.remove(kitten);
    orb.mode = 'gone';
    this.golden = null;
    // The level's own kitten jumps up next to the pet.
    const perch = game.perch;
    const seat = new THREE.Vector3(0.33, 0.02, 0.05);
    const end = perch.localToWorld(seat.clone());
    this.group.add(kitten);
    const path = arc(start, end, 0.5);
    game.tweens.add(1, (p) => kitten.position.copy(path(p)), {
      ease: ease.inOutQuad,
      done: () => {
        perch.add(kitten);
        kitten.position.copy(seat);
        kitten.hop(0.1, 'heart');
        game.effects.hearts(end);
      },
    });
    this.friendKitten = kitten;
    const isNew = rescueFriend(game.profile, game.level);
    this.later(1.1, () => this.showResults(isNew));
  }

  showResults(isNew) {
    const game = this.game;
    const { profile } = game;
    const session = this.session;
    const correct = session.correct;
    const total = session.answers.length;
    const perfect = correct === total;
    const earned = updateUnlocks(profile, { perfect });
    const coins = this.coins + WIN_BONUS + (perfect ? PERFECT_BONUS : 0);
    profile.coins += coins;
    profile.kittens = (profile.kittens ?? 0) + this.rescued;
    logRound(profile, session);
    game.onSave();

    const lines = [sv.adventure.rescued(this.rescued), `${sv.result(correct, total)} ${sv.coinsEarned(coins)}`];
    if (earned.length) lines.push(sv.unlocked(earned.map(nameOf)));
    game.sign.setText(lines);
    game.signSize.value = 1.25;
    game.announce(game.cheer, isNew ? sv.adventure.newFriend(this.friend.name) : sv.adventure.savedAgain(this.friend.name));
    if (earned.length) this.later(0.9, () => sfx.combo());

    game.pet.setParty(true, partyLook(profile.look, earned));
    game.rainbow.show();
    game.effects.confettiRain(4.5);
    music.play('party');
    for (let i = 0; i < 6; i++) {
      this.later(0.3 + i * 0.5, () => {
        const angle = (Math.random() - 0.5) * 1.5;
        const distance = 2.6 + Math.random() * 0.8;
        game.effects.firework(new THREE.Vector3(Math.sin(angle) * distance, 1.9 + Math.random() * 0.8, -Math.cos(angle) * distance));
        sfx.firework();
      });
    }
    game.revealButtons();
    this.step = 'results';
    game.state = 'results';
  }

  // --- Each frame ---------------------------------------------------------------

  targets() {
    if (this.step === 'asking') return this.orbs.filter((orb) => !orb.returning && !orb.done && orb.mode !== 'bump' && orb.age > 0).map((orb) => orb.hit);
    if (this.step === 'golden' && this.golden?.mode === 'float') return [this.golden.hit];
    return [];
  }

  setHover(meshes) {
    for (const orb of this.orbs) orb.hovered = meshes.has(orb.hit);
  }

  // The pet watches the answer you aim at, or else all of them.
  watch() {
    const live = this.orbs.filter((orb) => orb.mode === 'float');
    if (live.length === 0) return this.game.pet.watch(null);
    const aimed = live.find((orb) => orb.hovered);
    if (aimed) this.gaze.copy(aimed.position);
    else {
      this.gaze.set(0, 0, 0);
      for (const orb of live) this.gaze.addScaledVector(orb.position, 1 / live.length);
    }
    this.game.pet.watch(this.gaze);
  }

  update(dt, t) {
    if (this.step === 'idle') return;
    const game = this.game;

    if (this.step === 'asking') {
      this.elapsed += dt;
      const progress = this.timed ? THREE.MathUtils.clamp(this.elapsed / this.session.pace, 0, 1) : 0;
      this.troll.mouth(this.trollSpot);
      for (const orb of this.orbs) {
        if (orb.mode !== 'float' || orb.returning) continue;
        if (this.boss) {
          // Storm balls creep closer and lower, toward the shield.
          orb.anchor.copy(orb.slot).multiplyScalar(1 - progress * (1 - SHIELD / DISTANCE));
          orb.anchor.y = orb.slot.y - progress * 0.2;
          orb.wobble = 0.07;
        } else {
          // Bubbles drift back toward the troll and get harder to reach.
          orb.anchor.lerpVectors(orb.slot, this.trollSpot, ease.inOutQuad(progress) * 0.45);
          orb.wobble = 0.1;
        }
      }
      this.watch();
      if (this.timed && progress >= 1) this.resolve(null);
    }
    // The golden bubble glitters while it waits.
    if (this.golden && Math.random() < dt * 14) {
      const sparkle = this.golden.position.clone().add(new THREE.Vector3().randomDirection().multiplyScalar(0.36));
      game.effects.twinkle(sparkle, Math.random() < 0.5 ? 0xffc93c : 0xffffff);
    }
    if (this.step === 'results' && Math.random() < dt * 4 && this.gang.length) pick(this.gang).hop(0.07, pick(['happy', 'star', 'heart']));

    for (const orb of this.orbs) {
      orb.update(dt, game.cameraPosition);
      if (orb.done) this.dropOrb(orb);
    }
    this.orbs = this.orbs.filter((orb) => !orb.done);
    for (const kitten of [...this.gang, ...this.flying]) kitten.update(dt, t);
    this.friendKitten?.update(dt, t);

    this.troll.update(dt, t);
    facePlayer(this.troll);
    this.hudSize.target = 1;
    this.hud.scale.setScalar(this.hudSize.update(dt));
    this.picture.scale.setScalar(Math.max(0.0001, this.pictureSize.update(dt)));
  }
}
