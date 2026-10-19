// Small synthesized sound effects, so the game needs no audio files yet.
let ctx;
let master;

// Browsers only allow sound after a tap or click, so call this from one.
export function unlockAudio() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
}

// `when` is an exact time on the audio clock (for music); otherwise `at` seconds from now.
function tone(freq, { at = 0, when, dur = 0.15, type = 'sine', gain = 0.3, to, out = master } = {}) {
  if (!ctx) return;
  const t0 = when ?? ctx.currentTime + at;
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(env).connect(out);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise(dur, gain, at = 0) {
  if (!ctx) return;
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let i = 0; i < samples.length; i++) samples[i] = (Math.random() * 2 - 1) * (1 - i / samples.length);
  const source = ctx.createBufferSource();
  const env = ctx.createGain();
  source.buffer = buffer;
  env.gain.value = gain;
  source.connect(env).connect(master);
  source.start(ctx.currentTime + at);
}

// --- Voice clips (public/audio/<path>.mp3) ---------------------------------

const clips = new Map();
let speaking = null;

export function loadClip(path) {
  if (!ctx) return Promise.resolve(null);
  if (!clips.has(path)) {
    const loading = fetch(`${import.meta.env.BASE_URL}audio/${path}.mp3`)
      .then((response) => {
        if (!response.ok) throw new Error(`${response.status} for ${path}`);
        return response.arrayBuffer();
      })
      .then((data) => ctx.decodeAudioData(data))
      .catch((error) => {
        console.warn('Voice clip failed to load:', error);
        clips.delete(path);
        return null;
      });
    clips.set(path, loading);
  }
  return clips.get(path);
}

