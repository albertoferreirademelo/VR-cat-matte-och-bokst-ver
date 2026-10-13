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

function tone(freq, { at = 0, dur = 0.15, type = 'sine', gain = 0.3, to } = {}) {
  if (!ctx) return;
  const t0 = ctx.currentTime + at;
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(env).connect(master);
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
};
