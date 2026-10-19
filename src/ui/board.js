import * as THREE from 'three';

export const FONT = '"Fredoka Variable", "Trebuchet MS", "Segoe UI", system-ui, sans-serif';

export const BOARD_STYLES = {
  // The sum sign: a white board with cat ears and colourful numbers.
  sign: { fill: '#ffffff', border: '#7b2cbf', color: '#3c096c', ears: true, colorful: true },
  // Praise: a spiky comic-book burst.
  cheer: { fill: '#ffe45e', border: '#f15bb5', color: '#3c096c', burst: true },
  // Encouragement after a miss: calm and soft.
  note: { fill: '#f3e8ff', border: '#9b5de5', color: '#3c096c' },
  button: { fill: '#7b2cbf', border: '#ffffff', color: '#ffffff' },
  // A story question: plain words, the numbers stand out.
  story: { fill: '#ffffff', border: '#7b2cbf', color: '#3c096c', numbers: '#f15bb5' },
};

const SYMBOL_COLORS = { '=': '#9b5de5', '?': '#ff9f1c' };
const OPERATOR_COLOR = '#f15bb5';

function drawSpeaker(g, x, y, size) {
  g.fillStyle = g.strokeStyle = OPERATOR_COLOR;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(x - size * 0.5, y - size * 0.17);
  g.lineTo(x - size * 0.28, y - size * 0.17);
  g.lineTo(x - size * 0.02, y - size * 0.42);
  g.lineTo(x - size * 0.02, y + size * 0.42);
  g.lineTo(x - size * 0.28, y + size * 0.17);
  g.lineTo(x - size * 0.5, y + size * 0.17);
  g.closePath();
  g.fill();
  g.lineWidth = size * 0.09;
  for (const radius of [0.2, 0.4]) {
    g.beginPath();
    g.arc(x + size * 0.06, y, size * radius, -0.8, 0.8);
    g.stroke();
  }
}

// Pictures on transparent canvases skip their see-through pixels (alphaTest), so the empty
// corners of a rectangle do not hide what is behind them, like a kitten passing behind a sign.
export const SEE_THROUGH = 0.05;

// A flat panel with text on it, drawn on a canvas.
export class Board extends THREE.Mesh {
  constructor(width, height, style = BOARD_STYLES.note) {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = Math.round((1024 * height) / width);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    super(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: texture, transparent: true, alphaTest: SEE_THROUGH }));
    this.canvas = canvas;
    this.texture = texture;
    this.style = style;
    this.hovered = false;
  }

  // Draws the panel and returns the box that text may use: { x, y, width, height }.
  drawPanel(g) {
    const { width, height } = this.canvas;
    const { fill, border, ears, burst } = this.style;
    const line = Math.min(width, height) * 0.05;
    g.lineJoin = 'round';
    g.lineWidth = line;
    g.strokeStyle = border;
    g.fillStyle = fill;

    if (burst) {
      const spikes = 22;
      g.beginPath();
      for (let i = 0; i < spikes * 2; i++) {
        const reach = i % 2 ? 0.8 : 1;
        const angle = (i / (spikes * 2)) * Math.PI * 2;
        g.lineTo(
          width / 2 + Math.cos(angle) * (width / 2 - line) * reach,
          height / 2 + Math.sin(angle) * (height / 2 - line) * reach,
        );
      }
      g.closePath();
      g.fill();
      g.stroke();
      return { x: width * 0.2, y: height * 0.22, width: width * 0.6, height: height * 0.56 };
    }

    const top = ears ? height * 0.24 : 0;
    if (ears) {
      for (const side of [-1, 1]) {
        const x = width / 2 + side * width * 0.33;
        g.beginPath();
        g.moveTo(x - width * 0.1, top + line * 2);
        g.lineTo(x + side * width * 0.03, line);
        g.lineTo(x + width * 0.1, top + line * 2);
        g.closePath();
        g.fillStyle = fill;
        g.fill();
        g.stroke();
        g.beginPath();
        g.moveTo(x - width * 0.05, top + line * 2);
        g.lineTo(x + side * width * 0.02, line * 3.4);
        g.lineTo(x + width * 0.05, top + line * 2);
        g.closePath();
        g.fillStyle = '#ffb3d9';
        g.fill();
      }
    }
    // A darker copy underneath makes the panel look thick.
    const depth = line * 1.2;
    const body = (offset, color) => {
      g.beginPath();
      g.roundRect(line / 2, top + line / 2 + offset, width - line, height - top - line - depth, (height - top) * 0.26);
      g.fillStyle = color;
      g.fill();
      g.stroke();
    };
    body(depth, border);
    body(0, fill);
    return { x: line, y: top + line, width: width - line * 2, height: height - top - line * 2 - depth };
  }

  // `speaker` adds a loudspeaker symbol: the question is spoken, tap here to hear it again.
  setText(text, color, { speaker = false } = {}) {
    const lines = Array.isArray(text) ? text : [text];
    const g = this.canvas.getContext('2d');
    g.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const box = this.drawPanel(g);
    if (speaker) {
      const size = box.height * 0.82;
      const alone = lines.join('') === '';
      drawSpeaker(g, alone ? box.x + box.width / 2 : box.x + size * 0.75, box.y + box.height / 2, size);
      if (!alone) {
        box.x += size * 1.3;
        box.width -= size * 1.3;
      }
    }

    g.textBaseline = 'middle';
    g.textAlign = 'left';
    const lineHeight = box.height / lines.length;
    lines.forEach((line, i) => {
      const words = line.split(' ');
      let size = lineHeight * 0.74;
      const measure = () => {
        g.font = `700 ${size}px ${FONT}`;
        const gap = size * 0.3;
        return words.reduce((sum, word) => sum + g.measureText(word).width, 0) + gap * (words.length - 1);
      };
      let total = measure();
      const room = box.width * 0.9;
      if (total > room) {
        size *= room / total;
        total = measure();
      }
      let x = box.x + (box.width - total) / 2;
      const y = box.y + lineHeight * (i + 0.5) + size * 0.06;
      for (const word of words) {
        if (color || !this.style.colorful) g.fillStyle = color ?? (this.style.numbers && /\d/.test(word) ? this.style.numbers : this.style.color);
        else g.fillStyle = SYMBOL_COLORS[word] ?? (/\d/.test(word) ? this.style.color : OPERATOR_COLOR);
        g.fillText(word, x, y);
        x += g.measureText(word).width + size * 0.3;
      }
    });
    this.texture.needsUpdate = true;
  }
}
