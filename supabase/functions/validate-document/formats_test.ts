import { matchesDocumentContent } from "./formats.ts";

const pdf = new TextEncoder().encode("%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n");
const png = Uint8Array.from(atob(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVQI12P4//8/AAX+Av7czFnnAAAAAElFTkSuQmCC"
), (character) => character.charCodeAt(0));

Deno.test("detects matching PDF and PNG content", async () => {
  if (!await matchesDocumentContent(pdf, "application/pdf")) throw new Error("PDF rejected");
  if (!await matchesDocumentContent(png, "image/png")) throw new Error("PNG rejected");
});

Deno.test("rejects mismatched, text and truncated content", async () => {
  const text = new TextEncoder().encode("This is not a document in binary format.");
  for (const input of [png, text, pdf.subarray(0, 12)]) {
    if (await matchesDocumentContent(input, "application/pdf")) {
      throw new Error("Invalid PDF accepted");
    }
  }
});

Deno.test("rejects PNG with a corrupt checksum, missing end chunk or trailing bytes", async () => {
  const corrupt = png.slice();
  corrupt[42] ^= 1;
  const trailing = new Uint8Array(png.length + 1);
  trailing.set(png);

  for (const input of [corrupt, png.subarray(0, -12), trailing]) {
    if (await matchesDocumentContent(input, "image/png")) {
      throw new Error("Invalid PNG accepted");
    }
  }
});
