/**
 * psdWriter.ts — Minimal PSD (Photoshop) File Writer
 *
 * Produces a valid PSD file with multiple RGBA layers.
 * Spec reference: Adobe Photoshop File Formats Specification
 *
 * Structure:
 *   1. File Header Section
 *   2. Color Mode Data Section  (empty for RGB)
 *   3. Image Resources Section  (minimal)
 *   4. Layer and Mask Info Section  ← layers go here
 *   5. Image Data Section  (merged composite, run-length encoded)
 */

// ─── Low-level byte helpers ──────────────────────────────────────────────────

class ByteWriter {
  private bufs: Uint8Array[] = [];
  private _length = 0;

  get length() { return this._length; }

  private push(buf: Uint8Array) {
    this.bufs.push(buf);
    this._length += buf.length;
  }

  uint8(v: number) {
    const b = new Uint8Array(1);
    b[0] = v & 0xff;
    this.push(b);
  }

  uint16(v: number) {
    const b = new Uint8Array(2);
    const d = new DataView(b.buffer);
    d.setUint16(0, v, false);
    this.push(b);
  }

  int16(v: number) {
    const b = new Uint8Array(2);
    const d = new DataView(b.buffer);
    d.setInt16(0, v, false);
    this.push(b);
  }

  uint32(v: number) {
    const b = new Uint8Array(4);
    const d = new DataView(b.buffer);
    d.setUint32(0, v, false);
    this.push(b);
  }

  int32(v: number) {
    const b = new Uint8Array(4);
    const d = new DataView(b.buffer);
    d.setInt32(0, v, false);
    this.push(b);
  }

  bytes(data: Uint8Array) {
    this.push(new Uint8Array(data));
  }

  zeroes(n: number) {
    this.push(new Uint8Array(n));
  }

  /** Pascal string padded to multiple of padToMultipleOf bytes (total: length byte + chars) */
  pascalString(s: string, padToMultipleOf = 2) {
    const encoded = new TextEncoder().encode(s.substring(0, 255));
    const totalLen = 1 + encoded.length;
    const padded = Math.ceil(totalLen / padToMultipleOf) * padToMultipleOf;
    const buf = new Uint8Array(padded);
    buf[0] = encoded.length;
    buf.set(encoded, 1);
    this.push(buf);
  }

  /** 4-byte ASCII key */
  key(s: string) {
    const b = new Uint8Array(4);
    for (let i = 0; i < 4; i++) b[i] = s.charCodeAt(i) & 0xff;
    this.push(b);
  }

  toUint8Array(): Uint8Array {
    const out = new Uint8Array(this._length);
    let off = 0;
    for (const b of this.bufs) { out.set(b, off); off += b.length; }
    return out;
  }

  lengthPrefixed32(inner: ByteWriter) {
    this.uint32(inner.length);
    this.bytes(inner.toUint8Array());
  }
}

// ─── PackBits RLE ────────────────────────────────────────────────────────────

function packBitsRow(row: Uint8Array): Uint8Array {
  const out: number[] = [];
  let i = 0;
  const n = row.length;
  while (i < n) {
    let runLen = 1;
    while (runLen < 128 && i + runLen < n && row[i + runLen] === row[i]) runLen++;
    if (runLen > 1) {
      out.push((-(runLen - 1)) & 0xff);
      out.push(row[i]);
      i += runLen;
      continue;
    }
    let litLen = 1;
    while (
      litLen < 128 &&
      i + litLen < n &&
      (i + litLen + 1 >= n ||
        row[i + litLen] !== row[i + litLen + 1] ||
        (i + litLen + 2 < n && row[i + litLen + 1] !== row[i + litLen + 2]))
    ) litLen++;
    out.push(litLen - 1);
    for (let k = 0; k < litLen; k++) out.push(row[i + k]);
    i += litLen;
  }
  return new Uint8Array(out);
}

