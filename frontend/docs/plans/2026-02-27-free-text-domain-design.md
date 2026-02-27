# Free-Text Domain Field Design

## Problem
Domain is stored as an enum (`InternDomain`) but edited via text input. The `mapDomainString()` function fails to map custom text back to the enum, causing domain to revert to "Other".

## Solution
Replace `InternDomain` enum with plain `string`. Store, display, and print the user's exact text.

## Changes

### types/index.ts
- Remove `InternDomain` type and `INTERN_DOMAIN_LABELS`
- Change `domain` in `Intern` interface to `string`

### internService.ts
- Change `domain` param type from `InternDomain` to `string`

### All 4 Tab files
- Replace `INTERN_DOMAIN_LABELS[intern.domain]` → `intern.domain`
- Remove `mapDomainString()` calls, save raw text
- Domain filter: auto-populate from unique values in data

### All 4 Service files
- attendance/payslip: replace `INTERN_DOMAIN_LABELS[intern.domain]` → `intern.domain`
- certificate/offerLetter: already use domain label strings

### Remove dead code
- `mapDomainString()` from certificateService.ts
- `InternDomain` type and `INTERN_DOMAIN_LABELS` from types
