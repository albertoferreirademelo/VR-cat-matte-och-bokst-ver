import test from 'node:test';
import assert from 'node:assert/strict';
import { COLORS, CREATURES, GEAR, GEAR_PALETTES, ITEMS, PALETTES, nameOf } from '../src/wardrobe/catalog.js';
import { DEFAULT_GEAR, isUsing, withGear } from '../src/wardrobe/gear.js';
import { DEFAULT_LOOK, dressedIn, isWearing, paintOf, partyLook, upgradeLook } from '../src/wardrobe/look.js';
import { owns, updateUnlocks } from '../src/wardrobe/unlocks.js';
import { buy, payRound } from '../src/wardrobe/shop.js';
import { sv } from '../src/i18n/sv.js';

const player = (extra) => ({ track: 'matte', stars: 0, coins: 0, stats: {}, unlocked: [], fresh: [], ...extra });
const find = (id) => [...CREATURES, ...ITEMS, ...COLORS, ...GEAR].find((entry) => entry.id === id);

test('every wardrobe entry has a Swedish name, and every palette colour too', () => {
  for (const creature of CREATURES) assert.ok(sv.creatures[creature.id], creature.id);
  for (const item of ITEMS) assert.ok(sv.items[item.id], item.id);
  for (const palette of Object.values(PALETTES)) for (const id of Object.keys(palette)) assert.ok(sv.colors[id], id);
  for (const palette of Object.values(GEAR_PALETTES)) for (const id of Object.keys(palette)) assert.ok(sv.colors[id], id);
  for (const entry of GEAR) assert.ok(nameOf(entry), entry.id);
});

test('everything is either free, for sale or a goal, never both', () => {
  for (const entry of [...CREATURES, ...ITEMS, ...COLORS, ...GEAR]) assert.ok(!(entry.price && entry.need), entry.id);
  const ids = [...CREATURES, ...ITEMS, ...COLORS, ...GEAR].map((entry) => entry.id);
  assert.equal(new Set(ids).size, ids.length, 'ids are unique');
});

test('an older saved cat becomes a look with the same colour and hat', () => {
  const profile = { cat: { color: 'svart', accessory: 'crown' } };
  upgradeLook(profile);
  assert.deepEqual(profile.look, { creature: 'cat', paint: { fur: 'svart' }, wear: { head: 'crown' } });
  assert.equal(profile.cat, undefined);
  const bare = { cat: { color: 'rosa', accessory: 'none' } };
  upgradeLook(bare);
  assert.deepEqual(bare.look.wear, {});
  const missing = {};
  upgradeLook(missing);
  assert.deepEqual(missing.look, DEFAULT_LOOK);
  assert.notEqual(missing.look, DEFAULT_LOOK);
});

test('painted parts replace the creature colours, and unknown colours fall back', () => {
  const plain = paintOf({ creature: 'cat', paint: { fur: 'regnbåge' } });
  assert.equal(plain.fur, PALETTES.catFur.lila.fur);
  assert.equal(plain.iris, PALETTES.catFur.lila.iris);
  assert.equal(plain.paws, undefined);
  const painted = paintOf({ creature: 'cat', paint: { fur: 'rosa', eyes: 'guld', paws: 'bla' } });
  assert.equal(painted.iris, PALETTES.eyes.guld);
  assert.equal(painted.paws, PALETTES.paws.bla);
});

test('a round pays one coin per right answer and a bonus for all right', () => {
  const profile = player();
  assert.equal(payRound(profile, { correct: 7, perfect: false }), 7);
  assert.equal(payRound(profile, { correct: 8, perfect: true }), 13);
  assert.equal(profile.coins, 20);
});

test('buying costs coins once and only when there are enough', () => {
  const eyes = find('eyes:gron');
  const profile = player({ coins: eyes.price - 1 });
  assert.equal(buy(profile, eyes), false);
  profile.coins += 1;
  assert.equal(buy(profile, eyes), true);
  assert.equal(profile.coins, 0);
  assert.ok(owns(profile, eyes));
  profile.coins = 100;
  assert.equal(buy(profile, eyes), false);
  assert.equal(profile.coins, 100);
  assert.equal(buy(profile, find('crown')), false, 'goals cannot be bought');
});

test('goals unlock by themselves and stay unlocked; things for sale do not', () => {
  const profile = player({ stars: 60 });
  const earned = updateUnlocks(profile).map((entry) => entry.id);
  assert.deepEqual(earned, ['capybara']);
  profile.stars = 0;
  assert.deepEqual(updateUnlocks(profile), []);
  assert.ok(owns(profile, find('capybara')));
  assert.ok(!owns(profile, find('bow')));
});

test('trying things on changes only the copy, and several things fit at once', () => {
  const look = { creature: 'cat', paint: { fur: 'rosa' }, wear: { face: 'glasses' } };
  const dressed = dressedIn(dressedIn(look, find('crown')), find('paws:guld'));
  assert.deepEqual(dressed.wear, { face: 'glasses', head: 'crown' });
  assert.equal(dressed.paint.paws, 'guld');
  assert.ok(isWearing(dressed, find('crown')) && !isWearing(look, find('crown')));
  const capybara = dressedIn(dressed, find('capybara'));
  assert.deepEqual(capybara.paint, { fur: 'brun', paws: 'guld' });
});

test('the party shows what was just earned, or else a party hat', () => {
  const look = { creature: 'cat', paint: { fur: 'rosa' }, wear: { face: 'glasses' } };
  assert.deepEqual(partyLook(look, []).wear, { head: 'party' });
  const crown = find('crown');
  assert.deepEqual(partyLook(look, [crown]), { creature: 'cat', paint: { fur: 'rosa' }, wear: { head: 'crown' } });
  assert.deepEqual(look.wear, { face: 'glasses' });
  assert.deepEqual(partyLook(look, [find('capybara')]), { creature: 'capybara', paint: { fur: 'brun' }, wear: { head: 'party' } });
});

test('the gear starts with a free star wand and mixed balloons, and changes one slot at a time', () => {
  assert.ok(owns(player(), find(`wand:${DEFAULT_GEAR.wand}`)));
  assert.ok(owns(player(), find('wand:wizard')), 'the classic wizard wand is free');
  const gear = withGear(withGear(DEFAULT_GEAR, find('glitter:regnbage')), find('wand:wizard'));
  assert.deepEqual(gear, { wand: 'wizard', balloon: 'mix', glitter: 'regnbage' });
  assert.ok(isUsing(gear, find('wand:wizard')) && !isUsing(gear, find('wand:star')));
  assert.deepEqual(DEFAULT_GEAR, { wand: 'star', balloon: 'mix' });
});