// Plays a voice clip, cutting off the one before it. The voice is louder than the effects.
export async function say(path, delay = 0) {
  const buffer = await loadClip(path);
  if (!buffer) return;
  try {
    speaking?.stop();
  } catch {
    // It had already finished.
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  source.start(ctx.currentTime + delay);
  speaking = source;
}

const melody = (notes, step, dur, gain = 0.25) =>
  notes.forEach((freq, i) => tone(freq, { at: i * step, dur, type: 'triangle', gain }));

export const sfx = {
  zap: () => tone(1400, { dur: 0.08, to: 700, type: 'triangle', gain: 0.08 }),
  pop: () => {
    noise(0.09, 0.5);
    tone(300, { dur: 0.1, to: 80, gain: 0.4 });
  },
  correct: () => melody([523, 659, 784, 1047], 0.07, 0.22),
  wrong: () => tone(330, { dur: 0.3, to: 247, gain: 0.2 }),
  // A balloon appears.
  bloop: () => tone(420, { dur: 0.09, to: 760, gain: 0.07 }),
  // A star lands in the score row.
  ding: () => {
    tone(1568, { dur: 0.35, gain: 0.2 });
    tone(2093, { at: 0.06, dur: 0.4, gain: 0.14 });
  },
  boing: () => tone(240, { dur: 0.22, to: 620, gain: 0.14 }),
  // Several right answers in a row.
  combo: () => melody([659, 784, 988, 1175, 1568], 0.06, 0.25, 0.2),
  firework: () => {
    tone(500, { dur: 0.18, to: 1400, gain: 0.05 });
    noise(0.25, 0.22, 0.16);
    tone(1900, { at: 0.18, dur: 0.3, to: 900, type: 'triangle', gain: 0.07 });
  },
  fanfare: () => melody([523, 659, 784, 659, 784, 1047], 0.13, 0.3),
  meow: () => {
    tone(650, { dur: 0.16, to: 980, type: 'triangle', gain: 0.18 });
    tone(980, { at: 0.16, dur: 0.3, to: 560, type: 'triangle', gain: 0.18 });
  },
  // The adventure: a storm ball thrown, hitting the troll, splatting on the shield.
  whoosh: () => tone(260, { dur: 0.3, to: 720, gain: 0.08 }),
  bonk: () => {
    tone(220, { dur: 0.18, to: 70, type: 'square', gain: 0.12 });
    noise(0.12, 0.35);
    tone(880, { at: 0.08, dur: 0.25, to: 1320, type: 'triangle', gain: 0.1 });
  },
  splat: () => {
    noise(0.22, 0.3);
    tone(180, { dur: 0.25, to: 60, gain: 0.25 });
  },
  // The troll's mean little giggle, and the slurp of bubbles going back to it.
  giggle: () => [620, 760, 640, 800, 660].forEach((freq, i) => tone(freq, { at: i * 0.07, dur: 0.07, type: 'square', gain: 0.05 })),
  slurp: () => tone(900, { dur: 0.45, to: 160, gain: 0.12 }),
  // A super shot after a run of right answers.
  power: () => melody([523, 784, 1047, 1568, 2093], 0.045, 0.2, 0.18),
  // Capybaras chirp: two short, happy whistles.
  squeak: () => {
    tone(820, { dur: 0.09, to: 1250, type: 'sine', gain: 0.16 });
    tone(900, { at: 0.13, dur: 0.12, to: 1450, type: 'sine', gain: 0.16 });
  },
};

// --- Music ---------------------------------------------------------------------
// Small looping tunes played on the synthesizer above, one step per eighth note.
// Notes are MIDI numbers (60 is middle C); null is a rest.

const _ = null;
const TRACKS = {
  // Bouncy and bright while rescuing kittens: C, F, Am, G.
  rescue: {
    bpm: 128,
    lead: [72, _, 76, 79, _, 76, 72, _, 77, _, 81, _, 79, 77, 76, _, 76, _, 72, 76, 81, _, 79, _, 79, 77, 76, 74, 71, _, 74, _],
    roots: [48, 53, 45, 43],
    bass: [0, _, _, 7, 12, _, 7, _],
    kick: [0, 4],
    snare: [2, 6],
    hat: [1, 3, 5, 7],
  },
  // Faster and a little dramatic for the boss: Am, F, C, E.
  boss: {
    bpm: 150,
    lead: [69, 72, 76, 72, 69, 72, 76, 79, 77, 76, 72, 69, 72, _, 74, _, 72, 76, 79, 76, 72, 76, 84, _, 80, _, 76, _, 71, _, 68, _],
    roots: [45, 41, 48, 40],
    bass: [0, 12, 0, 12, 0, 12, 0, 12],
    kick: [0, 3, 4],
    snare: [2, 6],
    hat: [0, 1, 2, 3, 4, 5, 6, 7],
  },
  // A happy, swinging party: C, G, Am, F.
  party: {
    bpm: 112,
    lead: [72, 76, 79, 84, 79, 76, 72, 76, 71, 74, 79, 83, 79, 74, 71, 74, 69, 72, 76, 81, 76, 72, 69, 72, 65, 69, 72, 77, 72, 69, 77, 81],
    roots: [48, 43, 45, 41],
    bass: [0, _, _, _, 7, _, _, _],
    kick: [0],
    snare: [4],
    hat: [2, 6],
  },
};

const midi = (note) => 440 * 2 ** ((note - 69) / 12);
let musicBus;
let noiseBuffer;
let track = null;
let musicOn = true;
let nextStep = 0;
let stepAt = 0;
let timer = null;

function hit(when, { gain, dur }) {
  const source = ctx.createBufferSource();
  const env = ctx.createGain();
  source.buffer = noiseBuffer;
  env.gain.setValueAtTime(gain, when);
  env.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  source.connect(env).connect(musicBus);
  source.start(when, Math.random() * 0.5, dur + 0.02);
}

function playStep(step, when) {
  const bar = Math.floor(step / 8) % 4;
  const beat = step % 8;
  const note = track.lead[step % track.lead.length];
  const eighth = 30 / track.bpm;
  if (note != null) tone(midi(note), { when, dur: eighth * 1.6, type: 'triangle', gain: 0.1, out: musicBus });
  const bass = track.bass[beat];
  if (bass != null) tone(midi(track.roots[bar] + bass), { when, dur: eighth * 1.3, type: 'triangle', gain: 0.16, out: musicBus });
  if (track.kick.includes(beat)) tone(150, { when, dur: 0.16, to: 45, gain: 0.32, out: musicBus });
  if (track.snare.includes(beat)) hit(when, { gain: 0.14, dur: 0.1 });
  if (track.hat.includes(beat)) hit(when, { gain: 0.035, dur: 0.035 });
}

function schedule() {
  if (!track || !ctx) return;
  while (stepAt < ctx.currentTime + 0.15) {
    playStep(nextStep, stepAt);
    nextStep += 1;
    stepAt += 30 / track.bpm;
  }
}

export const music = {
  // Starts a tune by name (see TRACKS), or keeps playing it if it already is.
  play(name) {
    if (!ctx || !musicOn || track === TRACKS[name]) return;
    if (!musicBus) {
      musicBus = ctx.createGain();
      musicBus.gain.value = 0.32;
      musicBus.connect(ctx.destination);
      noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const samples = noiseBuffer.getChannelData(0);
      for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    }
    track = TRACKS[name];
    nextStep = 0;
    stepAt = ctx.currentTime + 0.05;
    timer ??= setInterval(schedule, 40);
  },
  stop() {
    track = null;
    clearInterval(timer);
    timer = null;
  },
  // Grown-ups can turn the music off; sound effects and voices stay.
  setOn(on) {
    musicOn = on;
    if (!on) this.stop();
  },
};
