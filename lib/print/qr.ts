/**
 * Dependency-free QR Code generator (Model 2, byte mode, EC level M, versions
 * 1–10). Renders to a self-contained SVG string so it can be embedded in any
 * printable document (receipt verification, student ID card, admit card) with
 * no external library, CDN, or network request — safe inside the sandboxed
 * print window. Byte mode + version 10 covers URLs up to ~271 bytes, far more
 * than any verification link needs.
 *
 * Algorithm follows the standard QR reference (Reed–Solomon over GF(256),
 * BCH format/version info, 8 mask patterns scored by penalty).
 */

// ── GF(256) tables (primitive polynomial 0x11D) ────────────────────────────
const EXP = new Array<number>(256);
const LOG = new Array<number>(256);
(function initGF() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 0; i < 255; i++) LOG[EXP[i]] = i;
})();
const gmul = (a: number, b: number) => (a === 0 || b === 0 ? 0 : EXP[(LOG[a] + LOG[b]) % 255]);

// ── Reed–Solomon polynomial ────────────────────────────────────────────────
class Poly {
  num: number[];
  constructor(num: number[], shift = 0) {
    let offset = 0;
    while (offset < num.length && num[offset] === 0) offset++;
    this.num = new Array(num.length - offset + shift).fill(0);
    for (let i = 0; i < num.length - offset; i++) this.num[i] = num[offset + i];
  }
  get(i: number) {
    return this.num[i];
  }
  get length() {
    return this.num.length;
  }
  multiply(e: Poly): Poly {
    const num = new Array(this.length + e.length - 1).fill(0);
    for (let i = 0; i < this.length; i++)
      for (let j = 0; j < e.length; j++) num[i + j] ^= gmul(this.get(i), e.get(j));
    return new Poly(num);
  }
  mod(e: Poly): Poly {
    if (this.length - e.length < 0) return this;
    const ratio = LOG[this.get(0)] - LOG[e.get(0)];
    const num = this.num.slice();
    for (let i = 0; i < e.length; i++) num[i] ^= EXP[(LOG[e.get(i)] + ratio + 255) % 255];
    return new Poly(num).mod(e);
  }
}
function ecPolynomial(ecLen: number): Poly {
  let poly = new Poly([1]);
  for (let i = 0; i < ecLen; i++) poly = poly.multiply(new Poly([1, EXP[i]]));
  return poly;
}

// ── BCH format / version info ──────────────────────────────────────────────
const G15 = 0b10100110111;
const G18 = 0b1111100100101;
const G15_MASK = 0b101010000010010;
const bchDigit = (d: number) => {
  let n = 0;
  while (d !== 0) {
    n++;
    d >>>= 1;
  }
  return n;
};
function bchTypeInfo(data: number): number {
  let d = data << 10;
  while (bchDigit(d) - bchDigit(G15) >= 0) d ^= G15 << (bchDigit(d) - bchDigit(G15));
  return ((data << 10) | d) ^ G15_MASK;
}
function bchTypeNumber(data: number): number {
  let d = data << 12;
  while (bchDigit(d) - bchDigit(G18) >= 0) d ^= G18 << (bchDigit(d) - bchDigit(G18));
  return (data << 12) | d;
}

// ── RS block layout (EC level M) & alignment positions, versions 1–10 ──────
// Each entry: flat [count, totalCodewords, dataCodewords, ...] per block group.
const RS_BLOCKS_M: Record<number, number[]> = {
  1: [1, 26, 16],
  2: [1, 44, 28],
  3: [1, 70, 44],
  4: [2, 50, 32],
  5: [2, 67, 43],
  6: [4, 43, 27],
  7: [4, 49, 31],
  8: [2, 60, 38, 2, 61, 39],
  9: [3, 58, 36, 2, 59, 37],
  10: [4, 69, 43, 1, 70, 44],
};
const ALIGN_POS: Record<number, number[]> = {
  1: [],
  2: [6, 18],
  3: [6, 22],
  4: [6, 26],
  5: [6, 30],
  6: [6, 34],
  7: [6, 22, 38],
  8: [6, 24, 42],
  9: [6, 26, 46],
  10: [6, 28, 50],
};

type Block = { total: number; data: number; ec: number };
function blocksFor(version: number): Block[] {
  const list = RS_BLOCKS_M[version];
  const out: Block[] = [];
  for (let i = 0; i < list.length; i += 3) {
    const [count, total, data] = [list[i], list[i + 1], list[i + 2]];
    for (let c = 0; c < count; c++) out.push({ total, data, ec: total - data });
  }
  return out;
}
const dataCapacity = (version: number) => blocksFor(version).reduce((s, b) => s + b.data, 0);
const charCountBits = (version: number) => (version < 10 ? 8 : 16);

