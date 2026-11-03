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
// data-c names the value so the PDF build can reserve its spot (scripts/resume-pdf.mjs).
function printOnly(value, rules, key) {
  const spans = [];
  for (let i = 0; i < value.length; i += 3) {
    const k = `k${rules.length}`;
    rules.push(`.${k}::before{content:"${cssEscape(value.slice(i, i + 3))}"}`);
    spans.push(`<span class="${k}"></span>`);
  }
  return `<span class="pc" data-c="${key}">${spans.join("")}</span>`;
}

// On screen the email is a button; the address is stored reversed and
// base64-encoded and assembled in the browser on click.
const hide = (v) => Buffer.from([...v].reverse().join("")).toString("base64");
const reveal = (e) => `<button class="reveal" type="button" data-e="${hide(e)}">Show email</button>`;

// Dates are ISO 8601 at year, month, or day precision; show only what was given.
function date(s) {
  if (!s) return "";
  const [y, m] = s.split("-");
  return m ? `${MONTHS[+m - 1]} ${y}` : y;
}
const initials = (n = "") => n.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
const range = (a, b) => (b && date(a) === date(b) ? date(a) : `${date(a)} – ${b ? date(b) : "Present"}`);

const list = (items = [], cls = "") =>
  items.length ? `<ul${cls ? ` class="${cls}"` : ""}>${items.map((h) => `<li>${esc(h)}</li>`).join("")}</ul>` : "";
// Bullets can be grouped under era headings (highlightGroups). Screen and print show the same wording.
const bullets = (w) =>
  w.highlightGroups ? w.highlightGroups.map((g) => `<h4 class="era">${esc(g.title)}</h4>${list(g.highlights)}`).join("") : list(w.highlights);
const tags = (items = []) => (items.length ? `<div class="tags">${items.map((k) => `<span>${esc(k)}</span>`).join("")}</div>` : "");
const section = (id, title, body) => (body ? `<section class="${id}"><h2>${title}</h2>${body}</section>` : "");

function header(b = {}, rules = []) {
  const contact = [
    CONTACT.email && reveal(CONTACT.email),
    CONTACT.email && printOnly(CONTACT.email, rules, "email"),
    CONTACT.phone && printOnly(CONTACT.phone, rules, "phone"),
    b.url && `<a class="site" href="${esc(b.url)}">${esc(host(b.url))}</a>`,
    // Print shows the address itself, since a bare "GitHub" means nothing on paper.
    ...(b.profiles || []).map((p) => `<a href="${esc(p.url)}"><span class="web-only">${esc(p.network)}</span><span class="print-only">${esc(host(p.url).replace(/^www\./, ""))}</span></a>`),
  ].filter(Boolean);
  return `
  <header class="top">
    <div class="photo"><span>${b.image ? `<img id="avatar" src="${esc(b.image)}" alt=""><img class="real" src="${esc(b.image)}" alt="${esc(b.name)}"><canvas id="hexface" aria-hidden="true" title="Click to scatter"></canvas>` : `<b>${esc(initials(b.name))}</b>`}</span></div>
    <div class="id">
      <p class="label">${esc(b.label)}</p>
      <h1>${esc(b.name)}</h1>
      <nav class="contact">${contact.join("")}</nav>
    </div>
    <div class="actions">
      <button class="btn" type="button" id="pdf" data-name="${esc(b.name)}"${CONTACT.email ? ` data-e="${hide(CONTACT.email)}"` : ""}${CONTACT.phone ? ` data-p="${hide(CONTACT.phone)}"` : ""}>Download PDF</button>
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
      <div class="when">${range(w.startDate, w.endDate)}</div>
      <h3>${esc(w.position)} <span>${w.url ? `<a href="${esc(w.url)}">${esc(w.name)}</a>` : esc(w.name)}</span></h3>
      ${w.location ? `<div class="where">${esc(w.location)}</div>` : ""}
      ${w.summary ? `<p>${esc(w.summary)}</p>` : ""}
      ${bullets(w)}
    </article>`,
    )
    .join("");

// A hex outline in one colour, as an SVG data URL for CSS backgrounds (print timeline markers).
const hexOutline = (color) => {
  const p = "5.500,0.550 10.524,3.450 10.524,9.251 5.500,12.152 0.476,9.251 0.476,3.450";
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 11 12.702'><polygon points='${p}' fill='#fff' stroke='${color}' stroke-width='1.1' stroke-linejoin='miter'/></svg>`;
  return `url(data:image/svg+xml,${encodeURIComponent(svg).replace(/'/g, "%27")})`;
};

