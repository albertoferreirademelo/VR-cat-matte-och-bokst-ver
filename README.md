# Kattmatte

A small learning game in Swedish for children, with a cartoon kitten, balloons and a wardrobe of hats to earn.
It runs in the browser: on a phone, tablet or computer, and in VR or passthrough on a Meta Quest 3.

**Play:** https://albertoferreirademelo.github.io/VR-cat-matte-och-bokst-ver/

![The party at the end of a round](screenshots/party.jpg)

## The two games

- **Matte:** a sum is shown and the balloons carry answers. Pop the right one before it drifts down.
  Levels go from "plus 1 och 2" and "tiokompisar" to the multiplication tables.
  The balloons speed up or slow down to suit the player, and facts that were missed come back more often.
- **Bokstäver:** a voice says a letter and the balloons carry letters. There is no time limit,
  and tapping the sign says the letter again.

Each player has a profile with their own kitten, stars and progress. Progress is saved in the browser of the device that plays.

## Run it yourself

Needs [Node.js](https://nodejs.org/).

```bash
npm install
npm run dev
```

Then open http://localhost:5173. To try it on a headset in the same Wi-Fi, run `npm run dev:quest`
and open `https://<your-pc-address>:5173` in the headset's browser (it will warn about the self-made certificate).

`npm run build` puts the finished site in `dist/`. Pushing to `main` publishes it through GitHub Pages.

## Where things are

| Folder | What is in it |
|---|---|
| `src/decks/` | The games: levels, questions and wrong answers |
| `src/game/` | The 3D scene: kitten, balloons, effects, rainbow |
| `src/ui/` | The menus and the signs |
| `src/i18n/sv.js` | Every text the players see |
| `src/cats.js`, `src/rewards.js` | Kitten colours, hats and how they are unlocked |
| `public/audio/` | Voice clips |
| `tools/` | The script that cuts the alphabet recording into clips |

## Credits

See [CREDITS.md](CREDITS.md). The spoken letters come from a Wikimedia Commons recording by Sertion (CC BY-SA 3.0).
