# Scoring methodology

Rule set version: `1.0.0`.

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

If readable input is shorter than 40 characters, the score is withheld. If no experience section is found, the impact and experience categories are excluded from the weighted average. Category notes disclose this exclusion.

The current deterministic checks look for conventional section headings, unexpected control/replacement characters, action-oriented or outcome language, generic responsibility phrases, short extracted text, date order, a skills section, a professional summary, education/training, and contact methods. Recommendations explain the detected text and include questions or actions where possible.

Qualitative outcomes and scoped action are accepted; numerical results are not required. A bare action verb is not treated as proof of impact. Date ranges and phone numbers are not treated as impact metrics. A missing metric is not itself a failure. Education is optional and its absence does not reduce a score. The system cannot reliably infer every profession, layout, responsibility, or outcome; review recommendations and verify every statement before using it.

This is a proprietary project assessment, not an ATS certification, a universal measure of ATS behavior, or a prediction of interviews or hiring. Different systems parse documents differently.