// Small line icons for the printed contact column.
const ICON = {
  email: "<rect x='1.5' y='3.5' width='13' height='9' rx='1.5' fill='none' stroke='C' stroke-width='1.4'/><path d='M2 4.5l6 4.5 6-4.5' fill='none' stroke='C' stroke-width='1.4'/>",
  phone: "<path d='M5 1.8h2.2l1 3-1.6 1.2a8 8 0 0 0 3.4 3.4l1.2-1.6 3 1v2.2c0 .9-.7 1.6-1.6 1.6A11.4 11.4 0 0 1 3.4 3.4C3.4 2.5 4.1 1.8 5 1.8z' fill='none' stroke='C' stroke-width='1.3' stroke-linejoin='round'/>",
  site: "<circle cx='8' cy='8' r='6.3' fill='none' stroke='C' stroke-width='1.3'/><path d='M1.8 8h12.4M8 1.7c2 2 2 10.6 0 12.6M8 1.7c-2 2-2 10.6 0 12.6' fill='none' stroke='C' stroke-width='1.1'/>",
  linkedin: "<rect x='1' y='1' width='14' height='14' rx='2.5' fill='C'/><path d='M4.4 6.8v4.8M4.4 4.3v.1M7.3 11.6V6.8M7.3 8.9c0-1.3.9-2.1 2-2.1s1.8.8 1.8 2.1v2.7' stroke='#fff' stroke-width='1.5' stroke-linecap='round' fill='none'/>",
  github: "<path fill='C' d='M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z'/>",
};
const iconUrl = (name, color = "#3b5fd6") =>
  `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'>${ICON[name].replaceAll("'C'", `'${color}'`)}</svg>`)}")`;
const CONTACT_ICONS = [
  [".contact .pc[data-c=email]", "email"], [".contact .pc[data-c=phone]", "phone"], [".contact a.site", "site"],
  [".contact a[href*='linkedin.com']", "linkedin"], [".contact a[href*='://github.com']", "github"],
].map(([sel, name]) => `${sel}::before { background-image: ${iconUrl(name)}; }`).join("\n");

const projects = (items = []) =>
  items.length
    ? `<ul class="picks">${items
        .map(
          (p, i) => `
      <li${p.printOnly ? ' class="print-only"' : ""} style="--pc:${esc(p.color || PALETTE[i % PALETTE.length])};--pm:${hexOutline(p.color || PALETTE[i % PALETTE.length])}">
        <h3>${p.url ? `<a href="${esc(p.url)}">${esc(p.name)}</a>` : esc(p.name)}</h3>
        ${p.description ? `<p>${esc(p.description)}</p>` : ""}
      </li>`,
        )
        .join("")}</ul>`
    : "";

// Website-only footer: tools the author uses and backs, plus recent upstream pull requests.
const openSource = (o) =>
  o
    ? `<section class="oss web-only"><h2>${esc(o.title)}</h2>
    ${o.summary ? `<p class="lede">${esc(o.summary)}</p>` : ""}
    <div class="oss-grid">
      <div><h3>Notable contributions</h3><ul class="toolset">${(o.contributions || []).map((c) => `<li><a href="${esc(c.url)}">${esc(c.repo)}</a> <span>${esc(c.text)}</span></li>`).join("")}</ul>
      ${o.all ? `<p class="more"><a href="${esc(o.all)}">All my merged upstream pull requests →</a></p>` : ""}</div>
      <div><h3>Daily drivers</h3><ul class="toolset">${(o.tools || []).map((t) => `<li><a href="${esc(t.url)}">${esc(t.name)}</a> <span>${esc(t.note)}</span></li>`).join("")}</ul></div>
    </div></section>`
    : "";

const skills = (items = []) =>
  items.length ? `<div class="skill-list">${items.map((s) => `<div class="skill"><h3>${esc(s.name)}</h3>${tags(s.keywords)}</div>`).join("")}</div>` : "";

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

