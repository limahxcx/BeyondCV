# BeyondCV

**More than a resume. Your potential, unlocked.**

BeyondCV is a free, open-source, privacy-first resume toolkit. It runs in the browser, requires no account, and does not send resume content to a server. The first release focuses on an explainable resume review, a local resume editor, a guided impact interview, and a text-based job comparison.

## Principles

- Free to use, with no paid features or account requirement.
- Resume and job-description processing happens in the browser.
- No analytics, remote database, or external AI API.
- Recommendations must not invent experience, skills, outcomes, or metrics.
- The score is a project assessment, not an ATS certification or hiring prediction.

## Getting started

Requirements: Node.js 20.19+ or 22.12+ and npm.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. To validate a production build:

```sh
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run build
npm run preview
```

## Features

- Import selectable text from PDF, DOCX, and TXT files (10 MB limit), or paste text.
- Review extracted text before running a deterministic, versioned assessment.
- Explore category scores, strengths, limitations, and prioritized recommendations.
- Edit resume content and export selectable-text PDF, DOCX, or JSON backup.
- Use a guided interview to add only details confirmed by the user.
- Compare resume text with job-description keywords; missing terms are not treated as missing skills.
- Save resume drafts and versions in browser IndexedDB.
- Use the interface in English, Brazilian Portuguese, or Spanish.
- Install as a basic PWA and use the app shell offline after a successful visit.

## Privacy

There is no application backend. Resume files are parsed and scored locally; drafts, versions, and recent assessment results are saved in IndexedDB when the browser supports it. Settings provides a full local-data deletion action and a JSON backup option. The app does not load external fonts, analytics, or AI models.

See [docs/privacy.md](docs/privacy.md) and the in-app Privacy page for current details. Local browser storage is not encrypted by BeyondCV and may be accessible to someone with access to the device or browser profile.

## Scoring

The deterministic rules and their limits are documented in [docs/scoring-methodology.md](docs/scoring-methodology.md). A score is withheld when the extracted text is too short to evaluate reliably. ATS products differ, and BeyondCV cannot predict their behavior or a hiring outcome.

## Deployment

Cloudflare Workers static assets are configured in `wrangler.jsonc`; build output is `dist` and SPA route fallback is enabled.

```sh
npm run build
npx wrangler deploy --assets ./dist
```

Connect the repository to Cloudflare with build command `npm run build`, deploy command `npx wrangler deploy --assets ./dist`, root `/`, and output `dist`. Do not add secrets or paid infrastructure. Deployment needs an authorized Cloudflare account and an existing connected project.

## Known limitations

- OCR for scanned PDFs is not available; the analyzer will not score an image-only document.
- Resume extraction is text-based and cannot reliably reconstruct complex columns or tables.
- The analysis rules are lightweight pattern checks and are not profession-specific or a substitute for human review. Education is not required or penalized when absent.
- Job Match uses direct token overlap and a small set of explicit wording variants, not semantic AI.
- Local AI is not implemented; no simulated AI results are shown.
- Resume Builder includes three restrained single-column styles and section/experience ordering. PDF/DOCX export stays selectable text and uses a text-first layout.
- End-to-end tests cover a desktop analyzer flow and mobile navigation; cross-browser coverage is not configured yet.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Please use synthetic resume content in tests and issue reports; do not share real resumes or personal contact details.

## Security

Report security concerns using the process in [SECURITY.md](SECURITY.md). Do not include real personal data in a report.

## License

The project is released under the MIT License. See [LICENSE](LICENSE). Dependency licenses remain their respective authors' terms.
