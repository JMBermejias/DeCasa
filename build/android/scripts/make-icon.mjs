// Genera iconos PNG (launcher) dibujando una casa azul clara sobre fondo azul.
import zlib from 'zlib';
import fs from 'fs';
import path from 'path';

const SIZES = {
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192
};

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const raw = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

function makeIcon(size) {
  const px = Buffer.alloc(size * size * 4);
  const set = (x, y, r, g, b, a) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = a;
  };
  const grad = (t) => {
    // gradiente de #5bb0ef a #2296d8
    const r = Math.round(0x5b + (0x22 - 0x5b) * t);
    const g = Math.round(0xb0 + (0x96 - 0xb0) * t);
    const b = Math.round(0xef + (0xd8 - 0xef) * t);
    return [r, g, b];
  };
  const S = size;
  const m = Math.round(S * 0.07); // margen
  const inset = Math.round(S * 0.1);
  const R = Math.round(S * 0.22); // radio esquinas
  // fondo redondeado
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const nx = Math.min(Math.max(x - m, 0), S - 2 * m);
      const ny = Math.min(Math.max(y - m, 0), S - 2 * m);
      const cornerX = Math.max(R - nx, 0);
      const cornerY = Math.max(R - ny, 0);
      const maxX = S - m;
      const maxY = S - m;
      const cx = Math.max(x - (maxX - R), 0);
      const cy = Math.max(y - (maxY - R), 0);
      const inX = Math.min(cornerX, cx);
      const inY = Math.min(cornerY, cy);
      if (inX * inX + inY * inY <= R * R) {
        const [r, g, b] = grad(y / S);
        set(x, y, r, g, b, 255);
      } else if (x >= m && y >= m && x < maxX && y < maxY) {
        const [r, g, b] = grad(y / S);
        set(x, y, r, g, b, 255);
      }
    }
  }
  // casa blanca
  const cx = S / 2;
  const top = S * 0.22;
  const bottom = S * 0.74;
  const roofH = S * 0.26;
  const half = S * 0.26;
  const doorW = S * 0.12;
  const doorH = S * 0.22;
  // techo (triángulo)
  for (let y = top; y < top + roofH; y++) {
    const t = (y - top) / roofH;
    const halfW = Math.round(half * t);
    for (let x = cx - halfW; x <= cx + halfW; x++) set(Math.round(x), Math.round(y), 255, 255, 255, 255);
  }
  // cuerpo
  const bodyTop = top + roofH;
  for (let y = bodyTop; y < bottom; y++) {
    for (let x = cx - half; x <= cx + half; x++) set(Math.round(x), Math.round(y), 255, 255, 255, 255);
  }
  // puerta
  for (let y = bottom - doorH; y < bottom; y++) {
    for (let x = cx - doorW / 2; x <= cx + doorW / 2; x++) {
      const [r, g, b] = grad((y - m) / (S - 2 * m));
      set(Math.round(x), Math.round(y), r, g, b, 255);
    }
  }
  // ventana
  const winW = half * 0.42;
  const winH = half * 0.34;
  const winY = bodyTop + (bottom - bodyTop) * 0.2;
  for (let y = winY; y < winY + winH; y++) {
    for (let x = cx - winW / 2; x <= cx + winW / 2; x++) {
      const [r, g, b] = grad((y - m) / (S - 2 * m));
      set(Math.round(x), Math.round(y), r, g, b, 255);
    }
  }
  return encodePNG(size, size, px);
}

const outDir = process.argv[2] || path.join(process.cwd(), 'res');
for (const [dpi, size] of Object.entries(SIZES)) {
  const dir = path.join(outDir, dpi);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'ic_launcher.png'), makeIcon(size));
  console.log('OK', dpi, size + 'px');
}
