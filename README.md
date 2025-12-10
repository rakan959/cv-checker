# CV Publication Checker

A single-page React + TypeScript + Vite tool to verify CV / ERAS-style publication entries against Crossref. Runs entirely client-side and ships to GitHub Pages.

## Features
- Paste publications text or upload one or many ERAS PDFs (pdf.js in-browser extraction; bulk uploads auto-search Crossref).
- Heuristic parser for ERAS headings (Publications, Peer Reviewed Journal Articles/Abstracts, Poster Presentation, Oral Presentation, etc.). Handles wrapped lines and hyphenated breaks.
- Editable publication cards (title, authors, journal, pages/volume, month/year).
- Crossref lookup per publication with fuzzy scoring (title + journal + year) and candidate selection (best match auto-selects).
- Authorship + author-position verification against Crossref authors.
- Summary banner and export to CSV or HTML report.
- Responsive, clean UI styled with Tailwind.

## Quick start
```bash
npm install
npm run dev
```
Visit http://localhost:5173.

## Build
```bash
npm run build
npm run preview
```

## Deploy to GitHub Pages (GitHub Actions)
- `vite.config.ts` is set to `base: '/cv-checker/'`. If your repo name differs, update `base` to `/<your-repo>/` before deploying.
- A workflow at `.github/workflows/deploy.yml` builds and publishes to GitHub Pages on pushes to `main` (or via manual dispatch). It uploads `dist/` and uses GitHub Actions Pages deployment.
- In repo settings, set Pages source to "GitHub Actions".

## Project structure
```
src/
  App.tsx               # Main SPA flow and search/verification UI
  components/           # Publication table/cards
  utils/                # Parsing, PDF extraction, Crossref, fuzzy matching, verification, exports
  index.css             # Tailwind layer + tokens
  main.tsx              # React root
```

## Notes
- Crossref API is public but rate limited; the app searches sequentially per publication.
- PDF parsing relies on `pdfjs-dist` worker loaded from the bundle; password-protected PDFs are not supported.
- Name matching is heuristic: it compares last names plus initials to find authorship and position alignment.
