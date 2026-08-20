// Yoxa's trigger endpoint has only ever been proven to work with a PDF
// (the intake test earlier this session converted the brief to PDF before
// uploading) — raw markdown was an unverified guess. Renders the brief's
// fixed, predictable structure (## headings, plain paragraphs, "- " bullet
// lists — see generate-brief.ts's system instruction, which never asks for
// bold/italic/tables) directly with pdfkit rather than pulling in a full
// markdown-to-HTML-to-PDF toolchain (headless Chrome) that's real weight
// and cold-start risk for a one-shot-per-project conversion.

import PDFDocument from "pdfkit";

export async function markdownToPdf(markdown: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 54, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.font("Helvetica-Bold").fontSize(18).text("Conversation Brief").moveDown(1);
    doc.font("Helvetica").fontSize(10);

    const lines = markdown.split("\n");
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (line === "") {
        doc.moveDown(0.5);
        continue;
      }
      if (line.startsWith("## ")) {
        doc.moveDown(0.5).font("Helvetica-Bold").fontSize(13).text(line.slice(3)).moveDown(0.25);
        doc.font("Helvetica").fontSize(10);
      } else if (line.startsWith("# ")) {
        doc.moveDown(0.5).font("Helvetica-Bold").fontSize(15).text(line.slice(2)).moveDown(0.25);
        doc.font("Helvetica").fontSize(10);
      } else if (line.startsWith("- ") || line.startsWith("* ")) {
        doc.text(`•  ${line.slice(2)}`, { indent: 12 });
      } else {
        doc.text(line);
      }
    }

    doc.end();
  });
}