// ── Bit buffer ─────────────────────────────────────────────────────────────
class BitBuffer {
  buffer: number[] = [];
  length = 0;
  putBit(bit: boolean) {
    const i = Math.floor(this.length / 8);
    if (this.buffer.length <= i) this.buffer.push(0);
    if (bit) this.buffer[i] |= 0x80 >>> this.length % 8;
    this.length++;
  }
  put(num: number, len: number) {
    for (let i = 0; i < len; i++) this.putBit(((num >>> (len - i - 1)) & 1) === 1);
  }
}

function utf8Bytes(text: string): number[] {
  return Array.from(new TextEncoder().encode(text));
}

function createData(version: number, bytes: number[]): number[] {
  const buf = new BitBuffer();
  buf.put(4, 4); // byte mode
  buf.put(bytes.length, charCountBits(version));
  for (const b of bytes) buf.put(b, 8);

  const totalDataCount = dataCapacity(version);
  const totalBits = totalDataCount * 8;
  if (buf.length + 4 <= totalBits) buf.put(0, 4); // terminator
  while (buf.length % 8 !== 0) buf.putBit(false);
  while (buf.buffer.length < totalDataCount) {
    buf.buffer.push(0xec);
    if (buf.buffer.length >= totalDataCount) break;
    buf.buffer.push(0x11);
  }
  return buf.buffer.slice(0, totalDataCount);
}

function interleave(version: number, dataCodewords: number[]): number[] {
  const blocks = blocksFor(version);
  const dc: number[][] = [];
  const ec: number[][] = [];
  let offset = 0;
  let maxDc = 0;
  let maxEc = 0;
  for (const b of blocks) {
    const d = dataCodewords.slice(offset, offset + b.data);
    offset += b.data;
    const modPoly = new Poly(d, b.ec).mod(ecPolynomial(b.ec));
    const ecBytes: number[] = [];
    for (let i = 0; i < b.ec; i++) {
      const idx = i + modPoly.length - b.ec;
      ecBytes.push(idx >= 0 ? modPoly.get(idx) : 0);
    }
    dc.push(d);
    ec.push(ecBytes);
    maxDc = Math.max(maxDc, d.length);
    maxEc = Math.max(maxEc, ecBytes.length);
  }
  const out: number[] = [];
  for (let i = 0; i < maxDc; i++) for (const d of dc) if (i < d.length) out.push(d[i]);
  for (let i = 0; i < maxEc; i++) for (const e of ec) if (i < e.length) out.push(e[i]);
  return out;
}

