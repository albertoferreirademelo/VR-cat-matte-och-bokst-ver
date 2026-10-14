# The wardrobe

Everything a player can earn and dress their pet in: which animal it is, its colours and what it wears.
The rest of the game only talks to `Pet` (in `creatures/index.js`) and the functions in `look.js`.

| File | What is in it |
|---|---|
| `catalog.js` | Every creature, colour and item as plain data, with how each is unlocked |
| `look.js` | The shape of a saved look, defaults, the party outfit, and upgrading old saves |
| `unlocks.js` | The unlock rules (stars, perfect rounds, mastered levels) and lock texts |
| `items.js` | 3D models of things to wear |
| `creatures/creature.js` | What every animal shares: the moves, blinking, looking around, wearing items |
| `creatures/drawing.js` | 2D face parts: eyes, mouths, blush, worry |
| `creatures/cat.js`, `capybara.js` | Each animal's body, face and menu picture |
| `creatures/index.js` | `Pet`, which shows the right animal, and `picture()` for the menus |

A saved look is `{ creature: 'cat', paint: { fur: 'lila' }, wear: { head: 'crown', face: 'glasses' } }`.
Names for everything are in `src/i18n/sv.js` (`creatures`, `colors`, `items`).

## Add a thing to wear

1. Add it to `ITEMS` in `catalog.js` with a slot (`head`, `face` or `ear`), an icon and a `need`.
2. Add a builder in `items.js`. Build it on the reference head: the cat's, a ball of radius 0.13
   at the origin looking along +z. Each creature's anchor moves it onto its own head.
3. Add its Swedish name to `sv.items`.

## Add a colour

Add it to a palette in `catalog.js` (`fur`, `light`, `dark` and the eye colours `iris`) and its name to `sv.colors`.

## Add a creature

1. Make `creatures/<name>.js` with a class that extends `Creature`. Build the body in `this.model`;
   set `head`, `arms` and `ears` (and `tail` if it has one); add a `face` decal with `this.decal()`;
   and call `this.anchor()` for each slot so items sit right. Give it `drawDecals(colors)` and a
   flat picture function for the menus. `cat.js` is the model to copy.
2. Register it in `KINDS` in `creatures/index.js`.
3. Add it to `CREATURES` in `catalog.js` with its palette, default colour, greeting sound and `need`.
4. Add its Swedish name to `sv.creatures`.

Check every item on the new creature: hats, glasses and the bow each use a different anchor.