// One zoom step per 8px of print width below Letter's 725px, rounded down with a little slack.
const PRINT_ZOOM = Array.from({ length: 30 }, (_, i) => 717 - i * 8)
  .map((w) => `@container (max-width: ${w + 7.99}px) { .page > * { zoom: ${(((w - 4) / 725) * 0.985).toFixed(3)}; } }`)
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
.photo.mosaic #avatar { opacity: 0; transition: opacity .4s; }
.photo.mosaic.ready #avatar { opacity: 1; }
/* Hovering fades the hex mosaic to the plain photo. */
.photo .real { position: absolute; inset: 0; z-index: 2; width: 100%; height: 100%; object-fit: cover; opacity: 0; pointer-events: none; transition: opacity .5s; }
.photo:hover .real, .photo:focus-within .real { opacity: 1; }
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
/* Section hexes, timeline markers, and the line share one centre, 6.5px in from the section edge. */
h2::before { content: ""; flex: none; width: 12px; height: 14px; margin-left: .5px; background: var(--accent); clip-path: polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%); }
h2::after { content: ""; flex: 1; height: 1px; background: var(--line); }
h3 { margin: 0; font-size: 19px; line-height: 1.3; letter-spacing: -.01em; }
.when { font: 13px var(--mono); color: var(--muted); }
.where { font-size: 14px; color: var(--muted); }
.job { position: relative; padding: 0 0 28px 28px; border-left: 1px solid var(--line); margin-left: 6px; }
.job::before { content: ""; position: absolute; left: -6.5px; top: 3px; width: 12px; height: 14px; background: var(--accent); clip-path: polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%); }
.job::after { content: ""; position: absolute; left: -5.1px; top: 4.6px; width: 9.2px; height: 10.8px; background: var(--bg); clip-path: polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%); }
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
.oss { margin-top: 8px; }
.oss h2::before { background: var(--brand); }
.oss .lede { max-width: 72ch; color: var(--soft); margin: 0 0 20px; }
.oss-grid { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr); gap: 48px; }
.oss h3 { font-size: 15px; margin-bottom: 10px; }
.toolset { list-style: none; padding: 0; margin: 0; display: grid; gap: 8px; }
.toolset li { position: relative; padding-left: 20px; margin: 0; }
.toolset li::before { content: ""; position: absolute; left: 0; top: .45em; width: 9px; height: 10.4px; background: var(--brand); clip-path: polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%); }
.toolset a { font-weight: 600; color: var(--fg); text-decoration: none; }
.toolset a:hover { color: var(--accent); }
.toolset span { color: var(--soft); }
.toolset span::before { content: "— "; color: var(--muted); }
.oss .more { margin: 14px 0 0; font: 13px var(--mono); }
.oss .more a { color: var(--accent); }
@media (max-width: 860px) {
  .cols { grid-template-columns: 1fr; gap: 0; }
  .oss-grid { grid-template-columns: 1fr; gap: 28px; }
  .top { grid-template-columns: auto minmax(0, 1fr); }
  .actions { grid-column: 1 / -1; flex-direction: row; flex-wrap: wrap; }
  .photo { --w: 96px; }
}
@media (max-width: 520px) { .top { grid-template-columns: 1fr; } }
@media (prefers-reduced-motion: reduce) { .btn, .project { transition: none; } }

/* Print and PDF: light paper, compact type, no lattice or buttons. */
/* Print engines lay Letter out at different widths (desktop Chrome and Firefox 725px, Safari ~677px, iOS browsers in between).
   Container queries step the zoom down with the real width so the layout matches everywhere. */
@media print { .page { container-type: inline-size; } ${PRINT_ZOOM} }
/* Print is the website on white paper: the same components and colours in one column, drawn at the
   website's sizes and scaled to the page, up to two pages. */
