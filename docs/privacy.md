# Privacy notes

The application has no backend, account system, analytics SDK, or remote resume storage. PDF/DOCX/TXT parsing, rule-based evaluation, job-text comparison, and export run in the browser.

Draft resume data, versions, and assessment history are stored in IndexedDB on the current browser profile when available. They are not encrypted by this app. Another person with access to that profile or device may be able to access the data. Use Settings to export a JSON backup or delete local records.

The service worker caches the static application shell and same-origin app assets for offline use. It does not cache AI models. AI is not available in this version. No resume content is sent to model hosts or external APIs. App dependencies are loaded from the deployed static application bundle; no external font or analytics requests are made.

File imports are limited to 10 MB. PDF scans without selectable text are not OCR-processed. Content is rendered as text rather than inserted as HTML.

These are implementation notes, not a legal compliance or security certification.
