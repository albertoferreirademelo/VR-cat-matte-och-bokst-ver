import { Board, BOARD_STYLES } from './board.js';

// A picture of a math fact, shown after a miss so the answer means something:
//   plus and minus in ten-frames (two rows of five, a second frame below for 11 to 20),
//   minus with the taken ones crossed out, times as rows of dots (3 · 4 is 3 rows of 4), division as equal groups (12 / 3 is 3 rows of 4).
const COLORS = ['#f15bb5', '#4cc9f0', '#9b5de5', '#ff9f1c', '#2ec4b6', '#ff6b6b', '#5e60ce', '#ffc93c', '#80b918', '#c77dff'];
const EMPTY = '#e4d4ff';
const INK = '#3c096c';

function dot(g, x, y, radius, color) {
  g.beginPath();
  g.arc(x, y, radius, 0, Math.PI * 2);
  g.fillStyle = color;
  g.fill();
  g.lineWidth = radius * 0.18;
  g.strokeStyle = INK;
  g.stroke();
}

function cross(g, x, y, radius) {
  g.strokeStyle = INK;
  g.lineWidth = radius * 0.35;
  g.lineCap = 'round';
  for (const side of [-1, 1]) {
    g.beginPath();
    g.moveTo(x - radius, y - side * radius);
    g.lineTo(x + radius, y + side * radius);
    g.stroke();
  }
}

// Cells of `size` laid out in a grid of `columns` × `rows`, centred in the box.
function grid(box, columns, rows) {
  const size = Math.min(box.width / columns, box.height / rows) * 0.92;
  const left = box.x + (box.width - size * columns) / 2;
  const top = box.y + (box.height - size * rows) / 2;
  return { size, at: (column, row) => [left + size * (column + 0.5), top + size * (row + 0.5)] };
}

// Ten-frames with room for `total`; `paint(i, x, y, radius)` draws the i-th cell's counter, if any.
function tenFrames(g, box, total, paint) {
  const frames = Math.max(1, Math.ceil(total / 10));
  // Frames stacked, half a cell apart.
  const { size, at } = grid(box, 5, frames * 2 + (frames - 1) * 0.5);
  for (let i = 0; i < frames * 10; i++) {
    const frame = Math.floor(i / 10);
    const column = i % 5;
    const row = frame * 2.5 + Math.floor((i % 10) / 5);
    const [x, y] = at(column, row);
    g.lineWidth = size * 0.05;
    g.strokeStyle = '#c3a6f5';
    g.strokeRect(x - size / 2, y - size / 2, size, size);
    paint(i, x, y, size * 0.36);
  }
}

function groups(g, box, rows, columns) {
  const { size, at } = grid(box, columns, rows);
  for (let row = 0; row < rows; row++) {
    const [x0, y] = at(0, row);
    const [x1] = at(columns - 1, row);
    // A soft band behind each row shows it is one group.
    g.beginPath();
    g.roundRect(x0 - size * 0.48, y - size * 0.46, x1 - x0 + size * 0.96, size * 0.92, size * 0.46);
    g.fillStyle = '#f3e8ff';
    g.fill();
    for (let column = 0; column < columns; column++) dot(g, at(column, row)[0], y, size * 0.34, COLORS[row % COLORS.length]);
  }
}

export class FactPicture extends Board {
  constructor(width = 0.62, height = 0.4) {
    super(width, height, BOARD_STYLES.note);
  }

  // Whether there is a picture for this fact.
  static fits({ op, a, b, answer }) {
    if (op === '+' || op === '-') return Math.max(a, answer) <= 20;
    if (op === '*') return a <= 10 && b <= 10;
    if (op === '/') return b <= 10 && answer <= 10;
    return false;
  }

  show(item) {
    const g = this.canvas.getContext('2d');
    g.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const panel = this.drawPanel(g);
    const pad = panel.height * 0.08;
    const box = { x: panel.x + pad, y: panel.y + pad, width: panel.width - pad * 2, height: panel.height - pad * 2 };
    const { a, b, op, answer } = item;
    if (op === '+') {
      tenFrames(g, box, answer, (i, x, y, r) => i < answer && dot(g, x, y, r, i < a ? COLORS[0] : COLORS[1]));
    } else if (op === '-') {
      tenFrames(g, box, a, (i, x, y, r) => {
        if (i >= a) return;
        const gone = i >= a - b;
        dot(g, x, y, r, gone ? EMPTY : COLORS[2]);
        if (gone) cross(g, x, y, r * 0.75);
      });
    } else if (op === '*') {
      groups(g, box, a, b);
    } else if (op === '/') {
      groups(g, box, b, answer);
    }
    this.texture.needsUpdate = true;
  }
}
