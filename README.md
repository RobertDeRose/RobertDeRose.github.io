# robertderose.github.io

Landing page for my open-source projects, plus my resume.

- `site/` is the static landing page (plain HTML and CSS).
- `resume.json` is my resume in [JSON Resume](https://jsonresume.org) format, rendered by the local theme in `resume-theme/`.

## Build

```sh
mise run site:build   # assemble dist/, render dist/resume.html, print dist/resume.pdf
mise run site:serve   # build, then serve on http://localhost:8000
mise run resume:pdf   # build, including the finished PDF in private/ (local only)
```

The build needs Google Chrome installed; `scripts/resume-pdf.mjs` drives it
through Playwright.

Contact details are not stored in this repo. The build reads them from the
`RESUME_EMAIL` and `RESUME_PHONE` environment variables (GitHub Actions secrets)
or from the git-ignored `private/contact.json`.

## Resume PDF

Chrome prints `dist/resume.pdf` once at build time, so every visitor gets the
same one-page PDF whatever browser or phone they use. The contact details are
laid out but left blank, and their positions are written to
`dist/resume-pdf.json`. The page's Download PDF button fetches the PDF and writes
the email and phone in with pdf-lib (`site/js/stamp-contact.mjs`), so the public
file never contains them. If that fails, the button falls back to printing the
page with the print stylesheet.

## Deploy

Pushing to `main` runs `.github/workflows/pages.yml`, which builds `dist/`
and publishes it to GitHub Pages.
