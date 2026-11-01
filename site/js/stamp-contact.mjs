// Writes contact details into the build-time resume PDF, at the spots the build
// reserved for them (see scripts/resume-pdf.mjs). Shared by the browser download
// button and the local build, so both produce the same file.
//
// lib is pdf-lib ({ PDFDocument, PDFString, rgb, setCharacterSpacing }) plus fontkit; the browser
// passes the vendored globals and Node passes the npm modules.
export async function stampContact(lib, pdfBytes, fontBytes, layout, contact) {
  const { PDFDocument, PDFString, rgb, setCharacterSpacing, fontkit } = lib;
  const doc = await PDFDocument.load(pdfBytes);
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(fontBytes, { subset: true });
  const page = doc.getPage(0);
  const href = { email: (v) => `mailto:${v}`, phone: (v) => `tel:${v.replace(/[^\d+]/g, "")}` };

  for (const slot of layout.slots) {
    const text = contact[slot.key];
    if (!text) continue;
    // Chrome kerns the text it lays out and pdf-lib does not, so spread the
    // difference across the characters to fill exactly the space Chrome reserved.
    const natural = font.widthOfTextAtSize(text, slot.size);
    const width = slot.width || natural;
    page.pushOperators(setCharacterSpacing((width - natural) / text.length));
    page.drawText(text, { x: slot.x, y: slot.y, size: slot.size, font, color: rgb(...slot.color) });
    page.pushOperators(setCharacterSpacing(0));
    if (!href[slot.key]) continue;
    // A clickable link over the text, like the other contact links Chrome writes.
    const link = doc.context.register(
      doc.context.obj({
        Type: "Annot",
        Subtype: "Link",
        Rect: [slot.x, slot.y - slot.size * 0.25, slot.x + width, slot.y + slot.size * 0.9],
        Border: [0, 0, 0],
        A: { Type: "Action", S: "URI", URI: PDFString.of(href[slot.key](text)) },
      }),
    );
    page.node.addAnnot(link);
  }
  return doc.save();
}
