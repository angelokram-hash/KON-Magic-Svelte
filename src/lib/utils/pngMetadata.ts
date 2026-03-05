
/**
 * PNG Metadata Utility (Konplott Refined)
 * Strictly follows the PNG (Portable Network Graphics) Specification.
 */
export class PngMetadata {
  private static readonly SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

  /**
   * Checks if the buffer starts with the valid PNG signature.
   */
  static isPng(buffer: ArrayBuffer): boolean {
    if (buffer.byteLength < 8) return false;
    const bytes = new Uint8Array(buffer, 0, 8);
    for (let i = 0; i < 8; i++) {
      if (bytes[i] !== this.SIGNATURE[i]) return false;
    }
    return true;
  }

  /**
   * Extracts all tEXt chunks from a PNG buffer into a Key-Value map.
   * Keys are returned in their original case, but retrieval should be case-insensitive.
   */
  static getAllMetadata(buffer: ArrayBuffer): Record<string, string> {
    const metadata: Record<string, string> = {};
    if (!this.isPng(buffer)) return metadata;

    const view = new DataView(buffer);
    let offset = 8; // Skip signature

    while (offset + 12 <= buffer.byteLength) {
      const length = view.getUint32(offset);
      const type = this.getChunkType(view, offset);

      if (type === 'tEXt') {
        const data = new Uint8Array(buffer, offset + 8, length);
        const content = this.bytesToLatin1(data);
        const nullIndex = content.indexOf('\0');
        if (nullIndex !== -1) {
          const key = content.substring(0, nullIndex);
          const value = content.substring(nullIndex + 1);
          // Store both original and lowercase for maximum compatibility
          metadata[key] = value;
          metadata[key.toLowerCase()] = value;
        }
      }

      if (type === 'IEND') break;

      const nextOffset = offset + length + 12;
      if (nextOffset <= offset || nextOffset > buffer.byteLength) break;
      offset = nextOffset;
    }

    return metadata;
  }

  /**
   * Injects metadata into a PNG buffer.
   * It removes any existing chunks with the same keys (case-insensitive) first.
   */
  static injectMetadata(buffer: ArrayBuffer, metadata: Record<string, string>): ArrayBuffer {
    if (!this.isPng(buffer)) return buffer;

    const view = new DataView(buffer);
    const chunks: { type: string; data: Uint8Array }[] = [];
    let offset = 8;

    const keysToInjectLower = Object.keys(metadata).map(k => k.toLowerCase());

    // 1. Parse existing chunks, filtering out our keys
    while (offset + 12 <= buffer.byteLength) {
      const length = view.getUint32(offset);
      const type = this.getChunkType(view, offset);
      const data = new Uint8Array(buffer, offset + 8, length);

      let shouldKeep = true;
      if (type === 'tEXt') {
        const content = this.bytesToLatin1(data);
        const nullIndex = content.indexOf('\0');
        if (nullIndex !== -1) {
          const key = content.substring(0, nullIndex).toLowerCase();
          if (keysToInjectLower.includes(key)) {
            shouldKeep = false;
          }
        }
      }

      if (shouldKeep && type !== 'IEND') {
        chunks.push({ type, data });
      }

      if (type === 'IEND') break;
      offset += length + 12;
    }

    // 2. Add new metadata chunks
    for (const [key, value] of Object.entries(metadata)) {
      const content = `${key}\0${value}`;
      chunks.push({ type: 'tEXt', data: this.latin1ToBytes(content) });
    }

    // 3. Assemble the new PNG
    let totalSize = 8;
    for (const chunk of chunks) totalSize += chunk.data.length + 12;
    totalSize += 12; // IEND

    const output = new Uint8Array(totalSize);
    output.set(this.SIGNATURE, 0);

    let currentPos = 8;
    const outView = new DataView(output.buffer);

    for (const chunk of chunks) {
      const len = chunk.data.length;
      outView.setUint32(currentPos, len);
      const typeBytes = this.latin1ToBytes(chunk.type);
      output.set(typeBytes, currentPos + 4);
      output.set(chunk.data, currentPos + 8);

      const crcInput = new Uint8Array(len + 4);
      crcInput.set(typeBytes, 0);
      crcInput.set(chunk.data, 4);
      const crc = this.calculateCRC(crcInput);
      outView.setUint32(currentPos + 8 + len, crc);

      currentPos += len + 12;
    }

    // Add final IEND
    outView.setUint32(currentPos, 0);
    const iendType = this.latin1ToBytes('IEND');
    output.set(iendType, currentPos + 4);
    outView.setUint32(currentPos + 8, this.calculateCRC(iendType));

    return output.buffer;
  }

  private static getChunkType(view: DataView, offset: number): string {
    return String.fromCharCode(
      view.getUint8(offset + 4),
      view.getUint8(offset + 5),
      view.getUint8(offset + 6),
      view.getUint8(offset + 7)
    );
  }

  private static latin1ToBytes(str: string): Uint8Array {
    const bytes = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) {
      bytes[i] = str.charCodeAt(i) & 0xFF;
    }
    return bytes;
  }

  private static bytesToLatin1(bytes: Uint8Array): string {
    let str = '';
    for (let i = 0; i < bytes.length; i++) {
      str += String.fromCharCode(bytes[i]);
    }
    return str;
  }

  private static calculateCRC(data: Uint8Array): number {
    let crc = 0xFFFFFFFF;
    const table = this.getCRCTable();
    for (let i = 0; i < data.length; i++) {
      crc = table[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  private static crcTable: Uint32Array | null = null;
  private static getCRCTable(): Uint32Array {
    if (this.crcTable) return this.crcTable;
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table[i] = c;
    }
    this.crcTable = table;
    return table;
  }
}
