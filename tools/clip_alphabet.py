"""Cuts the Swedish alphabet recording into one clip per letter.

Source: https://commons.wikimedia.org/wiki/File:Sv-alphabet.ogg (by Sertion, CC BY-SA 3.0).
The speaker says the 28 letter names from a to ö; w is not in the recording.

Run from the project folder (needs ffmpeg on the PATH):
    python -I tools/clip_alphabet.py

If a clip sounds cut off, change its start or end time below and run again.
"""

import os
import subprocess
import sys

SOURCE = os.path.join("downloads", "sv-alphabet", "Sv-alphabet.ogg")
TARGET = os.path.join("public", "audio", "sv", "letters")

# letter: (start, end) in seconds, measured where the voice is clearly audible.
# The quiet hiss at the end of f, s and x and at the start of z is included by hand.
CLIPS = {
    "a": (0.463, 0.865),
    "b": (1.865, 2.280),
    "c": (3.229, 3.835),
    "d": (4.934, 5.382),
    "e": (6.389, 6.910),
    "f": (7.909, 8.340),
    "g": (9.345, 9.791),
    "h": (10.741, 11.183),
    "i": (12.219, 12.717),
    "j": (13.423, 14.242),
    "k": (15.008, 15.636),
    "l": (16.427, 16.914),
    "m": (17.844, 18.342),
    "n": (19.163, 19.643),
    "o": (20.534, 21.009),
    "p": (21.800, 22.468),
    "q": (23.324, 23.879),
    "r": (24.716, 25.224),
    "s": (26.077, 26.580),
    "t": (27.194, 27.835),
    "u": (28.611, 29.096),
    "v": (29.840, 30.366),
    "x": (31.177, 31.780),
    "y": (32.514, 32.995),
    "z": (33.640, 34.372),
    "å": (34.989, 35.471),
    "ä": (36.157, 36.619),
    "ö": (37.540, 37.924),
}

# File names stay plain ASCII so they work on every device and server.
FILE_NAMES = {"å": "aa", "ä": "ae", "ö": "oe"}

LEAD = 0.06  # seconds kept before and after the measured times
TAIL = 0.08
RATE = 44100
PEAK = 0.8  # every clip is made equally loud


def main():
    if not os.path.exists(SOURCE):
        sys.exit(f"Missing {SOURCE}")
    os.makedirs(TARGET, exist_ok=True)

    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", SOURCE, "-f", "s16le", "-ac", "1", "-ar", str(RATE), "-"],
        check=True,
        capture_output=True,
    ).stdout
    samples = memoryview(raw).cast("h")

    for letter, (start, end) in CLIPS.items():
        start -= LEAD
        end += TAIL
        length = end - start
        loudest = max(abs(value) for value in samples[int(start * RATE) : int(end * RATE)]) / 32768
        gain = PEAK / loudest
        fades = f"afade=t=in:d=0.02,afade=t=out:st={length - 0.05:.3f}:d=0.05"
        target = os.path.join(TARGET, FILE_NAMES.get(letter, letter) + ".mp3")
        subprocess.run(
            ["ffmpeg", "-v", "error", "-y", "-ss", f"{start:.3f}", "-t", f"{length:.3f}", "-i", SOURCE]
            + ["-af", f"volume={gain:.3f},{fades}", "-ac", "1", "-codec:a", "libmp3lame", "-q:a", "4", target],
            check=True,
        )
        print(f"{letter}  {start:6.2f} to {end:6.2f}  gain {gain:4.1f}  {target}")


if __name__ == "__main__":
    main()
