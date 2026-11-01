import { existsSync, readFileSync } from "node:fs";

// JSON Resume theme for robertderose.github.io. Dark hex lattice on screen,
// light two-column pages in print. render(resume) returns one HTML document.

const PALETTE = ["#6f9cff", "#b98cff", "#6fdc8c", "#ff9a5c", "#ff6f96", "#5fd4e0"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const esc = (s = "") =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const paras = (s = "") => s.split(/\n{2,}/).map((p) => `<p>${esc(p)}</p>`).join("");
const host = (u = "") => u.replace(/^https?:\/\//, "").replace(/\/$/, "");

// Contact details never live in resume.json. They come from RESUME_EMAIL and
// RESUME_PHONE (deploy secrets) or the git-ignored private/contact.json.
const CONTACT = (() => {
  let file = {};
  if (existsSync("private/contact.json")) file = JSON.parse(readFileSync("private/contact.json", "utf8")).basics || {};
  const env = globalThis.process?.env || {};
  return { email: env.RESUME_EMAIL || file.email, phone: env.RESUME_PHONE || file.phone };
})();

// Print-only text: empty spans whose CSS ::before content holds the value in
// small chunks of escaped characters, so neither the HTML nor the CSS contains
// anything an email or phone regex would match.
const cssEscape = (t) => [...t].map((c) => "\\" + c.codePointAt(0).toString(16) + " ").join("");
function printOnly(value, rules) {
  const spans = [];
  for (let i = 0; i < value.length; i += 3) {
    const k = `k${rules.length}`;
    rules.push(`.${k}::before{content:"${cssEscape(value.slice(i, i + 3))}"}`);
    spans.push(`<span class="${k}"></span>`);
  }
  return `<span class="pc">${spans.join("")}</span>`;
}

// On screen the email is a button; the address is stored reversed and
// base64-encoded and assembled in the browser on click.
const reveal = (e) =>
  `<button class="reveal" type="button" data-e="${Buffer.from([...e].reverse().join("")).toString("base64")}">Show email</button>`;

// Dates are ISO 8601 at year, month, or day precision; show only what was given.
function date(s) {
  if (!s) return "";
  const [y, m] = s.split("-");
  return m ? `${MONTHS[+m - 1]} ${y}` : y;
}
const initials = (n = "") => n.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
const range = (a, b) => `${date(a)} – ${b ? date(b) : "Present"}`;

// cls lets a job carry separate web and print bullets (printHighlights).
const list = (items = [], cls = "") =>
  items.length ? `<ul${cls ? ` class="${cls}"` : ""}>${items.map((h) => `<li>${esc(h)}</li>`).join("")}</ul>` : "";
// Web bullets can be grouped under era headings (highlightGroups).
const webBullets = (w) =>
  w.highlightGroups
    ? `<div class="web-only">${w.highlightGroups.map((g) => `<h4 class="era">${esc(g.title)}</h4>${list(g.highlights)}`).join("")}</div>`
    : list(w.highlights, "web-only");
// Print bullets are strings or {text, preAI}; pre-AI work gets an open bullet,
// explained by a key on the job's date line.
const printBullets = (items = []) => {
  if (!items.length) return "";
  const lis = items.map((h) => (typeof h === "string" ? `<li>${esc(h)}</li>` : `<li${h.preAI ? ' class="pre"' : ""}>${esc(h.text)}</li>`));
  return `<ul class="print-only">${lis.join("")}</ul>`;
};
const tags = (items = []) => (items.length ? `<div class="tags">${items.map((k) => `<span>${esc(k)}</span>`).join("")}</div>` : "");
const section = (id, title, body) => (body ? `<section class="${id}"><h2>${title}</h2>${body}</section>` : "");

function header(b = {}, rules = []) {
  const contact = [
    CONTACT.email && reveal(CONTACT.email),
    CONTACT.email && printOnly(CONTACT.email, rules),
    CONTACT.phone && printOnly(CONTACT.phone, rules),
    b.url && `<a href="${esc(b.url)}">${esc(host(b.url))}</a>`,
    // Print shows the address itself, since a bare "GitHub" means nothing on paper.
    ...(b.profiles || []).map((p) => `<a href="${esc(p.url)}"><span class="web-only">${esc(p.network)}</span><span class="print-only">${esc(host(p.url).replace(/^www\./, ""))}</span></a>`),
  ].filter(Boolean);
  return `
  <header class="top">
    <div class="photo"><span>${b.image ? `<img id="avatar" src="${esc(b.image)}" alt="${esc(b.name)}"><canvas id="hexface" aria-hidden="true" title="Click to scatter"></canvas>` : `<b>${esc(initials(b.name))}</b>`}</span></div>
    <div class="id">
      <p class="label">${esc(b.label)}</p>
      <h1>${esc(b.name)}</h1>
      <nav class="contact">${contact.join("")}</nav>
    </div>
    <div class="actions">
      <button class="btn" type="button" onclick="print()">Print / Save PDF</button>
      ${b.url ? `<a class="btn ghost" href="${esc(b.url)}">Projects</a>` : ""}
    </div>
  </header>
  ${b.summary ? `<div class="summary">${paras(b.summary)}</div>` : ""}`;
}

const work = (items = []) =>
  items
    .map(
      (w) => `
    <article class="job">
      <div class="when">${range(w.startDate, w.endDate)}${(w.printHighlights || []).some((h) => h.preAI) ? `<span class="key print-only"> · <i class="hx"></i> built before AI coding agents</span>` : ""}</div>
      <h3>${esc(w.position)} <span>${w.url ? `<a href="${esc(w.url)}">${esc(w.name)}</a>` : esc(w.name)}</span></h3>
      ${w.location ? `<div class="where">${esc(w.location)}</div>` : ""}
      ${w.summary ? `<p>${esc(w.summary)}</p>` : ""}
      ${w.printHighlights ? webBullets(w) + printBullets(w.printHighlights) : list(w.highlights)}
    </article>`,
    )
    .join("");

const projects = (items = []) =>
  items.length
    ? `<ul class="picks">${items
        .map(
          (p, i) => `
      <li style="--pc:${esc(p.color || PALETTE[i % PALETTE.length])}">
        <h3>${p.url ? `<a href="${esc(p.url)}">${esc(p.name)}</a>` : esc(p.name)}</h3>
        ${p.description ? `<p>${esc(p.description)}</p>` : ""}
        ${list(p.printHighlights, "print-only")}
      </li>`,
        )
        .join("")}</ul>`
    : "";

const skills = (items = []) =>
  items.map((s) => `<div class="skill"><h3>${esc(s.name)}</h3>${tags(s.keywords)}</div>`).join("");

// Print skills as two explicit columns split by text length; WebKit drops CSS multi-column when paginating.
const skillColumns = (items = []) => {
  const size = (s) => s.name.length + (s.keywords || []).join(", ").length + 40;
  const half = items.reduce((n, s) => n + size(s), 0) / 2;
  let run = 0, cut = items.length;
  for (let i = 0; i < items.length; i++) { if (run + size(items[i]) / 2 > half) { cut = i; break; } run += size(items[i]); }
  return `<div class="skill-cols"><div>${skills(items.slice(0, cut))}</div><div>${skills(items.slice(cut))}</div></div>`;
};

const education = (items = []) =>
  items
    .map(
      (e) => `
    <div class="edu">
      <h3>${esc(e.institution)}</h3>
      <p>${esc([e.studyType, e.area].filter(Boolean).join(", "))}</p>
      <div class="when">${range(e.startDate, e.endDate)}${e.score ? ` · ${esc(e.score)}` : ""}</div>
    </div>`,
    )
    .join("");

// Red Hat is self-hosted as static (non-variable) fonts. Google serves variable
// fonts, which Chrome embeds in PDFs as Type 3 glyphs that Preview cannot select.
const FONTS = [["Red Hat Display", "RedHatDisplay", [[400, "Regular"], [500, "Medium"], [700, "Bold"]]], ["Red Hat Mono", "RedHatMono", [[400, "Regular"], [500, "Medium"]]]]
  .flatMap(([family, file, weights]) => weights.map(([w, name]) => `@font-face{font-family:"${family}";font-weight:${w};font-display:swap;src:url(fonts/${file}-${name}.woff2) format("woff2")}`))
  .join("\n");

const CSS = `
/* Layout: header band, summary, then main (experience, projects) beside a sidebar; screen is dark Hexways, print is light paper */
:root {
  --bg: #070a10; --panel: #0d121c; --line: #1c2536; --fg: #eef2fa; --muted: #95a0b6; --soft: #c9d0de; --accent: #6f9cff; --brand: #ef4b5f;
  --display: Anton, Impact, sans-serif; --sans: "Red Hat Display", system-ui, sans-serif; --mono: "Red Hat Mono", ui-monospace, monospace;
  color-scheme: dark;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--fg); font: 16px/1.55 var(--sans); }
canvas { position: fixed; inset: 0; width: 100%; height: 100%; z-index: 0; pointer-events: none; }
a { color: inherit; text-decoration-color: color-mix(in srgb, currentColor 40%, transparent); text-underline-offset: 3px; }
a:hover { color: var(--accent); }
.page { position: relative; z-index: 1; max-width: 1120px; margin: 0 auto; padding: 56px max(16px, env(safe-area-inset-right)) 72px max(16px, env(safe-area-inset-left)); }
.top { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 28px; align-items: center; }
.photo { --w: 150px; width: var(--w); height: calc(var(--w) * 1.1547); clip-path: polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%); background: var(--brand); padding: 3px; }
.photo span { display: block; width: 100%; height: 100%; clip-path: inherit; overflow: hidden; background: var(--panel); }
.photo span { position: relative; }
.photo img { width: 100%; height: 100%; object-fit: cover; }
.photo canvas { position: absolute; inset: 0; width: 100%; height: 100%; cursor: crosshair; }
.photo.mosaic img { opacity: 0; transition: opacity .4s; }
.photo.mosaic.ready img { opacity: 1; }
.photo b { display: grid; place-items: center; height: 100%; font: 54px var(--display); letter-spacing: .02em; background: var(--brand); -webkit-background-clip: text; background-clip: text; color: transparent; }
.label { font: 500 13px var(--mono); letter-spacing: .16em; text-transform: uppercase; color: var(--accent); margin: 0; }
h1 { font: clamp(52px, 8vw, 104px)/.88 var(--display); text-transform: uppercase; margin: 6px 0 14px; letter-spacing: .005em; }
.reveal { padding: 0; border: 0; background: none; font: inherit; color: inherit; cursor: pointer; text-decoration: underline; text-decoration-style: dotted; text-underline-offset: 3px; }
.reveal:hover { color: var(--accent); }
.pc { display: none; }
button.btn { border: 0; cursor: pointer; }
.contact { display: flex; flex-wrap: wrap; gap: 6px 18px; font: 14px var(--mono); color: var(--soft); }
.actions { display: flex; flex-direction: column; gap: 10px; }
.btn { display: inline-block; text-align: center; background: var(--accent); color: #070a10; text-decoration: none; padding: 10px 20px; font: 500 14px var(--mono); clip-path: polygon(10px 0, 100% 0, calc(100% - 10px) 100%, 0 100%); transition: transform .2s; }
.btn:hover { color: #070a10; transform: translateY(-2px); }
.btn.ghost { background: #ffffff14; color: var(--fg); }
.summary { margin: 36px 0 8px; max-width: 72ch; font-size: 18px; color: var(--soft); }
.summary p { margin: 0 0 12px; }
.cols { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 48px; margin-top: 40px; }
section { margin-bottom: 44px; }
h2 { font: 500 13px var(--mono); letter-spacing: .18em; text-transform: uppercase; color: var(--muted); margin: 0 0 20px; display: flex; align-items: center; gap: 12px; }
h2::before { content: ""; width: 12px; height: 14px; background: var(--accent); clip-path: polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%); }
h2::after { content: ""; flex: 1; height: 1px; background: var(--line); }
h3 { margin: 0; font-size: 19px; line-height: 1.3; letter-spacing: -.01em; }
.when { font: 13px var(--mono); color: var(--muted); }
.where { font-size: 14px; color: var(--muted); }
.job { position: relative; padding: 0 0 28px 28px; border-left: 1px solid var(--line); margin-left: 6px; }
.job::before { content: ""; position: absolute; left: -8px; top: 3px; width: 15px; height: 17.3px; background: var(--accent); clip-path: polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%); }
.job::after { content: ""; position: absolute; left: -5px; top: 6.5px; width: 9px; height: 10.4px; background: var(--bg); clip-path: polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%); }
.job:last-child { padding-bottom: 0; }
.print-only { display: none; }
.era { font: 500 12px var(--mono); letter-spacing: .12em; text-transform: uppercase; color: var(--muted); margin: 16px 0 6px; }
.job h3 span { font-weight: 400; color: var(--muted); }
.job h3 span::before { content: "@ "; color: var(--accent); }
.job p { margin: 8px 0; color: var(--soft); }
ul { margin: 8px 0 0; padding-left: 18px; color: var(--soft); }
li { margin-bottom: 5px; }
li::marker { color: var(--accent); }
.picks { list-style: none; padding: 0; margin: 0; display: grid; gap: 14px; }
.picks li { position: relative; padding-left: 22px; margin: 0; }
.picks li::before { content: ""; position: absolute; left: 0; top: .3em; width: 12px; height: 14px; background: var(--pc); clip-path: polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%); }
.picks h3 { font-size: 15px; }
.picks h3 a { color: var(--pc); text-decoration: none; }
.picks h3 a:hover { text-decoration: underline; }
.picks p { margin: 2px 0 0; font-size: 14px; line-height: 1.4; color: var(--soft); }
.tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
.tags span { font: 12px var(--mono); border: 1px solid color-mix(in srgb, var(--pc, var(--accent)) 50%, transparent); color: var(--pc, var(--soft)); padding: 1px 8px; border-radius: 3px; }
aside .skill { margin-bottom: 18px; }
aside .skill h3, aside .edu h3 { font-size: 15px; }
aside .tags { margin-top: 8px; }
.edu p { margin: 2px 0; color: var(--soft); }
@media (max-width: 860px) {
  .cols { grid-template-columns: 1fr; gap: 0; }
  .top { grid-template-columns: auto minmax(0, 1fr); }
  .actions { grid-column: 1 / -1; flex-direction: row; flex-wrap: wrap; }
  .photo { --w: 96px; }
}
@media (max-width: 520px) { .top { grid-template-columns: 1fr; } }
@media (prefers-reduced-motion: reduce) { .btn, .project { transition: none; } }

/* Print and PDF: light paper, compact type, no lattice or buttons. */
/* Safari lays print out ~677px wide (Chrome and Firefox use Letter's 725px); a container query zooms to match, with a little slack, so it stays one page. */
@media print { .page { container-type: inline-size; } @container (max-width: 715px) { .page > * { zoom: .925; } } }
@page { size: Letter; margin: 6.5mm 12mm; }
@media print {
  :root { --bg: #fff; --panel: #fff; --line: #d9dde5; --fg: #0f1320; --muted: #5d6576; --soft: #2a3040; --accent: #3b5fd6; color-scheme: light; }
  body { font-size: 9.4pt; line-height: 1.33; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  canvas, .actions, .reveal { display: none; }
  .pc { display: inline; }
  .photo.mosaic img { opacity: 1; transition: none; }
  .page { padding: 0; max-width: none; }
  .top { grid-template-columns: auto 1fr; gap: 18px; }
  .photo { --w: 74px; }
  .photo b { font-size: 30pt; }
  h1 { font-size: 40pt; margin: 2px 0 6px; }
  .label { font-size: 8pt; }
  .contact { font: 8pt var(--sans); gap: 2px 9px; }
  .contact a { text-decoration: none; }
  .summary { font-size: 10pt; margin: 6px 0 0; max-width: none; }
  .summary p { margin: 0 0 6px; }
  .cols { grid-template-columns: minmax(0, 1fr) 230px; gap: 20px; margin-top: 12px; }
  section { margin-bottom: 9px; }
  h2 { font-size: 8pt; margin-bottom: 10px; }
  h3 { font-size: 11pt; }
  .when, .where { font-size: 8.5pt; }
  .job { padding-bottom: 9px; }
  .web-only { display: none; }
  .print-only { display: block; }
  .when .key { display: inline; }
  .contact .print-only { display: inline; }
  .job h3, .job .when { break-after: avoid; }
  .job:not(:has(ul:not(.web-only))) { padding-bottom: 6px; display: flex; flex-wrap: wrap; align-items: baseline; gap: 0 10px; }
  .job:not(:has(ul:not(.web-only))) .when { order: 2; }
  .job:not(:has(ul:not(.web-only))) .where { order: 3; }
  .job:not(:has(ul:not(.web-only))) .where { display: none; }
  li { break-inside: avoid; }
  .job p { margin: 3px 0; }
  ul { margin-top: 3px; }
  li { margin-bottom: 1px; }
  .tags { margin-top: 5px; gap: 4px; }
  .tags span { font-size: 7.5pt; padding: 0 5px; color: var(--soft); }
  .skill-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 0 16px; }
  .skill { break-inside: avoid; margin-bottom: 6px; font-size: 8.5pt; line-height: 1.35; color: var(--soft); }
  .skill h3 { display: inline; font-size: 9pt; }
  .skill h3::after { content: ": "; }
  .skill .tags { display: inline; margin: 0; }
  .skill .tags span { font: inherit; border: 0; padding: 0; color: inherit; }
  .skill .tags span:not(:last-child)::after { content: ", "; }
  .picks { gap: 4px; }
  .edu p, .edu .when { font-size: 8.5pt; margin: 0; }
  .picks li { padding-left: 15px; }
  .picks li::before { width: 8px; height: 9px; }
  .picks h3 { font-size: 9.5pt; }
  .picks h3 a { color: var(--fg); }
  .picks p { font-size: 8.5pt; }
  .picks ul { margin: 1px 0 0; padding-left: 11px; font-size: 8.3pt; line-height: 1.3; color: var(--muted); }
  .picks li li { padding: 0; margin: 0 0 1px; }
  .picks li li::before { display: none; }
  .picks li li::marker { color: var(--pc); }
  .skill h3, aside .edu h3 { font-size: 9.5pt; }
  a { text-decoration: none; }

  /* Hex bullets: a graphite gradient rim with a lighter core so they read as hexagons on paper. */
  :root { --hex: polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%); --rim: linear-gradient(160deg, #8a92a3, #1d2230 75%); --slate: #4a5264; }
  h2::before { width: 10px; height: 11.5px; background: var(--rim); }
  h2::after { background: linear-gradient(90deg, #8d95a6, #e4e7ed 60%, transparent); }
  .job::before { left: -6px; top: 3px; width: 11px; height: 12.7px; background: var(--slate); box-shadow: none; }
  .job::after { content: ""; position: absolute; left: -3px; top: 6.5px; width: 5px; height: 5.8px; background: #fff; clip-path: var(--hex); }
  .job { border-left-color: var(--slate); }
  .job ul:not(.web-only) { list-style: none; padding-left: 14px; }
  .job ul:not(.web-only) li { position: relative; }
  .job ul:not(.web-only) li::before, .hx { content: ""; position: absolute; left: -14px; top: .24em; width: 9px; height: 10.4px; background: var(--rim); clip-path: var(--hex); }
  li.pre::after, .hx::after { content: ""; position: absolute; left: -11.5px; top: calc(.24em + 2.9px); width: 4px; height: 4.6px; background: #fff; clip-path: var(--hex); }
  .hx { position: relative; display: inline-block; left: 0; top: .05em; }
  .hx::after { left: 2.5px; top: 2.9px; }
  /* Projects: a slate rail runs down the bullet column so the colored hexes pop; the Experience timeline shares its color. */
  .picks { position: relative; }
  .picks::before { content: ""; position: absolute; left: 0; top: -3px; bottom: -3px; width: 15px; border-radius: 8px; background: var(--slate); }
  .picks li { padding-left: 21px; }
  .picks li::before { left: 2px; top: .22em; width: 11px; height: 12.7px; background: linear-gradient(160deg, color-mix(in srgb, var(--pc) 75%, #fff), var(--pc) 70%); }
  .picks ul { list-style: none; padding-left: 10px; }
  .picks li li { position: relative; padding: 0; }
  .picks li li::before { display: block; left: -10px; top: .3em; width: 7px; height: 8.1px; background: var(--rim); }
  .picks li li::after { display: none; }
}
`;

const REVEAL = `
document.querySelectorAll(".reveal").forEach((b) => b.addEventListener("click", () => {
  const e = [...atob(b.dataset.e)].reverse().join(""), a = document.createElement("a");
  a.href = "mailto:" + e; a.textContent = e; b.replaceWith(a); a.focus();
}));
`;

// Faint hex lattice that brightens near the cursor. Static when motion is reduced.
const LATTICE = `
(() => {
  const cv = document.getElementById("lattice"), ctx = cv.getContext("2d");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const R = 24, cw = Math.sqrt(3) * R, ch = 1.5 * R, mouse = { x: -999, y: -999 };
  let W, H, t = 0;
  const size = () => { const d = devicePixelRatio || 1; W = innerWidth; H = innerHeight; cv.width = W * d; cv.height = H * d; ctx.setTransform(d, 0, 0, d, 0, 0); if (reduce) draw(); };
  addEventListener("resize", size);
  addEventListener("pointermove", (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });
  function draw() {
    ctx.clearRect(0, 0, W, H);
    for (let r = -1; r * ch < H + R; r++) for (let c = -1; c * cw < W + cw; c++) {
      const x = c * cw + (r & 1 ? cw / 2 : 0), y = r * ch;
      let a = .035 + .03 * Math.sin(x * .006 + y * .004 + t * .02);
      const d = Math.hypot(x - mouse.x, y - mouse.y);
      if (d < 160) a += (1 - d / 160) * .3;
      ctx.strokeStyle = "rgba(111,156,255," + a + ")";
      ctx.beginPath();
      for (let k = 0; k < 6; k++) { const ang = Math.PI / 3 * k + Math.PI / 6; ctx.lineTo(x + (R - 2) * Math.cos(ang), y + (R - 2) * Math.sin(ang)); }
      ctx.closePath(); ctx.stroke();
    }
    t++;
    if (!reduce) requestAnimationFrame(draw);
  }
  size(); draw();
})();
`;

// Avatar as a hex mosaic: cells fly in on load, the cursor is a lens that
// shows the sharp photo, and a click scatters the cells so they reassemble.
const HEXFACE = `
(() => {
  const img = document.getElementById("avatar"), cv = document.getElementById("hexface");
  if (!img || !cv) return;
  const box = cv.closest(".photo"), ctx = cv.getContext("2d");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const R = 5, LENS = 34;
  let cells = [], W, H, t0 = 0, running = false;
  const ptr = { x: -999, y: -999, in: false };
  const ease = (x) => 1 - Math.pow(1 - x, 3);
  function build() {
    const d = devicePixelRatio || 1;
    W = cv.clientWidth; H = cv.clientHeight;
    cv.width = W * d; cv.height = H * d; ctx.setTransform(d, 0, 0, d, 0, 0);
    const off = document.createElement("canvas"); off.width = W; off.height = H;
    const o = off.getContext("2d"), s = Math.max(W / img.naturalWidth, H / img.naturalHeight);
    o.drawImage(img, (W - img.naturalWidth * s) / 2, (H - img.naturalHeight * s) / 2, img.naturalWidth * s, img.naturalHeight * s);
    const px = o.getImageData(0, 0, W, H).data; // throws if the image is cross-origin; the photo then shows as is
    const cw = Math.sqrt(3) * R, ch = 1.5 * R;
    cells = [];
    for (let r = 0; r * ch < H + R; r++) for (let c = 0; c * cw < W + cw; c++) {
      const x = c * cw + (r & 1 ? cw / 2 : 0), y = r * ch;
      const i = (Math.min(H - 1, Math.round(y)) * W + Math.min(W - 1, Math.round(x))) * 4;
      cells.push({ x, y, col: "rgb(" + px[i] + "," + px[i + 1] + "," + px[i + 2] + ")", sx: 0, sy: 0, rot: 0, delay: 0, k: 1 });
    }
    scatter(true);
  }
  function scatter(first) {
    for (const c of cells) {
      const a = Math.random() * Math.PI * 2, dist = (first ? 120 : 60) + Math.random() * 140;
      c.sx = c.x + Math.cos(a) * dist; c.sy = c.y + Math.sin(a) * dist;
      c.rot = (Math.random() - .5) * 6; c.delay = Math.random() * (first ? 600 : 300);
    }
    t0 = performance.now(); box.classList.remove("ready"); kick();
  }
  function hex(x, y, r, rot) {
    ctx.beginPath();
    for (let k = 0; k < 6; k++) { const a = Math.PI / 3 * k + Math.PI / 6 + rot; ctx.lineTo(x + r * Math.cos(a), y + r * Math.sin(a)); }
    ctx.closePath(); ctx.fill();
  }
  function frame(now) {
    ctx.clearRect(0, 0, W, H);
    let moving = false;
    for (const c of cells) {
      const p = reduce ? 1 : ease(Math.min(1, Math.max(0, (now - t0 - c.delay) / 900)));
      if (p < 1) moving = true;
      const target = ptr.in ? Math.min(1, Math.hypot(c.x - ptr.x, c.y - ptr.y) / LENS) : 1;
      c.k += (target - c.k) * (reduce ? 1 : .25);
      if (Math.abs(target - c.k) > .01) moving = true;
      const size = (R - .6) * c.k * p;
      if (size < .3) continue;
      ctx.globalAlpha = p;
      ctx.fillStyle = c.col;
      hex(c.sx + (c.x - c.sx) * p, c.sy + (c.y - c.sy) * p, size, c.rot * (1 - p));
    }
    ctx.globalAlpha = 1;
    if (!moving) box.classList.add("ready");
    running = moving || ptr.in;
    if (running) requestAnimationFrame(frame);
  }
  function kick() { if (!running) { running = true; requestAnimationFrame(frame); } }
  cv.addEventListener("pointermove", (e) => { const r = cv.getBoundingClientRect(); ptr.x = e.clientX - r.left; ptr.y = e.clientY - r.top; ptr.in = true; kick(); });
  cv.addEventListener("pointerleave", () => { ptr.in = false; kick(); });
  cv.addEventListener("click", () => { if (!reduce) scatter(false); });
  function go() { try { box.classList.add("mosaic"); build(); } catch { box.classList.remove("mosaic"); cv.remove(); } }
  img.complete && img.naturalWidth ? go() : img.addEventListener("load", go);
})();
`;

export function render(resume) {
  const b = resume.basics || {};
  const rules = [], top = header(b, rules);
  // In print, skills sit under experience so the two columns end level.
  const main = section("experience", "Experience", work(resume.work)) + section("skills print-only", "Skills", skillColumns(resume.skills));
  const side = [
    section("projects", "Projects", projects(resume.projects)),
    section("skills web-only", "Skills", skills(resume.skills)),
    section("education", "Education", education(resume.education)),
  ].join("");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(b.name)} · Resume</title>
<meta name="description" content="${esc(b.name)}, ${esc(b.label)}.">
<meta name="theme-color" content="#070a10">
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Anton&display=swap">
<style>${FONTS}${CSS}${rules.join("")}</style>
</head>
<body>
<canvas id="lattice" aria-hidden="true"></canvas>
<div class="page">
  ${top}
  <div class="cols">
    <main>${main}</main>
    <aside>${side}</aside>
  </div>
</div>
<script>${LATTICE}${HEXFACE}${REVEAL}</script>
</body>
</html>`;
}
