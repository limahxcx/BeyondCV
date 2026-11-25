# Architecture

BeyondCV is a static React SPA. It has no application API or remote database.

## Boundaries

- `src/domain/resume.ts`: typed resume model, schema validation, best-effort text parsing, and ordered plain-text serialization.
- `src/domain/scoring.ts`: deterministic rules, versioned evaluation, score categories, and actionable findings.
- `src/services/parsers.ts`: browser-only PDF, DOCX, and plain-text import.
- `src/services/exports.ts`: selectable-text PDF, DOCX, and JSON downloads.
- `src/services/storage.ts`: versioned IndexedDB object store.
- `src/i18n.ts`: interface language detection and translation dictionaries.
- `src/App.tsx`: routes, interactions, and feature pages.

All imported content is rendered as React text, not injected HTML. DOCX import extracts raw text. File imports are capped at 10 MB.

## Persistence

IndexedDB schema version 1 uses one `records` store with a single `app-data` snapshot. If storage is unavailable, the UI continues to work in memory and shows a warning. A full delete clears the database contents.

## AI

No AI provider or model is implemented. The rule-based assessment is deterministic and does not contact external services. Do not represent rule-based matching as semantic analysis.

## PWA and hosting

Vite builds static files into `dist`. Cloudflare Workers serves these assets using the SPA fallback in `wrangler.jsonc`. The service worker caches the app shell and same-origin assets; no model downloads are included.
