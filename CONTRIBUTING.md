# Contributing

Thanks for helping make career tools more accessible. Contributions should preserve BeyondCV's free, open-source, privacy-first principles.

## Development

1. Use Node.js 20.19+ or 22.12+ and npm.
2. Run `npm install` and `npm run dev`.
3. Before opening a change, run `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build`.
4. Include a focused test for behavior changes. Use synthetic resume data only.

## Expectations

- Keep resume processing in the browser; do not add a backend, telemetry, or remote AI provider.
- Never add fabricated career facts or metrics to generated text.
- Make uncertain or missing data explicit.
- Keep keyboard navigation and readable mobile layouts.
- Centralize user-facing translations in `src/i18n.ts`.
- Document material privacy, scoring, or deployment behavior changes.
- Check the licensing and maintenance status of added dependencies.

## Pull requests

Describe the user impact, privacy implications, tests run, and any known limitations. Do not attach real resumes, job applications, or contact details.
