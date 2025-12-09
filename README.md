# CV Publication Checker

A single-page React + TypeScript + Vite tool to verify CV / ERAS-style publication entries against Crossref. Runs entirely client-side and is ready for GitHub Pages.

## Features
- Paste publications text or upload an ERAS PDF export (pdf.js in-browser extraction).
- Heuristic parser for ERAS headings (Publications, Peer Reviewed Journal Articles/Abstracts, Poster Presentation, Oral Presentation, etc.). Handles wrapped lines and hyphenated breaks.
- Editable table of detected publications (title, authors, journal/event, year, type, section).
- Crossref lookup per publication with fuzzy scoring (title + journal + year) and candidate selection.
- Authorship + author-position verification using your name variants.
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

## Deploy to GitHub Pages
1. Update `base` in `vite.config.ts` to match your repo name (e.g., `/cv-checker/`).
2. Ensure the repo is committed and pushed.
3. Deploy:
```bash
npm run deploy
```
This builds to `dist/` and publishes via `gh-pages` to the `gh-pages` branch. Enable GitHub Pages in repo settings (source: `gh-pages` branch).

## Project structure
```
src/
  App.tsx               # Main SPA and step flow
  components/           # Stepper, editable publication table
  utils/                # Parsing, PDF extraction, Crossref, fuzzy matching, verification, exports
  index.css             # Tailwind layer + tokens
  main.tsx              # React root
```

## Notes
- Crossref API is public but rate limited; the app searches sequentially per publication.
- PDF parsing relies on `pdfjs-dist` worker loaded from the bundle; password-protected PDFs are not supported.
- Name matching is heuristic: it compares last names plus initials to find authorship and position alignment.
