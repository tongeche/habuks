const PDF_PAGE_WIDTH = 595.28;
const PDF_PAGE_HEIGHT = 841.89;
const encoder = new TextEncoder();

const encodeAscii = (value) => encoder.encode(String(value || ""));

const byteLength = (part) => {
  if (part instanceof Uint8Array) return part.byteLength;
  return encodeAscii(part).byteLength;
};

const appendPart = (collector, part) => {
  collector.push(part instanceof Uint8Array ? part : encodeAscii(part));
};

const dataUrlToBytes = (value) => {
  const match = String(value || "").match(/^data:image\/jpeg;base64,(.+)$/i);
  if (!match) {
    throw new Error("Expected a JPEG data URL for PDF export.");
  }
  const binary = atob(match[1]);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

const canvasToJpegPage = (canvas, quality = 0.92) => {
  const dataUrl = canvas.toDataURL("image/jpeg", quality);
  return {
    width: canvas.width,
    height: canvas.height,
    bytes: dataUrlToBytes(dataUrl),
  };
};

export function buildPdfBlobFromImagePages(pages = []) {
  if (!Array.isArray(pages) || pages.length === 0) {
    throw new Error("At least one rendered report page is required.");
  }

  const objectParts = [];
  const pageReferences = [];

  objectParts.push({
    number: 1,
    parts: ["<< /Type /Catalog /Pages 2 0 R >>"],
  });

  pages.forEach((page, index) => {
    const imageObjectNumber = 3 + index * 3;
    const contentObjectNumber = imageObjectNumber + 1;
    const pageObjectNumber = imageObjectNumber + 2;
    const imageName = "/Im1";
    const imageBytes = page.bytes;
    const contentStream = `q\n${PDF_PAGE_WIDTH.toFixed(2)} 0 0 ${PDF_PAGE_HEIGHT.toFixed(2)} 0 0 cm\n${imageName} Do\nQ`;
    const contentBytes = encodeAscii(contentStream);

    objectParts.push({
      number: imageObjectNumber,
      parts: [
        `<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imageBytes.length} >>\nstream\n`,
        imageBytes,
        "\nendstream",
      ],
    });
    objectParts.push({
      number: contentObjectNumber,
      parts: [`<< /Length ${contentBytes.length} >>\nstream\n`, contentBytes, "\nendstream"],
    });
    objectParts.push({
      number: pageObjectNumber,
      parts: [
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PDF_PAGE_WIDTH.toFixed(2)} ${PDF_PAGE_HEIGHT.toFixed(2)}] /Resources << /XObject << ${imageName} ${imageObjectNumber} 0 R >> >> /Contents ${contentObjectNumber} 0 R >>`,
      ],
    });
    pageReferences.push(`${pageObjectNumber} 0 R`);
  });

  objectParts.push({
    number: 2,
    parts: [`<< /Type /Pages /Kids [${pageReferences.join(" ")}] /Count ${pageReferences.length} >>`],
  });

  objectParts.sort((a, b) => a.number - b.number);

  const pdfParts = [];
  const offsets = [];
  let offset = 0;
  const push = (part) => {
    appendPart(pdfParts, part);
    offset += byteLength(part);
  };

  push("%PDF-1.4\n");

  objectParts.forEach((objectPart) => {
    offsets[objectPart.number] = offset;
    push(`${objectPart.number} 0 obj\n`);
    objectPart.parts.forEach((part) => push(part));
    push("\nendobj\n");
  });

  const xrefOffset = offset;
  const maxObjectNumber = objectParts.reduce(
    (maxValue, objectPart) => Math.max(maxValue, objectPart.number),
    0
  );

  push(`xref\n0 ${maxObjectNumber + 1}\n`);
  push("0000000000 65535 f \n");
  for (let index = 1; index <= maxObjectNumber; index += 1) {
    const objectOffset = offsets[index] || 0;
    push(`${String(objectOffset).padStart(10, "0")} 00000 n \n`);
  }
  push(`trailer << /Size ${maxObjectNumber + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

  return new Blob(pdfParts, { type: "application/pdf" });
}

export function buildPdfFileFromCanvasPages(options = {}) {
  const canvases = Array.isArray(options.canvases) ? options.canvases : [];
  const fileName = String(options.fileName || "document.pdf");
  const quality = Number.isFinite(options.quality) ? options.quality : 0.92;
  const pages = canvases.map((canvas) => canvasToJpegPage(canvas, quality));
  const blob = buildPdfBlobFromImagePages(pages);
  return new File([blob], fileName, { type: "application/pdf" });
}