@page { size: Letter; margin: 9mm 12mm; }
@media print {
  :root { --bg: #fff; --panel: #fff; --line: #d5dae4; --fg: #0f1320; --muted: #5d6576; --soft: #2a3040; --accent: #3b5fd6; color-scheme: light; }
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  canvas, .actions, .reveal, .photo, .web-only { display: none; }
  .print-only { display: block; }
  .contact .print-only, .pc { display: inline; }
  /* The PDF build lays contact details out but leaves them blank; the download button writes them in. */
  .pdf-build .pc > span { visibility: hidden; }
  .page { padding: 0; max-width: none; zoom: .72; }
  .top { grid-template-columns: 1fr; }
  /* Sized so the name ends where the title line above it ends, as on the website. */
  h1 { font-size: 90.8px; }
  .summary { max-width: none; margin-top: 18px; }
  /* Block layout: Chrome won't break a page inside a grid row, so a grid pushed the sidebar to a new page whole. */
  .cols { display: block; margin-top: 22px; }
  /* Paper spacing: the website's rhythm, tightened. */
  section { margin-bottom: 20px; }
  .job { padding-bottom: 12px; }
  .job p { margin: 5px 0; }
  li { margin-bottom: 2px; }
  .era { margin: 10px 0 4px; }
  aside .skill { margin-bottom: 4px; }
  aside .tags { margin-top: 4px; gap: 4px; }
  aside .tags span { padding: 0 6px; }
  .picks { gap: 10px 40px; }
  .edu { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0 14px; }
  .edu p { margin: 0; }
  /* Skills and projects use the full width in two columns. */
  .skill-list, .picks { display: grid; grid-template-columns: 1fr 1fr; gap: 14px 40px; }
  .skill-list { grid-template-columns: 1fr 1fr 1fr; gap: 6px 28px; }
  /* Older, shorter jobs drop the location line on paper. */
  .job:nth-last-child(-n+2) .where { display: none; }
  .picks h3 a { color: var(--fg); }
  /* Contact: one row with a small icon before each item. */
  .contact > *::before { content: ""; display: inline-block; width: 13px; height: 13px; margin-right: 7px; vertical-align: -2px; background: center / contain no-repeat; }
  ${CONTACT_ICONS}
  /* Page breaks: keep titles with what follows, and never split a bullet or skill group. */
  .job h3, .job .when, .job .where, .job > p, .era, h2 { break-after: avoid; }
  li, .skill, .picks > li { break-inside: avoid; }
  a { text-decoration: none; }
  /* Every block positioned, so Chrome writes the PDF's text in reading order for text extraction and ATS parsing. */
  .top, .summary, main, aside, section { position: relative; }
  /* Normal letter spacing keeps word spaces in extracted text (tight tracking splits words into single glyphs). */
  h3 { letter-spacing: normal; }
}
`;

const REVEAL = `
document.querySelectorAll(".reveal").forEach((b) => b.addEventListener("click", () => {
  const e = [...atob(b.dataset.e)].reverse().join(""), a = document.createElement("a");
  a.href = "mailto:" + e; a.textContent = e; b.replaceWith(a); a.focus();
}));
`;

// Faint hex lattice that brightens near the cursor. Static when motion is reduced.
// Download PDF: the build-time PDF (scripts/resume-pdf.mjs) with contact details
// written in on click, so the file is identical in every browser. Falls back to
// printing the page if anything fails.
const DOWNLOAD = `
document.getElementById("pdf")?.addEventListener("click", async (ev) => {
  const b = ev.currentTarget, dec = (v) => v && [...atob(v)].reverse().join("");
  const load = (src) => new Promise((ok, fail) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = fail; document.head.append(s); });
  const get = (url, as) => fetch(url).then((r) => { if (!r.ok) throw new Error(url); return r[as](); });
  b.disabled = true;
  try {
    const layout = await get("resume-pdf.json", "json");
    const [pdf, font] = await Promise.all([
      get("resume.pdf", "arrayBuffer"), get(layout.font, "arrayBuffer"),
      window.PDFLib || load("js/vendor/pdf-lib.min.js"), window.fontkit || load("js/vendor/fontkit.umd.min.js"),
    ]);
    const { stampContact } = await import("./js/stamp-contact.mjs");
    const bytes = await stampContact({ ...window.PDFLib, fontkit: window.fontkit }, pdf, font, layout, { email: dec(b.dataset.e), phone: dec(b.dataset.p) });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
    a.download = b.dataset.name.replace(/\\s+/g, "-") + "-Resume.pdf";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 60000);
  } catch (err) {
    console.error(err);
    print();
  } finally {
    b.disabled = false;
  }
});
`;

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
      if (px[i + 3] < 40) continue; // transparent parts of the image stay background
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
  const main = section("experience", "Experience", work(resume.work));
  const side = [
    section("projects", "Projects", projects(resume.projects)),
    section("skills", "Skills", skills(resume.skills)),
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
  ${openSource(resume.openSource)}
</div>
<script>${LATTICE}${HEXFACE}${REVEAL}${DOWNLOAD}</script>
</body>
</html>`;
}
