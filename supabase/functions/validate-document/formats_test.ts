import { matchesDocumentContent } from "./formats.ts";

const pdf = new TextEncoder().encode("%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n");
const png = Uint8Array.from(atob(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jf7sAAAAASUVORK5CYII="
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
