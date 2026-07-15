# Canonical Import Specification

## Supported adapters

| Adapter | Version | Intended source |
| --- | --- | --- |
| `SWIMSIGHT_CANONICAL` | `swimsight-canonical-v1` | Documented SwimSight interchange format |
| `GENERIC_RACE_CSV` | `generic-race-csv-v1` | User-owned CSV with recognized header aliases |
| `SWIMCLOUD_EXPORT` | `swimcloud-compatible-export-v1` | SwimCloud-compatible user export |

Hy-Tek, Meet Manager, or federation exports require a separate tested adapter for the exact authorized export format. SwimSight does not scrape websites or bypass third-party controls.

## Canonical columns

Required columns are `date`, `event`, and `time`. Header matching is case-insensitive and Unicode-normalized.

| Column | Required | Contract |
| --- | --- | --- |
| `date` | yes | `YYYY-MM-DD`; SwimCloud-compatible exports also accept `MM/DD/YYYY` |
| `event` | yes | One of the supported individual events |
| `time` | yes | Seconds or `M:SS.xx`, positive and under two hours |
| `course` | no | `LCM`, `SCM`, or `SCY`; defaults to `LCM` |
| `meet name` | no | Maximum 120 characters |
| `result kind` | no | `OFFICIAL` or `TRAINING`; defaults to `OFFICIAL` |
| `race type` | no | `INDIVIDUAL`, `RELAY_SPLIT`, `TIME_TRIAL`, or `CONVERTED` |
| `athlete name` | no | Used for reviewable identity matching |
| `athlete birth year` | no | Four-digit year used only for identity review |
| `external athlete id` | no | Source-owned identifier |
| `external meet id` | no | Source-owned identifier |
| `external result id` | no | Preferred idempotency identifier |
| `source status` | no | Source status; DQ, DNS, DNF, and scratched rows are rejected |

See [canonical-results.csv](./examples/canonical-results.csv), [generic-results.csv](./examples/generic-results.csv), and [swimcloud-compatible-results.csv](./examples/swimcloud-compatible-results.csv).

## Safety and quality rules

- Maximum upload: 1.5 MB, 10,000 data rows, 64 columns, and 2,048 characters per cell.
- Null bytes, replacement characters, malformed quoting, duplicate headers, inconsistent columns, unexpected mappings, and ambiguous dates are rejected.
- Values beginning with `=`, `+`, `-`, or `@`, including Unicode-normalized variants, are rejected as formula-like content.
- Future dates, dates before 1950, unsupported events, invalid courses, impossible calendar dates, non-result statuses, and broad time outliers are rejected.
- Exact external IDs or account-scoped content hashes provide idempotency. Near matches require review.
- Athlete, meet, and result identity decisions include confidence and structured reason codes. Missing meet/result IDs fall back to reviewable content keys for private analytics; they do not qualify as research-grade provenance.
- The raw file is not retained. The batch retains the source file hash, adapter version, mapping, original row hash, normalized row, provenance, and action history.

For sealed research cohorts and public validation, a result must also retain an import-row link, original-row hash, external meet ID, and external result ID. A clean private import is not automatically research evidence.

## Partial failure and rollback

Preview rows are independently classified as valid, invalid, duplicate, or review-required. A commit may include only valid selected rows. A partial commit remains reviewable. Rollback deletes only results created by that account-owned batch and invalidates affected cohorts and evaluation outcomes; it never rewrites an old cohort as if it had never existed.
