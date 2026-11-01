// Prints dist/resume.html to dist/resume.pdf with Chrome, so every visitor gets
// the same one-page PDF whatever browser they use. Contact details are laid out
// but hidden, and their positions go to dist/resume-pdf.json; the download button
// writes them in on click (site/js/stamp-contact.mjs), so the public PDF never
// contains them. Locally it also writes the finished PDF to private/.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, PDFString, rgb, setCharacterSpacing } from "pdf-lib";
import { chromium } from "playwright-core";
import { stampContact } from "../site/js/stamp-contact.mjs";

// Letter with the @page margins from resume-theme (6.5mm top/bottom, 12mm sides).
const MM = 72 / 25.4, PX = 0.75;
const PAGE = { width: 612, height: 792, top: 6.5 * MM, left: 12 * MM };
// Tall enough that no scrollbar narrows the layout; the measured page must match the printed one.
// Rounded up: at 725px Chrome already applies the theme's first print-zoom step, which the 725.29px PDF does not.
const VIEWPORT = { width: Math.ceil((PAGE.width - 2 * PAGE.left) / PX), height: 2000 };
const FONT = "site/fonts/RedHatDisplay-Regular-ascii.ttf";

const browser = await chromium.launch({ channel: process.env.CHROME_CHANNEL || "chrome" });
const page = await browser.newPage({ viewport: VIEWPORT });
await page.emulateMedia({ media: "print" });
await page.goto(pathToFileURL(resolve("dist/resume.html")).href, { waitUntil: "networkidle" });

// Hide the contact text but keep its space, then mark each value's baseline.
const marks = await page.evaluate(() => {
  document.documentElement.classList.add("pdf-build");
  const zoom = getComputedStyle(document.querySelector(".page > *")).zoom;
  if (zoom !== "1") throw new Error(`print zoom ${zoom} is active; the measured layout would not match the PDF`);
  return [...document.querySelectorAll(".pc[data-c]")].map((el) => {
    const mark = () => {
      const i = document.createElement("i");
      i.style.cssText = "display:inline-block;width:0;height:0;vertical-align:baseline";
      return i;
    };
    const start = mark(), end = mark();
    el.prepend(start);
    el.append(end);
    const box = start.getBoundingClientRect(), style = getComputedStyle(el);
    const [r, g, b] = style.color.match(/[\d.]+/g).map(Number);
    return { key: el.dataset.c, x: box.left, y: box.top, width: end.getBoundingClientRect().left - box.left, size: parseFloat(style.fontSize), color: [r / 255, g / 255, b / 255] };
  });
});
const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
await browser.close();

// Fail the build rather than publish a resume that spills onto a second page.
const pages = (await PDFDocument.load(pdf)).getPageCount();
if (pages !== 1) throw new Error(`dist/resume.pdf has ${pages} pages; trim the print content to fit one`);

const layout = {
  slots: marks.map((m) => ({
    key: m.key,
    x: +(PAGE.left + m.x * PX).toFixed(2),
    y: +(PAGE.height - PAGE.top - m.y * PX).toFixed(2),
    width: +(m.width * PX).toFixed(2),
    size: +(m.size * PX).toFixed(2),
    color: m.color.map((c) => +c.toFixed(3)),
  })),
};
writeFileSync("dist/resume.pdf", pdf);
writeFileSync("dist/resume-pdf.json", JSON.stringify(layout));
console.log(`dist/resume.pdf: ${layout.slots.length} contact slot(s) reserved`);

// Local only: the finished PDF with contact details, from the same stamping code.
if (!process.env.CI && existsSync("private/contact.json")) {
  const contact = JSON.parse(readFileSync("private/contact.json", "utf8")).basics || {};
  const done = await stampContact({ PDFDocument, PDFString, rgb, setCharacterSpacing, fontkit }, pdf, readFileSync(FONT), layout, contact);
  mkdirSync("private", { recursive: true });
  writeFileSync("private/Robert-DeRose-Resume.pdf", done);
  console.log("private/Robert-DeRose-Resume.pdf: contact details added");
}
