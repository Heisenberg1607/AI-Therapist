import PDFDocument from "pdfkit";

// Render a report (title + lightly-formatted markdown body) into a PDF buffer.
// Handles the small markdown subset our LLM emits: #/##/### headings, - / * bullets,
// and strips ** bold markers. Anything else is rendered as a paragraph.
export function renderReportPdf(
  title: string,
  body: string,
  meta?: { generatedAt?: Date },
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 56 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(20).fillColor("#111111").text(title);
    doc.moveDown(0.4);
    doc
      .fontSize(9)
      .fillColor("#777777")
      .text(`Generated ${(meta?.generatedAt ?? new Date()).toLocaleString()}`);
    doc.moveDown(1);

    const para = () => doc.fontSize(11).fillColor("#222222");
    para();

    for (const rawLine of body.split("\n")) {
      const line = rawLine.replace(/\*\*/g, "").trimEnd();
      const trimmed = line.trim();

      if (!trimmed) {
        doc.moveDown(0.5);
        continue;
      }
      if (trimmed.startsWith("### ")) {
        doc.moveDown(0.3).fontSize(12).fillColor("#000000").text(trimmed.slice(4));
        para();
      } else if (trimmed.startsWith("## ")) {
        doc.moveDown(0.4).fontSize(14).fillColor("#000000").text(trimmed.slice(3));
        para();
      } else if (trimmed.startsWith("# ")) {
        doc.moveDown(0.5).fontSize(16).fillColor("#000000").text(trimmed.slice(2));
        para();
      } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
        doc.text(`•  ${trimmed.slice(2)}`, { indent: 12 });
      } else {
        doc.text(trimmed);
      }
    }

    doc.end();
  });
}
