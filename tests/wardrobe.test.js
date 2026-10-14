import test from 'node:test';
import assert from 'node:assert/strict';
import { CREATURES, ITEMS, PALETTES } from '../src/wardrobe/catalog.js';
import { DEFAULT_LOOK, colorsOf, partyLook, upgradeLook } from '../src/wardrobe/look.js';
import { updateUnlocks } from '../src/wardrobe/unlocks.js';
import { sv } from '../src/i18n/sv.js';

const player = (extra) => ({ track: 'matte', stars: 0, stats: {}, unlocked: [], fresh: [], ...extra });

test('every wardrobe entry has a Swedish name, and every palette colour too', () => {
  for (const creature of CREATURES) assert.ok(sv.creatures[creature.id], creature.id);
  for (const item of ITEMS) assert.ok(sv.items[item.id], item.id);
  for (const palette of Object.values(PALETTES)) for (const id of Object.keys(palette)) assert.ok(sv.colors[id], id);
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

test('an unknown colour falls back to the creature default', () => {
  assert.equal(colorsOf({ creature: 'cat', paint: { fur: 'regnbåge' } }), PALETTES.catFur.lila);
});

test('items unlock by stars and stay unlocked', () => {
  const profile = player({ stars: 30 });
  const earned = updateUnlocks(profile).map((entry) => entry.id);
  assert.ok(earned.includes('bow') && earned.includes('flowers'));
  assert.ok(!earned.includes('glasses'));
  profile.stars = 0;
  assert.deepEqual(updateUnlocks(profile), []);
  assert.ok(profile.unlocked.includes('bow'));
});

test('the party shows what was just earned, or else a party hat', () => {
  const look = { creature: 'cat', paint: { fur: 'rosa' }, wear: { face: 'glasses' } };
  assert.deepEqual(partyLook(look, []).wear, { head: 'party' });
  const bow = ITEMS.find((item) => item.id === 'bow');
  assert.deepEqual(partyLook(look, [bow]), { creature: 'cat', paint: { fur: 'rosa' }, wear: { ear: 'bow' } });
  assert.deepEqual(look.wear, { face: 'glasses' });
});

test('the capybara is earned with stars and comes to its own party in its own colours', () => {
  const profile = player({ stars: 50 });
  const earned = updateUnlocks(profile);
  const capybara = earned.find((entry) => entry.id === 'capybara');
  assert.ok(capybara);
  const look = { creature: 'cat', paint: { fur: 'lila' }, wear: {} };
  assert.deepEqual(partyLook(look, [capybara]), { creature: 'capybara', paint: { fur: 'brun' }, wear: { head: 'party' } });
  assert.equal(look.creature, 'cat');
});