/** Encode all rows of one channel; returns byteCounts per row and packed data */
function encodeChannel(
  pixels: Uint8Array,
  width: number,
  height: number,
  channelOffset: number,
  stride: number
): { byteCounts: number[]; data: Uint8Array } {
  const byteCounts: number[] = [];
  const rowBufs: Uint8Array[] = [];
  for (let y = 0; y < height; y++) {
    const row = new Uint8Array(width);
    for (let x = 0; x < width; x++) {
      row[x] = pixels[(y * width + x) * stride + channelOffset];
    }
    const packed = packBitsRow(row);
    byteCounts.push(packed.length);
    rowBufs.push(packed);
  }
  let total = 0;
  for (const b of rowBufs) total += b.length;
  const data = new Uint8Array(total);
  let off = 0;
  for (const b of rowBufs) { data.set(b, off); off += b.length; }
  return { byteCounts, data };
}

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface PsdLayer {
  name: string;
  /** RGBA pixel data, row-major, width*height*4 bytes */
  pixels: Uint8Array;
  width: number;
  height: number;
  top: number;
  left: number;
}

// ─── PSD Builder ─────────────────────────────────────────────────────────────

export function buildPsd(docWidth: number, docHeight: number, layers: PsdLayer[]): Uint8Array {
  const w = new ByteWriter();

  // ── 1. File Header ──────────────────────────────────────────────────────────
  w.key('8BPS');
  w.uint16(1);      // version: PSD
  w.zeroes(6);      // reserved
  w.uint16(4);      // channels: RGBA
  w.uint32(docHeight);
  w.uint32(docWidth);
  w.uint16(8);      // bits per channel
  w.uint16(3);      // color mode: RGB

  // ── 2. Color Mode Data ──────────────────────────────────────────────────────
  w.uint32(0);

  // ── 3. Image Resources ──────────────────────────────────────────────────────
  w.uint32(0);

  // ── 4. Layer and Mask Info ───────────────────────────────────────────────────
  // Pre-compute all channel image data so we know exact sizes
  // Channel order per layer: alpha(-1), R(0), G(1), B(2)
  const CHANNEL_ORDER = [
    { id: -1, ch: 3 }, // alpha
    { id:  0, ch: 0 }, // R
    { id:  1, ch: 1 }, // G
    { id:  2, ch: 2 }, // B
  ];

  // Pre-encode all channels for all layers
  interface EncodedChannel {
    byteCounts: number[];
    data: Uint8Array;
    totalBytes: number; // 2 (compression) + 2*height (byte counts) + data.length
  }
  const layerEncodedChannels: EncodedChannel[][] = layers.map(layer =>
    CHANNEL_ORDER.map(({ ch }) => {
      const { byteCounts, data } = encodeChannel(layer.pixels, layer.width, layer.height, ch, 4);
      // Each channel block = 2 bytes (compression flag) + 2*height bytes (row counts) + data
      const totalBytes = 2 + 2 * layer.height + data.length;
      return { byteCounts, data, totalBytes };
    })
  );

  const layerInfo = new ByteWriter();

  // Layer count (negative: merged alpha is transparency)
  layerInfo.int16(-(layers.length));

  // ── Per-layer records ───────────────────────────────────────────────────────
  for (let li = 0; li < layers.length; li++) {
    const layer = layers[li];
    layerInfo.int32(layer.top);
    layerInfo.int32(layer.left);
    layerInfo.int32(layer.top + layer.height);
    layerInfo.int32(layer.left + layer.width);

    // Channel count
    layerInfo.uint16(CHANNEL_ORDER.length);

    // Channel descriptors: id (int16) + data length (uint32)
    for (let ci = 0; ci < CHANNEL_ORDER.length; ci++) {
      layerInfo.int16(CHANNEL_ORDER[ci].id);
      layerInfo.uint32(layerEncodedChannels[li][ci].totalBytes);
    }

    // Blend mode signature + mode
    layerInfo.key('8BIM');
    layerInfo.key('norm'); // normal
    layerInfo.uint8(255);  // opacity 100%
    layerInfo.uint8(0);    // clipping: base
    layerInfo.uint8(0);    // flags: 0 = visible, pixel data relevant
    layerInfo.uint8(0);    // filler

    // Additional layer info
    const extra = new ByteWriter();
    extra.uint32(0); // layer mask size = 0
    extra.uint32(0); // blending ranges size = 0
    extra.pascalString(layer.name.substring(0, 31), 4);

    layerInfo.uint32(extra.length);
    layerInfo.bytes(extra.toUint8Array());
  }

  // ── Per-layer channel image data ────────────────────────────────────────────
  for (let li = 0; li < layers.length; li++) {
    const layer = layers[li];
    for (let ci = 0; ci < CHANNEL_ORDER.length; ci++) {
      const enc = layerEncodedChannels[li][ci];
      layerInfo.uint16(1); // compression: PackBits
      for (const bc of enc.byteCounts) layerInfo.uint16(bc);
      layerInfo.bytes(enc.data);
    }
  }

  // Write Layer Info section (length-prefixed, must be padded to multiple of 2)
  const layerInfoBytes = layerInfo.toUint8Array();
  const layerInfoPadded = layerInfoBytes.length % 2 === 0
    ? layerInfoBytes
    : new Uint8Array([...layerInfoBytes, 0]);

  // Layer and Mask Info section = length(layerInfo) + layerInfo + length(globalMask=0)
  const lmSection = new ByteWriter();
  lmSection.uint32(layerInfoPadded.length);
  lmSection.bytes(layerInfoPadded);
  lmSection.uint32(0); // global mask info length = 0

  w.lengthPrefixed32(lmSection);

  // ── 5. Merged Image Data ─────────────────────────────────────────────────────
  // Required section: flat composite of all layers (we use the bottom/first layer = model)
  const modelPixels = layers.length > 0
    ? layers[layers.length - 1].pixels
    : new Uint8Array(docWidth * docHeight * 4).fill(255);

  w.uint16(1); // PackBits compression

  const mergedChannelOrder = [0, 1, 2, 3]; // R, G, B, A
  const allCounts: number[] = [];
  const allData: Uint8Array[] = [];

  for (const ch of mergedChannelOrder) {
    const { byteCounts, data } = encodeChannel(modelPixels, docWidth, docHeight, ch, 4);
    allCounts.push(...byteCounts);
    allData.push(data);
  }

  for (const bc of allCounts) w.uint16(bc);
  for (const d of allData) w.bytes(d);

  return w.toUint8Array();
}

