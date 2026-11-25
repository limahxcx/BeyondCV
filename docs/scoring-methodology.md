# Scoring methodology

Rule set version: `1.1.0`.

The score ranges from 0 to 100 and is a weighted mean of assessed categories. Each category starts at 100; applicable findings subtract fixed points down to a floor of zero.

| Category | Weight |
| --- | ---: |
| ATS compatibility | 20% |
| Professional impact | 25% |
| Experience quality | 20% |
| Structure and organization | 10% |
| Skills and keywords | 10% |
| Information completeness | 10% |
| Clarity and communication | 5% |

If readable input is shorter than 40 characters or extraction is visibly corrupted, the score is withheld. Uncertain interpretation is not evidence that experience is absent. Impact and experience are unavailable until the interpretation is sufficiently reliable or the user identifies the relevant passages. A user can explicitly confirm that those categories are not applicable. Coverage is the sum of the weights actually assessed, out of 100; the overall score is withheld below 80% coverage or when essential experience categories are unavailable. An apparently perfect ATS score is also withheld when experience interpretation is uncertain, rather than treating a parser limitation as proof of compatibility or incompatibility.

The diagnostic view shows extracted text, detected sections and experiences, possible impact indicators and unclassified text. Users can select original passages for classification, correct role, company and dates using text from the passage, or confirm that they have no professional experience. The original text remains unchanged; selections are stored locally with the draft. Heuristics and PDF layout reconstruction are imperfect, especially for complex columns and scanned documents. Users should compare the extracted text and order with the original.

The current deterministic checks look for conventional section headings, unexpected control/replacement characters, action-oriented or outcome language, generic responsibility phrases, short extracted text, date order, a skills section, a professional summary, education/training, and contact methods. Recommendations explain the detected text and include questions or actions where possible.

Qualitative outcomes and scoped action are accepted; numerical results are not required. A bare action verb is not treated as proof of impact. Date ranges and phone numbers are not treated as impact metrics. A missing metric is not itself a failure. Education is optional and its absence does not reduce a score. The system cannot reliably infer every profession, layout, responsibility, or outcome; review recommendations and verify every statement before using it.

This is a proprietary project assessment, not an ATS certification, a universal measure of ATS behavior, or a prediction of interviews or hiring. Different systems parse documents differently.
