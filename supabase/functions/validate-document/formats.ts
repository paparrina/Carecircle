import { fileTypeFromBuffer } from "npm:file-type@22.3.0";

const text = new TextDecoder();

function matchesLegacyOffice(bytes: Uint8Array, mime: string): boolean {
  // Word and Excel share a Compound File Binary container. Look for the
  // corresponding directory stream entry rather than inferring from its name.
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const containsStream = (name: string) => {
    for (let offset = 512; offset + 128 <= bytes.length; offset += 128) {
      if (view.getUint8(offset + 66) !== 2 ||
          view.getUint16(offset + 64, true) !== (name.length + 1) * 2) continue;
      let matches = true;
      for (let index = 0; index < name.length; index++) {
        if (view.getUint16(offset + index * 2, true) !== name.charCodeAt(index)) {
          matches = false;
          break;
        }
      }
      if (matches && view.getUint16(offset + name.length * 2, true) === 0) return true;
    }
    return false;
  };
  return mime === "application/msword"
    ? containsStream("WordDocument")
    : containsStream("Workbook") || containsStream("Book");
}

const crcTable = Uint32Array.from({ length: 256 }, (_, byte) => {
  let crc = byte;
  for (let bit = 0; bit < 8; bit++) {
    crc = (crc >>> 1) ^ ((crc & 1) === 0 ? 0 : 0xedb88320);
  }
  return crc;
});

function pngCrc(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function hasValidPngChunks(bytes: Uint8Array): boolean {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const header = 0x49484452; // IHDR
  const imageData = 0x49444154; // IDAT
  const end = 0x49454e44; // IEND
  let hasImageData = false;

  for (let offset = 8; offset + 12 <= bytes.length;) {
    const length = view.getUint32(offset);
    const type = view.getUint32(offset + 4);
    const dataEnd = offset + 8 + length;
    if (length > 0x7fffffff || dataEnd + 4 > bytes.length) return false;
    if (offset === 8 ? type !== header || length !== 13 : type === header) return false;
    if (pngCrc(bytes.subarray(offset + 4, dataEnd)) !== view.getUint32(dataEnd)) return false;

    if (type === imageData) hasImageData = true;
    if (type === end) return length === 0 && hasImageData && dataEnd + 4 === bytes.length;
    offset = dataEnd + 4;
  }
  return false;
}

export async function matchesDocumentContent(bytes: Uint8Array, mime: string): Promise<boolean> {
  try {
    const detected = await fileTypeFromBuffer(bytes);
    if (mime === "application/msword" || mime === "application/vnd.ms-excel") {
      return detected?.ext === "cfb" && matchesLegacyOffice(bytes, mime);
    }
    if (detected?.mime !== mime) return false;
    if (mime === "image/png") return hasValidPngChunks(bytes);
    if (mime === "application/pdf") {
      return /^%PDF-[12]\.\d/.test(text.decode(bytes.subarray(0, 8))) &&
        /%%EOF\s*$/.test(text.decode(bytes.subarray(-2048)));
    }
    return true;
  } catch {
    // Truncated or malformed files can cause the format parser to throw.
    return false;
  }
}