// ─── Canvas helpers ──────────────────────────────────────────────────────────

export async function canvasToRgba(
  img: HTMLImageElement,
  drawW: number,
  drawH: number,
  drawX: number,
  drawY: number,
  docW: number,
  docH: number,
  rotation: number,
  shadow: { enabled: boolean; color: string; blur: number; x: number; y: number; size: number },
): Promise<Uint8Array> {
  const canvas = document.createElement('canvas');
  canvas.width = docW;
  canvas.height = docH;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.clearRect(0, 0, docW, docH);
  ctx.save();
  ctx.translate(drawX, drawY);
  ctx.rotate((rotation * Math.PI) / 180);
  if (shadow.enabled) {
    ctx.shadowColor = shadow.color;
    ctx.shadowBlur  = (shadow.blur / 100) * drawW * shadow.size;
    ctx.shadowOffsetX = (shadow.x / 100) * drawW * shadow.size;
    ctx.shadowOffsetY = (shadow.y / 100) * drawW * shadow.size;
  }
  ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
  ctx.restore();
  return new Uint8Array(ctx.getImageData(0, 0, docW, docH).data);
}

export async function imageUrlToRgba(url: string, docW: number, docH: number): Promise<Uint8Array> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = docW; canvas.height = docH;
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
      ctx.clearRect(0, 0, docW, docH);
      ctx.drawImage(img, 0, 0, docW, docH);
      resolve(new Uint8Array(ctx.getImageData(0, 0, docW, docH).data));
    };
    img.src = url;
  });
}
