# robertderose.github.io

Landing page for my open-source projects, plus my resume.

- `site/` is the static landing page (plain HTML and CSS).
- `resume.json` is my resume in [JSON Resume](https://jsonresume.org) format, rendered by the local theme in `resume-theme/`.

## Build

```sh
mise run site:build   # assemble dist/ and render dist/resume.html
mise run site:serve   # build, then serve on http://localhost:8000
mise run resume:pdf   # print a local PDF to private/ with headless Chrome
```

Contact details are not stored in this repo. The build reads them from the
`RESUME_EMAIL` and `RESUME_PHONE` environment variables (GitHub Actions secrets)
or from the git-ignored `private/contact.json`.

## Deploy

Pushing to `main` runs `.github/workflows/pages.yml`, which builds `dist/`
and publishes it to GitHub Pages.
