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

export async function matchesDocumentContent(bytes: Uint8Array, mime: string): Promise<boolean> {
  try {
    const detected = await fileTypeFromBuffer(bytes);
    if (mime === "application/msword" || mime === "application/vnd.ms-excel") {
      return detected?.ext === "cfb" && matchesLegacyOffice(bytes, mime);
    }
    if (detected?.mime !== mime) return false;
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