// ── Mask functions ─────────────────────────────────────────────────────────
function maskFn(pattern: number, i: number, j: number): boolean {
  switch (pattern) {
    case 0:
      return (i + j) % 2 === 0;
    case 1:
      return i % 2 === 0;
    case 2:
      return j % 3 === 0;
    case 3:
      return (i + j) % 3 === 0;
    case 4:
      return (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0;
    case 5:
      return ((i * j) % 2) + ((i * j) % 3) === 0;
    case 6:
      return (((i * j) % 2) + ((i * j) % 3)) % 2 === 0;
    default:
      return (((i * j) % 3) + ((i + j) % 2)) % 2 === 0;
  }
}

type Grid = (boolean | null)[][];

function buildModules(version: number, codewords: number[], maskPattern: number, test: boolean): Grid {
  const count = version * 4 + 17;
  const m: Grid = Array.from({ length: count }, () => new Array<boolean | null>(count).fill(null));

  const probe = (row: number, col: number) => {
    for (let r = -1; r <= 7; r++) {
      if (row + r <= -1 || count <= row + r) continue;
      for (let c = -1; c <= 7; c++) {
        if (col + c <= -1 || count <= col + c) continue;
        const on =
          (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
          (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
          (r >= 2 && r <= 4 && c >= 2 && c <= 4);
        m[row + r][col + c] = on;
      }
    }
  };
  probe(0, 0);
  probe(count - 7, 0);
  probe(0, count - 7);

  // Timing
  for (let r = 8; r < count - 8; r++) if (m[r][6] === null) m[r][6] = r % 2 === 0;
  for (let c = 8; c < count - 8; c++) if (m[6][c] === null) m[6][c] = c % 2 === 0;

  // Alignment
  const pos = ALIGN_POS[version];
  for (const row of pos)
    for (const col of pos) {
      if (m[row][col] !== null) continue;
      for (let r = -2; r <= 2; r++)
        for (let c = -2; c <= 2; c++)
          m[row + r][col + c] = r === -2 || r === 2 || c === -2 || c === 2 || (r === 0 && c === 0);
    }

  // Version info (v >= 7)
  if (version >= 7) {
    const bits = bchTypeNumber(version);
    for (let i = 0; i < 18; i++) {
      const mod = !test && ((bits >> i) & 1) === 1;
      m[Math.floor(i / 3)][(i % 3) + count - 8 - 3] = mod;
      m[(i % 3) + count - 8 - 3][Math.floor(i / 3)] = mod;
    }
  }

  // Format info (EC level M = 0)
  const fmt = bchTypeInfo((0 << 3) | maskPattern);
  for (let i = 0; i < 15; i++) {
    const mod = !test && ((fmt >> i) & 1) === 1;
    if (i < 6) m[i][8] = mod;
    else if (i < 8) m[i + 1][8] = mod;
    else m[count - 15 + i][8] = mod;
  }
  for (let i = 0; i < 15; i++) {
    const mod = !test && ((fmt >> i) & 1) === 1;
    if (i < 8) m[8][count - i - 1] = mod;
    else if (i < 9) m[8][15 - i - 1 + 1] = mod;
    else m[8][15 - i - 1] = mod;
  }
  m[count - 8][8] = !test; // dark module

  // Data
  let byteIndex = 0;
  let bitIndex = 7;
  let inc = -1;
  let row = count - 1;
  for (let col = count - 1; col > 0; col -= 2) {
    if (col === 6) col--;
    for (;;) {
      for (let c = 0; c < 2; c++) {
        if (m[row][col - c] === null) {
          let dark = false;
          if (byteIndex < codewords.length) dark = ((codewords[byteIndex] >>> bitIndex) & 1) === 1;
          if (maskFn(maskPattern, row, col - c)) dark = !dark;
          m[row][col - c] = dark;
          bitIndex--;
          if (bitIndex === -1) {
            byteIndex++;
            bitIndex = 7;
          }
        }
      }
      row += inc;
      if (row < 0 || count <= row) {
        row -= inc;
        inc = -inc;
        break;
      }
    }
  }
  return m;
}

function penalty(m: Grid): number {
  const n = m.length;
  const dark = (r: number, c: number) => m[r][c] === true;
  let score = 0;
  // Rule 1: runs of 5+
  for (let r = 0; r < n; r++) {
    for (let cc = 0; cc < 2; cc++) {
      let prev: boolean | null = null;
      let run = 0;
      for (let i = 0; i < n; i++) {
        const v = cc === 0 ? dark(r, i) : dark(i, r);
        if (v === prev) run++;
        else {
          if (run >= 5) score += run - 2;
          prev = v;
          run = 1;
        }
      }
      if (run >= 5) score += run - 2;
    }
  }
  // Rule 2: 2x2 blocks
  for (let r = 0; r < n - 1; r++)
    for (let c = 0; c < n - 1; c++) {
      const v = dark(r, c);
      if (v === dark(r, c + 1) && v === dark(r + 1, c) && v === dark(r + 1, c + 1)) score += 3;
    }
  // Rule 3: finder-like 1:1:3:1:1 patterns
  const pat = [true, false, true, true, true, false, true];
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) {
      if (c + 6 < n && pat.every((p, k) => dark(r, c + k) === p)) score += 40;
      if (r + 6 < n && pat.every((p, k) => dark(r + k, c) === p)) score += 40;
    }
  // Rule 4: dark ratio
  let darkCount = 0;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (dark(r, c)) darkCount++;
  const ratio = (darkCount * 100) / (n * n);
  score += Math.floor(Math.abs(ratio - 50) / 5) * 10;
  return score;
}

/** Compute the QR module matrix (true = dark) for the given text. */
export function qrMatrix(text: string): boolean[][] {
  const bytes = utf8Bytes(text);
  let version = 1;
  while (version < 10) {
    const cap = dataCapacity(version);
    const need = Math.ceil((4 + charCountBits(version) + 8 * bytes.length) / 8);
    if (cap >= need) break;
    version++;
  }
  const codewords = interleave(version, createData(version, bytes));

  let best = 0;
  let min = Infinity;
  for (let p = 0; p < 8; p++) {
    const score = penalty(buildModules(version, codewords, p, true));
    if (score < min) {
      min = score;
      best = p;
    }
  }
  return buildModules(version, codewords, best, false).map((row) => row.map((v) => v === true));
}

/** Render a QR code as a crisp, self-contained SVG string. */
export function qrSvg(
  text: string,
  opts: { size?: number; margin?: number; dark?: string; light?: string } = {}
): string {
  const { size = 132, margin = 2, dark = "#101820", light = "transparent" } = opts;
  const m = qrMatrix(text);
  const count = m.length;
  const dim = count + margin * 2;
  let path = "";
  for (let r = 0; r < count; r++)
    for (let c = 0; c < count; c++)
      if (m[r][c]) path += `M${c + margin},${r + margin}h1v1h-1z`;
  const bg =
    light === "transparent" ? "" : `<rect width="${dim}" height="${dim}" fill="${light}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${dim} ${dim}" shape-rendering="crispEdges" role="img" aria-label="QR code">${bg}<path d="${path}" fill="${dark}"/></svg>`;
}
